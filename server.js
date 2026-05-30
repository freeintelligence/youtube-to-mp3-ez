const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const youtubedl = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Directory for temporary downloads
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Get yt-dlp binary path from youtube-dl-exec
const ytDlpPath = youtubedl.constants.YOUTUBE_DL_PATH;

app.use(express.json());

// ── Request Logger Middleware ─────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`\n→ [${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('  Body:', JSON.stringify(req.body));
  }
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`← [${new Date().toISOString()}] ${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const musicRoutes = require('./src/presentation/musicRoutes');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/music', musicRoutes);

// ── Helpers ──────────────────────────────────────────────────────────

function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
    /^(https?:\/\/)?youtu\.be\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^(https?:\/\/)?music\.youtube\.com\/watch\?v=[\w-]+/,
  ];
  return patterns.some((p) => p.test(url));
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Clean up old files (older than 30 minutes)
function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 30 * 60 * 1000) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldFiles, 10 * 60 * 1000);

// ── API: Resolve video/playlist metadata helper ───────────────────────

async function resolveUrlInfo(url) {
  // Any URL with list= is treated as a playlist
  const isPlaylist = url.includes('list=');

  if (isPlaylist) {
    // Detect YouTube Mix/Radio playlists (list=RD...) — they are infinite
    const listMatch = url.match(/list=([^&]+)/);
    const listId = listMatch ? listMatch[1] : '';
    const isMix = listId.startsWith('RD');
    const trackLimit = isMix ? 25 : 200;

    const result = await youtubedl(url, {
      dumpSingleJson: true,
      flatPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegPath,
      playlistEnd: trackLimit,
      yesPlaylist: true,
    });

    const tracks = (result.entries || []).map((entry, index) => ({
      id: entry.id,
      url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
      title: entry.title || `Track ${index + 1}`,
      artist: entry.uploader || entry.channel || '',
      duration: entry.duration,
      durationFormatted: formatDuration(entry.duration),
      thumbnail:
        entry.thumbnails?.[entry.thumbnails.length - 1]?.url ||
        `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
    }));

    return {
      type: 'playlist',
      title: result.title || 'Playlist',
      channel: result.uploader || result.channel || '',
      thumbnail: result.thumbnails?.[result.thumbnails.length - 1]?.url || '',
      trackCount: tracks.length,
      tracks,
    };
  } else {
    // Single video
    const result = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegPath,
      noPlaylist: true,        // Ensure we only get the single video
    });

    const track = {
      id: result.id,
      url: url,
      title: result.title || 'Unknown',
      artist: result.artist || result.uploader || result.channel || '',
      duration: result.duration,
      durationFormatted: formatDuration(result.duration),
      thumbnail:
        result.thumbnails?.[result.thumbnails.length - 1]?.url ||
        `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`,
    };

    return {
      type: 'single',
      id: result.id,
      url: url,
      title: result.title || 'Unknown',
      artist: result.artist || result.uploader || result.channel || '',
      duration: result.duration,
      durationFormatted: formatDuration(result.duration),
      thumbnail: track.thumbnail,
      tracks: [track],
    };
  }
}

// ── API: Stream audio directly ───────────────────────────────────────

app.get('/api/stream', async (req, res) => {
  const { url } = req.query;
  if (!url || !isValidYouTubeUrl(url)) {
    return res.status(400).send('URL no válida');
  }

  try {
    console.log('  [stream] Resolving direct audio URL for:', url);
    const result = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegPath,
      noPlaylist: true,
      format: 'bestaudio/best',
    });

    const directUrl = result.url;
    if (!directUrl) {
      console.error('  [stream] ❌ Could not extract direct stream URL');
      return res.status(404).send('Direct URL not found');
    }

    console.log('  [stream] ✓ Direct URL resolved:', directUrl.substring(0, 100) + '...');
    
    // Set headers to support Range Requests
    const headers = { ...req.headers };
    // Remove headers that might cause Google Video CDN to reject the request
    delete headers.host;
    delete headers.connection;
    delete headers.referer;
    delete headers.origin;

    const https = require('https');
    
    console.log('  [stream] Initiating range-proxy request...');
    if (req.headers.range) {
      console.log('  [stream] Client range:', req.headers.range);
    }

    const proxyReq = https.request(directUrl, {
      method: 'GET',
      headers: headers
    }, (proxyRes) => {
      console.log(`  [stream] CDN responded with status: ${proxyRes.statusCode}`);
      
      // Forward status code
      res.status(proxyRes.statusCode);

      // Forward response headers
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        const lowerKey = key.toLowerCase();
        if (['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].includes(lowerKey)) {
          res.setHeader(key, value);
        }
      }

      // Pipe the stream back
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('  [stream] ❌ Proxy request error:', err);
      if (!res.headersSent) {
        res.status(500).send('Proxy stream error');
      }
    });

    // Handle client aborting request (disconnecting)
    req.on('close', () => {
      if (!res.writableEnded) {
        console.log('  [stream] Client aborted connection. Aborting proxy request.');
        proxyReq.destroy();
      }
    });

    proxyReq.end();

  } catch (err) {
    console.error('  [stream] ❌ Error in stream endpoint:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Error streaming audio: ' + err.message);
    }
  }
});

// ── API: Get video/playlist info ─────────────────────────────────────

app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    console.log('  [info] Received URL:', url);
    console.log('  [info] URL type:', typeof url);

    if (!url || !isValidYouTubeUrl(url)) {
      console.log('  [info] ❌ URL validation failed');
      return res.status(400).json({ error: 'URL de YouTube no válida' });
    }

    console.log('  [info] ✓ URL is valid');
    const info = await resolveUrlInfo(url);
    console.log('  [info] ✓ Metadata successfully resolved');
    return res.json(info);
  } catch (err) {
    console.error('  [info] ❌ ERROR:', err.message);
    console.error('  [info] Stack:', err.stack);
    if (err.stderr) console.error('  [info] stderr:', err.stderr.substring(0, 500));
    return res
      .status(500)
      .json({ error: 'Error al obtener información del video: ' + err.message });
  }
});

// ── API: Get bulk multi-line info ────────────────────────────────────

app.post('/api/bulk-info', async (req, res) => {
  try {
    const { text } = req.body;
    console.log('  [bulk-info] Received text length:', text?.length);

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto requerido' });
    }

    // Advanced regex to extract YouTube URLs from any block of text
    const urlRegex = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?(?:youtube\.com\/(?:watch\?v=|playlist\?list=|shorts\/)|music\.youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+(?:&[a-zA-Z0-9_=-]+)*/g;
    
    let matchedUrls = text.match(urlRegex) || [];
    
    // Normalize matched URLs by prepending protocol if missing
    matchedUrls = matchedUrls.map(u => {
      u = u.trim();
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        return 'https://' + u;
      }
      return u;
    });

    // Deduplicate the extracted URLs
    const uniqueUrls = [...new Set(matchedUrls)];
    console.log('  [bulk-info] Extracted unique URLs:', uniqueUrls);

    if (uniqueUrls.length === 0) {
      return res.status(400).json({ error: 'No se encontraron enlaces de YouTube en el texto proporcionado.' });
    }

    const processedTrackIds = new Set();
    const combinedTracks = [];
    const sources = [];
    const errors = [];

    // Process each URL sequentially to prevent resource contention or IP bans
    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i];
      console.log(`  [bulk-info] Processing URL [${i + 1}/${uniqueUrls.length}]:`, url);
      try {
        const info = await resolveUrlInfo(url);
        console.log(`  [bulk-info] ✓ Resolved [${info.type}] tracks:`, info.tracks.length);
        
        sources.push({
          url,
          type: info.type,
          title: info.title,
          trackCount: info.tracks.length
        });

        for (const track of info.tracks) {
          if (!processedTrackIds.has(track.id)) {
            processedTrackIds.add(track.id);
            combinedTracks.push(track);
          }
        }
      } catch (err) {
        console.error(`  [bulk-info] ❌ Failed to resolve URL:`, url, 'Error:', err.message);
        errors.push({
          url,
          error: err.message || 'Error al obtener información'
        });
      }
    }

    console.log(`  [bulk-info] Completed. Total tracks: ${combinedTracks.length}, Errors: ${errors.length}`);

    if (combinedTracks.length === 0 && errors.length > 0) {
      return res.status(500).json({
        error: 'No se pudo procesar ningún enlace de YouTube: ' + errors[0].error,
        errors
      });
    }

    return res.json({
      type: 'bulk',
      title: 'Descarga Masiva',
      tracks: combinedTracks,
      trackCount: combinedTracks.length,
      sources,
      errors
    });

  } catch (err) {
    console.error('  [bulk-info] ❌ SERVER ERROR:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor: ' + err.message });
  }
});

// ── API: Download a single track as MP3 ──────────────────────────────

app.post('/api/download', async (req, res) => {
  try {
    const { url, title, artist, album } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    // Build filename from artist, album, and title
    let parts = [];
    if (artist) parts.push(artist);
    if (album) parts.push(album);
    
    if (title) {
      // If we don't have an album, but the title already includes the artist,
      // just use the title to avoid duplication (e.g. "Artist - Artist - Song")
      if (!album && artist && title.toLowerCase().includes(artist.toLowerCase())) {
        parts = [title];
      } else {
        parts.push(title);
      }
    } else if (parts.length === 0) {
      parts = [`track-${Date.now()}`];
    }
    
    let filename = sanitizeFilename(parts.join(' - '));

    const downloadId = uuidv4();
    const outputPath = path.join(DOWNLOADS_DIR, `${downloadId}.mp3`);

    // Set up SSE for progress
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('progress', { percent: 0, status: 'Iniciando descarga...' });

    // Use spawn to capture progress in real-time
    const args = [
      url,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--ffmpeg-location', ffmpegPath,
      '--no-warnings',
      '--no-check-certificates',
      '--output', outputPath.replace('.mp3', '.%(ext)s'),
      '--newline',
      '--progress',
    ];

    console.log('  [download] Command:', ytDlpPath);
    console.log('  [download] Args:', args.join(' '));
    console.log('  [download] Output path:', outputPath);

    const proc = spawn(ytDlpPath, args);

    let lastPercent = 0;
    let stderrOutput = '';
    let stdoutOutput = '';

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      stdoutOutput += line;
      console.log('  [download] stdout:', line.trim());
      // Parse progress: [download] 45.2% of ...
      const match = line.match(/\[download\]\s+([\d.]+)%/);
      if (match) {
        const percent = Math.min(Math.round(parseFloat(match[1])), 100);
        if (percent > lastPercent) {
          lastPercent = percent;
          sendEvent('progress', {
            percent,
            status:
              percent < 100
                ? `Descargando... ${percent}%`
                : 'Convirtiendo a MP3...',
          });
        }
      }
      // Detect conversion phase
      if (line.includes('[ExtractAudio]') || line.includes('[ffmpeg]')) {
        sendEvent('progress', {
          percent: 95,
          status: 'Convirtiendo a MP3...',
        });
      }
    });

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      stderrOutput += line;
      console.log('  [download] stderr:', line.trim());
      // yt-dlp sometimes outputs progress to stderr
      const match = line.match(/\[download\]\s+([\d.]+)%/);
      if (match) {
        const percent = Math.min(Math.round(parseFloat(match[1])), 100);
        if (percent > lastPercent) {
          lastPercent = percent;
          sendEvent('progress', {
            percent,
            status: `Descargando... ${percent}%`,
          });
        }
      }
    });

    proc.on('close', (code) => {
      console.log('  [download] Process exited with code:', code);
      if (stderrOutput) console.log('  [download] Full stderr:', stderrOutput.substring(0, 1000));
      if (code !== 0) {
        const errorMsg = stderrOutput || stdoutOutput || 'Error desconocido';
        console.error('  [download] ❌ FAILED. stderr:', stderrOutput.substring(0, 500));
        sendEvent('error', { message: 'Error durante la descarga: ' + errorMsg.substring(0, 200) });
        res.end();
        return;
      }

      // yt-dlp may output with a different extension then convert
      // Find the actual mp3 file
      const files = fs.readdirSync(DOWNLOADS_DIR);
      const mp3File = files.find(
        (f) => f.startsWith(downloadId) && f.endsWith('.mp3')
      );

      if (!mp3File) {
        sendEvent('error', {
          message: 'No se pudo encontrar el archivo convertido',
        });
        res.end();
        return;
      }

      sendEvent('progress', { percent: 100, status: '¡Listo!' });
      sendEvent('complete', {
        downloadId,
        filename: `${filename}.mp3`,
      });
      res.end();
    });

    proc.on('error', (err) => {
      console.error('Process error:', err);
      sendEvent('error', { message: 'Error al iniciar la descarga' });
      res.end();
    });

    // Handle client disconnect — use res.on('close'), NOT req.on('close')
    // req 'close' fires when the POST body is consumed (immediately),
    // res 'close' fires when the client disconnects from the SSE stream.
    let processFinished = false;
    proc.on('close', () => { processFinished = true; });
    res.on('close', () => {
      if (!processFinished) {
        console.log('  [download] Client disconnected, killing yt-dlp process');
        proc.kill();
      }
    });
  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ error: 'Error al descargar el archivo' });
    }
  }
});

// ── API: Serve the downloaded MP3 file ───────────────────────────────

app.get('/api/file/:downloadId', (req, res) => {
  const { downloadId } = req.params;
  const filename = req.query.name || 'download.mp3';

  // Validate downloadId format (UUID)
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      downloadId
    )
  ) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const filePath = path.join(DOWNLOADS_DIR, `${downloadId}.mp3`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }

  const stat = fs.statSync(filePath);

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', stat.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  // Schedule cleanup after download
  stream.on('end', () => {
    setTimeout(() => {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // ignore
      }
    }, 60000); // Delete after 1 minute
  });
});

// ── Serve the SPA ────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  🎵 YouTube MP3 Downloader`);
  console.log(`  ────────────────────────`);
  console.log(`  Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`  Presiona Ctrl+C para detener\n`);
});

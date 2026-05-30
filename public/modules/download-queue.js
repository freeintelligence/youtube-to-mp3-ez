/**
 * Download Queue
 *
 * Manages sequential download of music tracks.
 * For each track: resolves YouTube URL → calls existing /api/download → SSE progress.
 * Reuses the existing download pipeline entirely.
 */

import { resolveTrackCandidate } from './music-api.js';

/**
 * @typedef {object} QueuedTrack
 * @property {string} id
 * @property {string} title
 * @property {string} artistName
 * @property {string} [albumName]
 * @property {number} [durationMs]
 * @property {number} [position]
 */

export class DownloadQueue {
  /**
   * @param {Function} onStatusChange - Called with (trackId, status, data) on each state change
   */
  constructor(onStatusChange) {
    this.onStatusChange = onStatusChange;
    /** @type {QueuedTrack[]} */
    this.tracks = [];
    this.isRunning = false;
    this.isCancelled = false;
  }

  /** @param {QueuedTrack[]} tracks */
  setTracks(tracks) {
    this.tracks = [...tracks];
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
  }

  /**
   * Process all tracks sequentially.
   * For each track: resolve → download → report.
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isCancelled = false;

    for (let i = 0; i < this.tracks.length; i++) {
      if (this.isCancelled) break;

      const track = this.tracks[i];

      // Step 1: Resolve YouTube candidate
      this._emit(track.id, 'resolving', { message: 'Buscando en YouTube...' });

      let youtubeUrl;
      try {
        const result = await resolveTrackCandidate({
          artistName: track.artistName,
          trackName: track.title,
          albumName: track.albumName,
          durationMs: track.durationMs,
        });

        youtubeUrl = result.url;
        this._emit(track.id, 'resolved', {
          url: youtubeUrl,
          title: result.title,
          score: result.score,
        });
      } catch (err) {
        this._emit(track.id, 'error', {
          message: err.message || 'No se encontró candidato en YouTube',
        });
        continue; // Skip to next track
      }

      if (this.isCancelled) break;

      // Step 2: Download via existing /api/download endpoint (SSE)
      try {
        await this._downloadViaSSE(track, youtubeUrl);
      } catch (err) {
        this._emit(track.id, 'error', {
          message: err.message || 'Error durante la descarga',
        });
      }

      // Small delay between downloads to avoid overwhelming the server
      if (i < this.tracks.length - 1 && !this.isCancelled) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    this.isRunning = false;
    this._emit('__queue__', 'complete', {});
  }

  /**
   * Calls the existing /api/download with SSE progress tracking.
   * This is the exact same flow used by the existing single/bulk tabs.
   */
  async _downloadViaSSE(track, youtubeUrl) {
    this._emit(track.id, 'downloading', { percent: 0, message: 'Iniciando descarga...' });

    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: youtubeUrl,
        title: track.title,
        artist: track.artistName,
        album: track.albumName,
      }),
    });

    if (!response.ok) throw new Error('Error en la descarga');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (eventType === 'progress') {
              this._emit(track.id, 'downloading', {
                percent: data.percent,
                message: data.status,
              });
            } else if (eventType === 'complete') {
              // Trigger file download via hidden anchor
              this._triggerFileDownload(data.downloadId, data.filename);
              this._emit(track.id, 'complete', { filename: data.filename });
            } else if (eventType === 'error') {
              throw new Error(data.message);
            }
          } catch (parseErr) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }
    }
  }

  _triggerFileDownload(downloadId, filename) {
    const a = document.createElement('a');
    a.href = `/api/file/${downloadId}?name=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  _emit(trackId, status, data) {
    if (this.onStatusChange) {
      this.onStatusChange(trackId, status, data);
    }
  }
}

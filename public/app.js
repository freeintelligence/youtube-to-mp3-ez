/* ══════════════════════════════════════════════════════════════════════
   YouTube MP3 Downloader — Client Application
   ══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── DOM References ──────────────────────────────────────────────────
  const urlInput = document.getElementById('url-input');
  const searchBtn = document.getElementById('search-btn');
  const searchBtnIcon = searchBtn.querySelector('.search-btn__icon');
  const searchBtnText = searchBtn.querySelector('.search-btn__text');
  const searchBtnLoader = searchBtn.querySelector('.search-btn__loader');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const resultsSection = document.getElementById('results-section');
  const playlistHeader = document.getElementById('playlist-header');
  const playlistThumbnail = document.getElementById('playlist-thumbnail');
  const playlistTitle = document.getElementById('playlist-title');
  const playlistChannel = document.getElementById('playlist-channel');
  const playlistCount = document.getElementById('playlist-count');
  const downloadAllBtn = document.getElementById('download-all-btn');
  const trackList = document.getElementById('track-list');
  const emptyState = document.getElementById('empty-state');

  // ── State ───────────────────────────────────────────────────────────
  let currentTracks = [];
  let downloadQueue = [];
  let isDownloadingAll = false;

  // ── URL Validation ──────────────────────────────────────────────────
  function isValidYouTubeUrl(url) {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
      /^(https?:\/\/)?youtu\.be\/[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
      /^(https?:\/\/)?music\.youtube\.com\/watch\?v=[\w-]+/,
    ];
    return patterns.some((p) => p.test(url.trim()));
  }

  // ── Error Display ───────────────────────────────────────────────────
  function showError(msg) {
    errorMessage.textContent = msg;
    errorContainer.hidden = false;
    setTimeout(() => {
      errorContainer.hidden = true;
    }, 5000);
  }

  function hideError() {
    errorContainer.hidden = true;
  }

  // ── Loading State ───────────────────────────────────────────────────
  function setSearchLoading(loading) {
    searchBtn.disabled = loading;
    urlInput.disabled = loading;
    searchBtnIcon.hidden = loading;
    searchBtnText.textContent = loading ? 'Buscando...' : 'Buscar';
    searchBtnLoader.hidden = !loading;
  }

  // ── Search / Fetch Info ─────────────────────────────────────────────
  async function fetchInfo() {
    const url = urlInput.value.trim();
    console.log('[fetchInfo] Called with URL:', url);

    if (!url) {
      console.log('[fetchInfo] Empty URL');
      showError('Por favor, pega un enlace de YouTube');
      urlInput.focus();
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      console.log('[fetchInfo] Invalid URL:', url);
      showError('El enlace no parece ser de YouTube. Verifica e intenta de nuevo.');
      return;
    }

    console.log('[fetchInfo] URL is valid, starting fetch...');
    hideError();
    setSearchLoading(true);
    emptyState.hidden = true;
    resultsSection.hidden = true;

    try {
      console.log('[fetchInfo] Sending POST /api/info...');
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      console.log('[fetchInfo] Response status:', res.status);
      console.log('[fetchInfo] Response headers:', [...res.headers.entries()]);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log('[fetchInfo] Error response body:', data);
        throw new Error(data.error || 'Error al obtener información');
      }

      const data = await res.json();
      console.log('[fetchInfo] ✓ Got data:', data.type, '- tracks:', data.tracks?.length);
      currentTracks = data.tracks || [];
      renderResults(data);
    } catch (err) {
      console.error('[fetchInfo] ✗ Error:', err);
      showError(err.message || 'Error de conexión. Intenta de nuevo.');
      emptyState.hidden = false;
    } finally {
      setSearchLoading(false);
      console.log('[fetchInfo] Done');
    }
  }

  // ── Render Results ──────────────────────────────────────────────────
  function renderResults(data) {
    resultsSection.hidden = false;

    // Playlist header
    if (data.type === 'playlist') {
      playlistHeader.hidden = false;
      playlistThumbnail.src = data.thumbnail || '';
      playlistThumbnail.alt = data.title;
      playlistTitle.textContent = data.title;
      playlistChannel.textContent = data.channel;
      playlistCount.textContent = `${data.trackCount} canciones`;

      if (!data.thumbnail) {
        playlistThumbnail.style.display = 'none';
      } else {
        playlistThumbnail.style.display = '';
      }
    } else {
      playlistHeader.hidden = true;
    }

    // Track list
    trackList.innerHTML = '';

    data.tracks.forEach((track, index) => {
      const card = createTrackCard(track, index);
      trackList.appendChild(card);
    });
  }

  // ── Create Track Card ───────────────────────────────────────────────
  function createTrackCard(track, index) {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.id = `track-${track.id}`;
    card.style.animationDelay = `${Math.min(index * 0.05, 1)}s`;

    card.innerHTML = `
      <span class="track-card__number">${index + 1}</span>
      <img class="track-card__thumb" src="${track.thumbnail}" alt="${escapeHtml(track.title)}" loading="lazy" />
      <div class="track-card__info">
        <div class="track-card__title" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</div>
        <div class="track-card__artist">${escapeHtml(track.artist)}</div>
      </div>
      <span class="track-card__duration">${track.durationFormatted || ''}</span>
      <div class="track-card__actions">
        <button class="btn btn--primary btn--sm download-track-btn" data-track-id="${track.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          MP3
        </button>
      </div>
    `;

    // Bind download button
    const btn = card.querySelector('.download-track-btn');
    btn.addEventListener('click', () => downloadTrack(track));

    return card;
  }

  // ── Download Single Track ───────────────────────────────────────────
  async function downloadTrack(track) {
    const card = document.getElementById(`track-${track.id}`);
    if (!card || card.classList.contains('track-card--downloading')) return;

    card.classList.add('track-card--downloading');

    // Replace action buttons with progress
    const actionsEl = card.querySelector('.track-card__actions');
    const originalActions = actionsEl.innerHTML;

    actionsEl.innerHTML = `
      <div class="progress-wrapper">
        <div class="progress-bar">
          <div class="progress-bar__fill" style="width: 0%"></div>
        </div>
        <div class="progress-text">
          <span class="progress-status">Iniciando...</span>
          <span class="progress-percent">0%</span>
        </div>
      </div>
    `;

    const progressFill = actionsEl.querySelector('.progress-bar__fill');
    const progressStatus = actionsEl.querySelector('.progress-status');
    const progressPercent = actionsEl.querySelector('.progress-percent');

    try {
      const trackUrl = track.url || `https://www.youtube.com/watch?v=${track.id}`;

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trackUrl,
          title: track.title,
          artist: track.artist,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la descarga');
      }

      // Read SSE stream
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
                progressFill.style.width = `${data.percent}%`;
                progressStatus.textContent = data.status;
                progressPercent.textContent = `${data.percent}%`;
              } else if (eventType === 'complete') {
                // Download the file
                await triggerFileDownload(data.downloadId, data.filename);
                markTrackComplete(card, actionsEl, track);
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
    } catch (err) {
      console.error('Download error:', err);
      card.classList.remove('track-card--downloading');
      card.classList.add('track-card--error');

      actionsEl.innerHTML = `
        <div class="status-icon status-icon--error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <button class="btn btn--ghost btn--sm retry-btn">Reintentar</button>
      `;

      const retryBtn = actionsEl.querySelector('.retry-btn');
      retryBtn.addEventListener('click', () => {
        card.classList.remove('track-card--error');
        actionsEl.innerHTML = originalActions;
        const newBtn = actionsEl.querySelector('.download-track-btn');
        if (newBtn) {
          newBtn.addEventListener('click', () => downloadTrack(track));
        }
        downloadTrack(track);
      });
    }
  }

  // ── Trigger File Download ───────────────────────────────────────────
  async function triggerFileDownload(downloadId, filename) {
    const a = document.createElement('a');
    a.href = `/api/file/${downloadId}?name=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Mark Track Complete ─────────────────────────────────────────────
  function markTrackComplete(card, actionsEl, track) {
    card.classList.remove('track-card--downloading');
    card.classList.add('track-card--complete');

    actionsEl.innerHTML = `
      <div class="status-icon status-icon--complete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <button class="btn btn--ghost btn--sm re-download-btn">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Otra vez
      </button>
    `;

    const reBtn = actionsEl.querySelector('.re-download-btn');
    reBtn.addEventListener('click', () => {
      card.classList.remove('track-card--complete');
      downloadTrack(track);
    });
  }

  // ── Download All ────────────────────────────────────────────────────
  async function downloadAll() {
    if (isDownloadingAll || currentTracks.length === 0) return;
    isDownloadingAll = true;
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = `
      <div class="spinner"></div>
      Descargando...
    `;

    for (let i = 0; i < currentTracks.length; i++) {
      const track = currentTracks[i];
      const card = document.getElementById(`track-${track.id}`);

      // Skip already completed
      if (card && card.classList.contains('track-card--complete')) continue;
      // Skip currently downloading
      if (card && card.classList.contains('track-card--downloading')) continue;

      await downloadTrack(track);

      // Small delay between downloads to avoid overwhelming the server
      if (i < currentTracks.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    isDownloadingAll = false;
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      ¡Completado!
    `;

    setTimeout(() => {
      downloadAllBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Descargar todo
      `;
    }, 3000);
  }

  // ── Utility: HTML escape ────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Event Listeners ─────────────────────────────────────────────────
  searchBtn.addEventListener('click', fetchInfo);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchInfo();
  });

  // Auto-detect paste
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (isValidYouTubeUrl(urlInput.value.trim())) {
        fetchInfo();
      }
    }, 100);
  });

  downloadAllBtn.addEventListener('click', downloadAll);

  // Focus input on load
  urlInput.focus();
})();

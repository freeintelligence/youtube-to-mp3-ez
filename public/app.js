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

  // Tabs
  const tabSingle = document.getElementById('tab-single');
  const tabBulk = document.getElementById('tab-bulk');
  const containerSingle = document.getElementById('container-single');
  const containerBulk = document.getElementById('container-bulk');

  // Bulk Inputs
  const bulkInput = document.getElementById('bulk-input');
  const bulkSearchBtn = document.getElementById('bulk-search-btn');
  const bulkSearchBtnIcon = bulkSearchBtn.querySelector('.search-btn__icon');
  const bulkSearchBtnText = bulkSearchBtn.querySelector('.search-btn__text');
  const bulkSearchBtnLoader = bulkSearchBtn.querySelector('.search-btn__loader');

  // Bulk Error Log
  const bulkErrorsContainer = document.getElementById('bulk-errors-container');
  const bulkErrorsSummary = document.getElementById('bulk-errors-summary');
  const toggleBulkErrors = document.getElementById('toggle-bulk-errors');
  const bulkErrorsDetails = document.getElementById('bulk-errors-details');

  // Selection controls
  const selectAllCb = document.getElementById('select-all-cb');

  // ── State ───────────────────────────────────────────────────────────
  let currentTracks = [];
  let downloadQueue = [];
  let isDownloadingAll = false;
  let activeTab = 'single'; // 'single' | 'bulk'

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

  function setBulkSearchLoading(loading) {
    bulkSearchBtn.disabled = loading;
    bulkInput.disabled = loading;
    bulkSearchBtnIcon.hidden = loading;
    bulkSearchBtnText.textContent = loading ? 'Procesando...' : 'Procesar enlaces';
    bulkSearchBtnLoader.hidden = !loading;
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
    bulkErrorsContainer.hidden = true;

    try {
      console.log('[fetchInfo] Sending POST /api/info...');
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      console.log('[fetchInfo] Response status:', res.status);

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

  // ── Search / Fetch Bulk Info ────────────────────────────────────────
  async function fetchBulkInfo() {
    const text = bulkInput.value.trim();
    console.log('[fetchBulkInfo] Called');

    if (!text) {
      showError('Por favor, pega algún texto con enlaces de YouTube');
      bulkInput.focus();
      return;
    }

    hideError();
    setBulkSearchLoading(true);
    emptyState.hidden = true;
    resultsSection.hidden = true;
    bulkErrorsContainer.hidden = true;
    bulkErrorsDetails.hidden = true;
    bulkErrorsDetails.innerHTML = '';
    toggleBulkErrors.textContent = 'Ver detalles';

    try {
      console.log('[fetchBulkInfo] Sending POST /api/bulk-info...');
      const res = await fetch('/api/bulk-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      console.log('[fetchBulkInfo] Response status:', res.status);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log('[fetchBulkInfo] Error response:', data);
        throw new Error(data.error || 'Error al procesar los enlaces');
      }

      const data = await res.json();
      console.log('[fetchBulkInfo] Got data, tracks:', data.tracks?.length, 'errors:', data.errors?.length);
      currentTracks = data.tracks || [];
      renderResults(data);
    } catch (err) {
      console.error('[fetchBulkInfo] Error:', err);
      showError(err.message || 'Error de conexión. Intenta de nuevo.');
      emptyState.hidden = false;
    } finally {
      setBulkSearchLoading(false);
      console.log('[fetchBulkInfo] Done');
    }
  }

  // ── Render Results ──────────────────────────────────────────────────
  function renderResults(data) {
    resultsSection.hidden = false;
    const playlistBadge = document.getElementById('playlist-badge');

    // Playlist or Bulk header
    if (data.type === 'playlist' || data.type === 'bulk') {
      playlistHeader.hidden = false;

      if (data.type === 'bulk') {
        playlistBadge.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
            <line x1="9" y1="18" x2="15" y2="18"/>
          </svg>
          Descarga Masiva
        `;
        playlistThumbnail.src = data.tracks[0]?.thumbnail || '';
        playlistThumbnail.alt = 'Descarga Masiva';
        playlistThumbnail.style.display = data.tracks[0]?.thumbnail ? '' : 'none';

        playlistTitle.textContent = 'Descarga Masiva de Enlaces';
        const successfulSources = data.sources?.length || 0;
        playlistChannel.textContent = `${successfulSources} enlaces procesados con éxito`;
        playlistCount.textContent = `${data.trackCount} canciones únicas listas`;

        // Render errors if any
        if (data.errors && data.errors.length > 0) {
          bulkErrorsContainer.hidden = false;
          bulkErrorsSummary.textContent = `Algunos enlaces no pudieron ser procesados (${data.errors.length})`;

          bulkErrorsDetails.innerHTML = '';
          data.errors.forEach(err => {
            const item = document.createElement('div');
            item.className = 'bulk-error-item';
            item.innerHTML = `
              <span class="bulk-error-item__url">${escapeHtml(err.url)}</span>
              <span class="bulk-error-item__msg">${escapeHtml(err.error)}</span>
            `;
            bulkErrorsDetails.appendChild(item);
          });
        } else {
          bulkErrorsContainer.hidden = true;
        }
      } else {
        // Standard Playlist
        playlistBadge.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15V6"/>
            <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
            <path d="M12 12H3"/>
            <path d="M16 6H3"/>
            <path d="M12 18H3"/>
          </svg>
          Playlist
        `;
        playlistThumbnail.src = data.thumbnail || '';
        playlistThumbnail.alt = data.title;
        playlistThumbnail.style.display = data.thumbnail ? '' : 'none';

        playlistTitle.textContent = data.title;
        playlistChannel.textContent = data.channel;
        playlistCount.textContent = `${data.trackCount} canciones`;
        bulkErrorsContainer.hidden = true;
      }
    } else {
      playlistHeader.hidden = true;
      bulkErrorsContainer.hidden = true;
    }

    // Track list
    trackList.innerHTML = '';

    data.tracks.forEach((track, index) => {
      const card = createTrackCard(track, index);
      trackList.appendChild(card);
    });

    // Enable selection UI for multi-track results
    if (data.tracks.length > 1) {
      trackList.classList.add('track-list--selectable');
      selectAllCb.checked = true;
      selectAllCb.indeterminate = false;
      updateSelectionUI();
    } else {
      trackList.classList.remove('track-list--selectable');
    }
  }

  // ── Create Track Card ───────────────────────────────────────────────
  function createTrackCard(track, index) {
    const card = document.createElement('div');
    card.className = 'track-card';
    card.id = `track-${track.id}`;
    card.style.animationDelay = `${Math.min(index * 0.05, 1)}s`;

    card.innerHTML = `
      <label class="track-checkbox">
        <input type="checkbox" class="track-cb" data-track-id="${track.id}" checked>
        <span class="checkbox-mark"></span>
      </label>
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

    // Bind checkbox for selection
    const cb = card.querySelector('.track-cb');
    cb.addEventListener('change', updateSelectionUI);

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

  // ── Selection Helpers ────────────────────────────────────────────────
  function getSelectedTrackIds() {
    const checkboxes = trackList.querySelectorAll('.track-cb');
    const selected = new Set();
    checkboxes.forEach(cb => {
      if (cb.checked) selected.add(cb.dataset.trackId);
    });
    return selected;
  }

  function updateSelectionUI() {
    const checkboxes = Array.from(trackList.querySelectorAll('.track-cb'));
    const total = checkboxes.length;
    const checked = checkboxes.filter(cb => cb.checked).length;

    // Update select-all checkbox state
    if (checked === 0) {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    } else if (checked === total) {
      selectAllCb.checked = true;
      selectAllCb.indeterminate = false;
    } else {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = true;
    }

    // Update download button text and state
    const textEl = document.getElementById('download-all-text');
    if (textEl) {
      if (checked === total) {
        textEl.textContent = `Descargar todo (${total})`;
      } else if (checked === 0) {
        textEl.textContent = 'Selecciona canciones';
      } else {
        textEl.textContent = `Descargar seleccionados (${checked})`;
      }
    }
    downloadAllBtn.disabled = checked === 0 || isDownloadingAll;
  }

  // ── Download All ────────────────────────────────────────────────────
  async function downloadAll() {
    if (isDownloadingAll || currentTracks.length === 0) return;
    isDownloadingAll = true;
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = `
      <div class="spinner"></div>
      <span id="download-all-text">Descargando...</span>
    `;

    const selectedIds = getSelectedTrackIds();
    const tracksToDownload = currentTracks.filter(t => selectedIds.has(t.id));

    for (let i = 0; i < tracksToDownload.length; i++) {
      const track = tracksToDownload[i];
      const card = document.getElementById(`track-${track.id}`);

      // Skip already completed
      if (card && card.classList.contains('track-card--complete')) continue;
      // Skip currently downloading
      if (card && card.classList.contains('track-card--downloading')) continue;

      await downloadTrack(track);

      // Small delay between downloads to avoid overwhelming the server
      if (i < tracksToDownload.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    isDownloadingAll = false;
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span id="download-all-text">¡Completado!</span>
    `;

    setTimeout(() => {
      downloadAllBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span id="download-all-text">Descargar todo</span>
      `;
      updateSelectionUI();
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
  
  // Tab Switching — supports 4 tabs
  const tabArtist = document.getElementById('tab-artist');
  const tabAlbum = document.getElementById('tab-album');
  const containerArtist = document.getElementById('container-artist');
  const containerAlbum = document.getElementById('container-album');
  const artistResultsSection = document.getElementById('artist-results-section');
  const albumResultsSection = document.getElementById('album-results-section');

  const allTabs = [tabSingle, tabBulk, tabArtist, tabAlbum];
  const allContainers = [containerSingle, containerBulk, containerArtist, containerAlbum];
  const tabResultsMap = {
    single: resultsSection,
    bulk: resultsSection,
    artist: artistResultsSection,
    album: albumResultsSection,
  };

  function switchTab(name, tabEl, containerEl) {
    if (activeTab === name) return;
    activeTab = name;
    allTabs.forEach(t => t.classList.remove('search-tab--active'));
    allContainers.forEach(c => { c.hidden = true; });
    tabEl.classList.add('search-tab--active');
    containerEl.hidden = false;

    // Show only the results section for the active tab
    resultsSection.hidden = (name !== 'single' && name !== 'bulk');
    artistResultsSection.hidden = (name !== 'artist');
    albumResultsSection.hidden = (name !== 'album');

    // Hide error container when switching
    errorContainer.hidden = true;
    
    // Hide empty state for new tabs
    if (emptyState) {
      if (name === 'artist' || name === 'album') {
        emptyState.hidden = true;
      } else {
        // For single/bulk, if there are no results yet, show empty state
        const hasResults = !resultsSection.hidden && trackList.children.length > 0;
        emptyState.hidden = hasResults;
      }
    }

    // Focus appropriate input
    const inputs = { single: urlInput, bulk: bulkInput, artist: document.getElementById('artist-input'), album: document.getElementById('album-input') };
    if (inputs[name]) inputs[name].focus();
  }

  tabSingle.addEventListener('click', () => switchTab('single', tabSingle, containerSingle));
  tabBulk.addEventListener('click', () => switchTab('bulk', tabBulk, containerBulk));
  tabArtist.addEventListener('click', () => switchTab('artist', tabArtist, containerArtist));
  tabAlbum.addEventListener('click', () => switchTab('album', tabAlbum, containerAlbum));

  // Single Search
  searchBtn.addEventListener('click', fetchInfo);

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchInfo();
  });

  // Auto-detect paste on single input
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      if (isValidYouTubeUrl(urlInput.value.trim())) {
        fetchInfo();
      }
    }, 100);
  });

  // Bulk Search
  bulkSearchBtn.addEventListener('click', fetchBulkInfo);

  // Toggle Bulk Errors Log
  toggleBulkErrors.addEventListener('click', () => {
    const isHidden = bulkErrorsDetails.hidden;
    bulkErrorsDetails.hidden = !isHidden;
    toggleBulkErrors.textContent = isHidden ? 'Ocultar detalles' : 'Ver detalles';
  });

  // Download All
  downloadAllBtn.addEventListener('click', downloadAll);

  // Select All checkbox
  selectAllCb.addEventListener('change', () => {
    const checkboxes = trackList.querySelectorAll('.track-cb');
    checkboxes.forEach(cb => {
      cb.checked = selectAllCb.checked;
    });
    updateSelectionUI();
  });

  // Focus input on load
  urlInput.focus();
})();

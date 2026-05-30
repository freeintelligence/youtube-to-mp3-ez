/**
 * Album Tab Controller
 *
 * Manages the flow: search albums → select album → show tracks
 * → select/deselect tracks → download selected.
 */

import { searchAlbums, getAlbumTracks } from './music-api.js';
import {
  createAlbumResultCard, createTrackRow,
  createLoadingState, createEmptyState, createErrorState,
  createSelectionSummary, createDownloadJobRow, createFilterPills, escapeHtml,
} from './music-ui.js';
import { DownloadQueue } from './download-queue.js';

// ── DOM References ──
const albumInput = document.getElementById('album-input');
const albumSearchBtn = document.getElementById('album-search-btn');
const albumResultsSection = document.getElementById('album-results-section');

// ── State ──
let state = {
  query: '',
  albums: [],
  selectedAlbum: null,
  tracks: [],
  selectedTrackIds: new Set(),
  activeFilters: new Set(),
  isLoading: false,
  phase: 'search',  // 'search' | 'albums' | 'tracks' | 'downloading'
};

// ── Initialization ──

if (albumSearchBtn) {
  albumSearchBtn.addEventListener('click', handleAlbumSearch);
}

if (albumInput) {
  albumInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAlbumSearch();
  });
}

// ── Search Albums ──

async function handleAlbumSearch() {
  const query = albumInput.value.trim();
  if (!query) return;

  state.query = query;
  state.phase = 'albums';
  state.selectedAlbum = null;
  state.tracks = [];
  state.selectedTrackIds = new Set();
  state.activeFilters = new Set();

  renderLoading('Buscando álbumes...');

  try {
    const data = await searchAlbums(query);
    state.albums = data.albums || [];

    if (state.albums.length === 0) {
      renderEmpty(`No se encontraron álbumes para "${query}"`, 'album');
    } else {
      // Initialize filters
      const uniqueTypes = new Set(state.albums.map(a => a.type).filter(Boolean));
      state.activeFilters = new Set(uniqueTypes);
      renderAlbumResults();
    }
  } catch (err) {
    renderError(err.message, handleAlbumSearch);
  }
}

// ── Render: Album Results ──

function renderAlbumResults() {
  albumResultsSection.innerHTML = '';
  albumResultsSection.hidden = false;

  const header = document.createElement('div');
  header.className = 'music-section-header';
  header.innerHTML = `
    <button class="btn btn--ghost btn--sm music-back-btn" type="button">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Volver
    </button>
    <h3 class="music-section-title">Resultados para "${escapeHtml(state.query)}"</h3>
  `;
  header.querySelector('.music-back-btn').addEventListener('click', () => {
    state.phase = 'search';
    albumResultsSection.innerHTML = '';
    albumResultsSection.hidden = true;
  });
  albumResultsSection.appendChild(header);

  // Filters
  const uniqueTypes = new Set(state.albums.map(a => a.type).filter(Boolean));
  if (uniqueTypes.size > 1) {
    const filtersContainer = createFilterPills(Array.from(uniqueTypes).sort(), state.activeFilters, (type) => {
      if (state.activeFilters.has(type)) {
        state.activeFilters.delete(type);
      } else {
        state.activeFilters.add(type);
      }
      renderAlbumResults(); // Re-render
    });
    albumResultsSection.appendChild(filtersContainer);
  }

  const list = document.createElement('div');
  list.className = 'music-result-list';
  state.albums.forEach(album => {
    if (album.type && !state.activeFilters.has(album.type)) return;
    list.appendChild(createAlbumResultCard(album, handleAlbumSelected));
  });
  albumResultsSection.appendChild(list);
}

// ── Select Album → Load Tracks ──

async function handleAlbumSelected(album) {
  state.selectedAlbum = album;
  state.phase = 'tracks';
  state.tracks = [];
  state.selectedTrackIds = new Set();

  renderLoading(`Cargando canciones de "${album.title}"...`);

  try {
    const data = await getAlbumTracks(album.id);
    state.tracks = data.tracks || [];

    // Fill artist name from the response if album didn't have it
    if (!album.artistName && data.artistName) {
      album.artistName = data.artistName;
    }

    // Enrich tracks with album/artist info
    state.tracks.forEach(track => {
      track.albumName = album.title;
      track.artistName = track.artistName || album.artistName;
    });

    if (state.tracks.length === 0) {
      renderEmpty(`No se encontraron canciones para "${album.title}"`, 'music');
    } else {
      // All tracks selected by default
      state.tracks.forEach(t => state.selectedTrackIds.add(t.id));
      renderTrackList();
    }
  } catch (err) {
    renderError(err.message, () => handleAlbumSelected(album));
  }
}

// ── Render: Track List ──

function renderTrackList() {
  albumResultsSection.innerHTML = '';
  albumResultsSection.hidden = false;

  // Header with album info
  const header = document.createElement('div');
  header.className = 'music-section-header';
  header.innerHTML = `
    <button class="btn btn--ghost btn--sm music-back-btn" type="button">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Volver
    </button>
    <div class="music-album-header">
      <img class="music-album-header__cover" src="${escapeHtml(state.selectedAlbum.coverArtUrl)}"
           alt="" loading="lazy" onerror="this.style.display='none'" />
      <div>
        <h3 class="music-section-title">${escapeHtml(state.selectedAlbum.title)}</h3>
        <span class="music-section-subtitle">
          ${escapeHtml(state.selectedAlbum.artistName || '')}
          ${state.selectedAlbum.year ? ` · ${state.selectedAlbum.year}` : ''}
          ${state.selectedAlbum.type ? ` · ${state.selectedAlbum.type}` : ''}
        </span>
      </div>
    </div>
  `;
  header.querySelector('.music-back-btn').addEventListener('click', () => {
    renderAlbumResults();
  });
  albumResultsSection.appendChild(header);

  // Select all toggle
  const selectAllRow = document.createElement('div');
  selectAllRow.className = 'music-select-all-row';
  selectAllRow.innerHTML = `
    <label class="select-all-wrapper">
      <input type="checkbox" id="album-tab-select-all" checked />
      <span class="checkbox-mark"></span>
      <span class="select-all-label">Seleccionar todas (${state.tracks.length})</span>
    </label>
  `;
  const selectAllCb = selectAllRow.querySelector('#album-tab-select-all');
  selectAllCb.addEventListener('change', () => {
    if (selectAllCb.checked) {
      state.tracks.forEach(t => state.selectedTrackIds.add(t.id));
    } else {
      state.selectedTrackIds.clear();
    }
    // Update all track checkboxes
    albumResultsSection.querySelectorAll('.music-track-cb').forEach(cb => {
      cb.checked = selectAllCb.checked;
    });
    updateSummary();
  });
  albumResultsSection.appendChild(selectAllRow);

  // Track list
  const list = document.createElement('div');
  list.className = 'music-track-list';

  state.tracks.forEach(track => {
    const row = createTrackRow(track, {
      onCheckChange: (t, checked) => {
        if (checked) {
          state.selectedTrackIds.add(t.id);
        } else {
          state.selectedTrackIds.delete(t.id);
        }
        // Update select-all state
        const total = state.tracks.length;
        const selected = state.selectedTrackIds.size;
        selectAllCb.checked = selected === total;
        selectAllCb.indeterminate = selected > 0 && selected < total;
        updateSummary();
      },
      isChecked: state.selectedTrackIds.has(track.id),
    });
    list.appendChild(row);
  });

  albumResultsSection.appendChild(list);

  // Selection summary
  updateSummary();
}

function updateSummary() {
  const existing = albumResultsSection.querySelector('.music-selection-summary');
  if (existing) existing.remove();

  const selected = state.selectedTrackIds.size;
  const total = state.tracks.length;

  if (total === 0) return;
  if (selected === 0) {
    const summary = createSelectionSummary('0 canciones seleccionadas', 'Selecciona canciones', null, true);
    albumResultsSection.appendChild(summary);
    return;
  }

  const textLeft = `${selected} de ${total} canciones seleccionadas`;
  const textBtn = `Descargar ${selected} canción${selected > 1 ? 'es' : ''}`;

  const summary = createSelectionSummary(textLeft, textBtn, handleStartDownload);
  albumResultsSection.appendChild(summary);
}

// ── Download ──

async function handleStartDownload() {
  const tracksToDownload = state.tracks.filter(t => state.selectedTrackIds.has(t.id));
  if (tracksToDownload.length === 0) return;

  state.phase = 'downloading';

  albumResultsSection.innerHTML = '';
  albumResultsSection.hidden = false;

  const header = document.createElement('div');
  header.className = 'music-section-header';
  header.innerHTML = `
    <h3 class="music-section-title">Descargando ${tracksToDownload.length} canciones</h3>
    <span class="music-section-subtitle">${escapeHtml(state.selectedAlbum?.title || '')} · ${escapeHtml(state.selectedAlbum?.artistName || '')}</span>
  `;
  albumResultsSection.appendChild(header);

  const list = document.createElement('div');
  list.className = 'music-download-list';
  list.id = 'album-download-list';

  tracksToDownload.forEach(track => {
    const row = createDownloadJobRow({
      track,
      status: 'pending',
      progress: 0,
      error: '',
    });
    // Use jobId to avoid querySelector collisions when duplicate IDs exist
    row.dataset.jobId = track.jobId;
    list.appendChild(row);
  });

  albumResultsSection.appendChild(list);

  const queue = new DownloadQueue((jobId, status, data) => {
    if (jobId === '__queue__') {
      const title = albumResultsSection.querySelector('.music-section-title');
      if (title) title.textContent = '¡Descarga completada!';
      return;
    }

    const row = list.querySelector(`[data-job-id="${jobId}"]`);
    if (!row) return;

    const statusMap = {
      resolving: 'resolving',
      resolved: 'downloading',
      downloading: 'downloading',
      complete: 'complete',
      error: 'error',
    };

    row.className = `music-download-row music-download-row--${statusMap[status] || status}`;

    const statusText = row.querySelector('.music-download-row__status-text');
    const statusIcon = row.querySelector('.music-download-row__status-icon');

    const icons = {
      resolving: '<circle cx="12" cy="12" r="10"/><path d="m21 21-4.3-4.3"/>',
      downloading: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      complete: '<polyline points="20 6 9 17 4 12"/>',
      error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    };

    if (statusIcon && icons[statusMap[status]]) {
      statusIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${icons[statusMap[status]]}</svg>`;
    }

    if (statusText) {
      const texts = {
        resolving: 'Buscando en YouTube...',
        downloading: data.message || `Descargando... ${data.percent || 0}%`,
        complete: '¡Listo!',
        error: data.message || 'Error',
      };
      if (status === 'error' && data && data.message) {
        statusText.textContent = data.message;
        // Show error details button if available
        let errorBtn = row.querySelector('.music-error-btn');
        if (!errorBtn && data.details) {
          errorBtn = document.createElement('button');
          errorBtn.className = 'music-error-btn';
          errorBtn.innerHTML = 'Detalles';
          errorBtn.title = 'Ver detalles del error';
          errorBtn.onclick = () => window.showErrorModal(data.details);
          const actions = row.querySelector('.music-download-row__actions');
          if (actions) actions.appendChild(errorBtn);
        }
      } else if (status === 'complete' && data && data.filename) {
        statusText.textContent = '¡Listo!';
      } else {
        statusText.textContent = texts[statusMap[status]] || status;
      }
    }

    if (status === 'downloading' && data.percent !== undefined) {
      let progressBar = row.querySelector('.music-download-row__progress');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'music-download-row__progress';
        progressBar.innerHTML = '<div class="progress-bar"><div class="progress-bar__fill" style="width:0%"></div></div>';
        row.appendChild(progressBar);
      }
      const fill = progressBar.querySelector('.progress-bar__fill');
      if (fill) fill.style.width = `${data.percent}%`;
    }
  });

  queue.setTracks(tracksToDownload);
  await queue.start();
}

// ── Render Helpers ──

function renderLoading(message) {
  albumResultsSection.innerHTML = '';
  albumResultsSection.hidden = false;
  albumResultsSection.appendChild(createLoadingState(message));
}

function renderEmpty(message, icon) {
  albumResultsSection.innerHTML = '';
  albumResultsSection.hidden = false;
  albumResultsSection.appendChild(createEmptyState(message, icon));
}

function renderError(message, onRetry) {
  albumResultsSection.innerHTML = '';
  albumResultsSection.hidden = false;
  albumResultsSection.appendChild(createErrorState(message, onRetry));
}

/**
 * Artist Tab Controller
 *
 * Manages the full flow: search artists → select artist → show discography
 * → expand albums → select/deselect tracks → download selected.
 */

import { searchArtists, getDiscography, getAlbumTracks } from './music-api.js';
import {
  createArtistCard, createAlbumAccordion, createTrackRow,
  createLoadingState, createEmptyState, createErrorState,
  createSelectionSummary, createDownloadJobRow, createFilterPills, escapeHtml,
} from './music-ui.js';
import { DownloadQueue } from './download-queue.js';

// ── DOM References ──
const artistInput = document.getElementById('artist-input');
const artistSearchBtn = document.getElementById('artist-search-btn');
const artistResultsSection = document.getElementById('artist-results-section');

// ── State ──
let state = {
  query: '',
  artists: [],
  selectedArtist: null,
  discography: [],
  albumTracks: {},  // albumId → Track[]
  selection: {},    // albumId → { selected: boolean, indeterminate: boolean, tracks: { trackId: boolean } }
  activeFilters: new Set(),
  isLoading: false,
  phase: 'search',  // 'search' | 'artists' | 'discography' | 'downloading'
};

// ── Initialization ──

if (artistSearchBtn) {
  artistSearchBtn.addEventListener('click', handleArtistSearch);
}

if (artistInput) {
  artistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleArtistSearch();
  });
}

// ── Search Artists ──

async function handleArtistSearch() {
  const query = artistInput.value.trim();
  if (!query) return;

  state.query = query;
  state.phase = 'artists';
  state.selectedArtist = null;
  state.discography = [];
  state.albumTracks = {};
  state.selection = {};
  state.activeFilters = new Set();

  renderLoading('Buscando artistas...');

  try {
    const data = await searchArtists(query);
    state.artists = data.artists || [];

    if (state.artists.length === 0) {
      renderEmpty(`No se encontraron artistas para "${query}"`, 'search');
    } else {
      renderArtistResults();
    }
  } catch (err) {
    renderError(err.message, handleArtistSearch);
  }
}

// ── Render: Artist Results ──

function renderArtistResults() {
  artistResultsSection.innerHTML = '';
  artistResultsSection.hidden = false;

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
    artistResultsSection.innerHTML = '';
    artistResultsSection.hidden = true;
  });

  artistResultsSection.appendChild(header);

  const list = document.createElement('div');
  list.className = 'music-result-list';
  state.artists.forEach(artist => {
    list.appendChild(createArtistCard(artist, handleArtistSelected));
  });
  artistResultsSection.appendChild(list);
}

// ── Select Artist → Load Discography ──

async function handleArtistSelected(artist) {
  state.selectedArtist = artist;
  state.phase = 'discography';
  state.discography = [];
  state.albumTracks = {};
  state.selection = {};
  state.activeFilters = new Set();

  renderLoading(`Cargando discografía de ${artist.name}...`);

  try {
    const data = await getDiscography(artist.id, 0, 100);
    state.discography = data.albums || [];

    // Enrich albums with artist name
    state.discography.forEach(album => {
      album.artistName = artist.name;
      album.artistId = artist.id;
    });

    if (state.discography.length === 0) {
      renderEmpty(`No se encontró discografía para ${artist.name}`, 'album');
    } else {
      // Initialize selection: all albums selected
      state.discography.forEach(album => {
        state.selection[album.id] = { selected: true, indeterminate: false, tracks: {} };
      });
      // Initialize filters
      const uniqueTypes = new Set(state.discography.map(a => a.type).filter(Boolean));
      state.activeFilters = new Set(uniqueTypes);

      renderDiscography();
    }
  } catch (err) {
    renderError(err.message, () => handleArtistSelected(artist));
  }
}

// ── Render: Discography ──

function renderDiscography() {
  artistResultsSection.innerHTML = '';
  artistResultsSection.hidden = false;

  // Back button + artist header
  const header = document.createElement('div');
  header.className = 'music-section-header';
  header.innerHTML = `
    <button class="btn btn--ghost btn--sm music-back-btn" type="button">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Volver
    </button>
    <div class="music-artist-header">
      <h3 class="music-section-title">${escapeHtml(state.selectedArtist.name)}</h3>
      <span class="music-section-subtitle">${state.discography.length} álbumes encontrados</span>
    </div>
  `;
  header.querySelector('.music-back-btn').addEventListener('click', () => {
    renderArtistResults();
  });
  artistResultsSection.appendChild(header);

  // Filters
  const uniqueTypes = new Set(state.discography.map(a => a.type).filter(Boolean));
  if (uniqueTypes.size > 1) {
    const filtersContainer = createFilterPills(Array.from(uniqueTypes).sort(), state.activeFilters, (type) => {
      if (state.activeFilters.has(type)) {
        state.activeFilters.delete(type);
      } else {
        state.activeFilters.add(type);
      }
      renderDiscography(); // Re-render
    });
    artistResultsSection.appendChild(filtersContainer);
  }

  // Album list
  const list = document.createElement('div');
  list.className = 'album-accordion-list';

  state.discography.forEach(album => {
    if (album.type && !state.activeFilters.has(album.type)) return;

    const isChecked = state.selection[album.id]?.selected !== false;
    const accordion = createAlbumAccordion(album, {
      onToggle: handleAlbumExpand,
      onCheckChange: handleAlbumCheckChange,
      isChecked,
    });
    list.appendChild(accordion);
  });

  artistResultsSection.appendChild(list);

  // Selection summary
  updateSelectionSummary();
}

// ── Album Expand → Load Tracks ──

async function handleAlbumExpand(album, wrapper) {
  const body = wrapper.querySelector('.album-accordion__tracks');

  // Already loaded
  if (state.albumTracks[album.id]) {
    renderAlbumTracks(album, wrapper);
    return;
  }

  // Show loading inside accordion
  body.innerHTML = '';
  body.appendChild(createLoadingState('Cargando canciones...'));

  try {
    const data = await getAlbumTracks(album.id);
    state.albumTracks[album.id] = data.tracks || [];

    // Initialize track selection (all selected if album is selected)
    const albumSelected = state.selection[album.id]?.selected !== false;
    if (!state.selection[album.id]) {
      state.selection[album.id] = { selected: albumSelected, indeterminate: false, tracks: {} };
    }
    data.tracks.forEach(track => {
      if (state.selection[album.id].tracks[track.id] === undefined) {
        state.selection[album.id].tracks[track.id] = albumSelected;
      }
    });

    renderAlbumTracks(album, wrapper);
    updateSelectionSummary();
  } catch (err) {
    body.innerHTML = '';
    body.appendChild(createErrorState(err.message, () => handleAlbumExpand(album, wrapper)));
  }
}

function renderAlbumTracks(album, wrapper) {
  const body = wrapper.querySelector('.album-accordion__tracks');
  body.innerHTML = '';

  const tracks = state.albumTracks[album.id] || [];
  if (tracks.length === 0) {
    body.appendChild(createEmptyState('No se encontraron canciones', 'music'));
    return;
  }

  tracks.forEach(track => {
    // Inject album cover so createTrackRow can use it
    track.coverArtUrl = album.coverArtUrl;
    const isChecked = state.selection[album.id]?.tracks[track.id] !== false;
    
    const row = createTrackRow(track, {
      onCheckChange: (t, checked) => handleTrackCheckChange(album.id, t, checked),
      onPlay: async (t, btn, rowEl) => {
        try {
          btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';
          btn.disabled = true;
          
          const res = await fetch('/api/music/resolve-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: t.title, 
              artistName: state.selectedArtist.name, 
              albumName: album.title, 
              durationMs: t.durationMs 
            })
          });
          
          if (!res.ok) throw new Error('Video no encontrado');
          const data = await res.json();
          
          if (data.url) {
            const cover = rowEl.querySelector('.music-track-row__cover');
            if (cover && data.thumbnail) {
              cover.src = data.thumbnail;
              cover.style.display = 'block';
            }
            window.showYouTubePlayer(data.url);
          } else {
            throw new Error('No URL returned');
          }
        } catch (err) {
          console.error(err);
          alert('Error al reproducir: ' + err.message);
        } finally {
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          btn.disabled = false;
        }
      },
      isChecked,
    });
    body.appendChild(row);
  });
}

// ── Selection Logic ──

function handleAlbumCheckChange(album, checked, wrapper) {
  const sel = state.selection[album.id];
  if (!sel) return;

  sel.selected = checked;
  sel.indeterminate = false;

  // Cascade to all loaded tracks
  for (const trackId in sel.tracks) {
    sel.tracks[trackId] = checked;
  }

  // Update track checkboxes in DOM
  const trackCbs = wrapper.querySelectorAll('.music-track-cb');
  trackCbs.forEach(cb => { cb.checked = checked; });

  updateSelectionSummary();
}

function handleTrackCheckChange(albumId, track, checked) {
  const sel = state.selection[albumId];
  if (!sel) return;

  sel.tracks[track.id] = checked;

  // Recalculate album state
  const trackStates = Object.values(sel.tracks);
  const allChecked = trackStates.every(v => v);
  const noneChecked = trackStates.every(v => !v);

  sel.selected = allChecked;
  sel.indeterminate = !allChecked && !noneChecked;

  // Update album checkbox in DOM
  const wrapper = artistResultsSection.querySelector(`[data-album-id="${albumId}"]`);
  if (wrapper) {
    const albumCb = wrapper.querySelector('.album-cb');
    if (albumCb) {
      albumCb.checked = allChecked;
      albumCb.indeterminate = sel.indeterminate;
    }
  }

  updateSelectionSummary();
}

function getSelectedTracks() {
  const selected = [];

  for (const album of state.discography) {
    if (album.type && !state.activeFilters.has(album.type)) continue;

    const sel = state.selection[album.id];
    if (!sel) continue;

    const tracks = state.albumTracks[album.id];
    if (tracks) {
      // Use per-track selection
      for (const track of tracks) {
        if (sel.tracks[track.id] !== false) {
          selected.push({
            ...track,
            albumType: album.type,
            albumYear: album.year,
            albumId: album.id
          });
        }
      }
    } else if (sel.selected) {
      // Album selected but tracks not loaded — will need to load at download time
      selected.push({ albumId: album.id, albumName: album.title, artistName: album.artistName, _needsLoading: true });
    }
  }

  return selected;
}

function getTotalSelectedCount() {
  let selectedAlbums = 0;
  let selectedTracks = 0;

  for (const album of state.discography) {
    if (album.type && !state.activeFilters.has(album.type)) continue;

    const sel = state.selection[album.id];
    if (!sel) continue;

    const tracks = state.albumTracks[album.id];
    if (tracks) {
      // Album tracks are loaded
      const count = tracks.filter(t => sel.tracks[t.id] !== false).length;
      if (count > 0) {
        if (count === tracks.length) selectedAlbums++;
        else selectedTracks += count;
      }
    } else if (sel.selected) {
      // Entire album is selected but tracks aren't loaded yet
      selectedAlbums++;
    }
  }

  return { albums: selectedAlbums, tracks: selectedTracks };
}

// ── Selection Summary ──

function updateSelectionSummary() {
  // Remove existing summary
  const existing = artistResultsSection.querySelector('.music-selection-summary');
  if (existing) existing.remove();

  const { albums, tracks } = getTotalSelectedCount();
  const totalAlbums = state.discography.length;

  if (totalAlbums === 0) return;
  if (albums === 0 && tracks === 0) {
    const summary = createSelectionSummary('0 seleccionados', 'Selecciona algo para descargar', null, true);
    artistResultsSection.appendChild(summary);
    return;
  }

  let textLeft = '';
  if (albums > 0) textLeft += `${albums} álbum${albums > 1 ? 'es' : ''}`;
  if (albums > 0 && tracks > 0) textLeft += ' y ';
  if (tracks > 0) textLeft += `${tracks} canción${tracks > 1 ? 'es' : ''}`;
  textLeft += ' seleccionad' + (albums > 0 && tracks === 0 ? 'os' : 'as');

  const summary = createSelectionSummary(textLeft, `Descargar ${textLeft.replace(' seleccionados', '').replace(' seleccionadas', '')}`, handleStartDownload);
  artistResultsSection.appendChild(summary);
}

// ── Download ──

async function handleStartDownload() {
  const initialTracks = getSelectedTracks();
  
  const readyTracks = initialTracks.filter(t => !t._needsLoading);
  const needsLoading = initialTracks.filter(t => t._needsLoading);

  if (readyTracks.length === 0 && needsLoading.length === 0) return;

  const getPriority = (type) => {
    if (type === 'Album') return 3;
    if (type === 'EP') return 2;
    if (type === 'Single') return 1;
    return 0;
  };

  // Sort needsLoading so we fetch original/older albums first, guaranteeing correct deduplication priority
  needsLoading.sort((a, b) => {
    const pA = getPriority(a.albumType);
    const pB = getPriority(b.albumType);
    if (pA !== pB) return pB - pA;
    const yA = parseInt(a.albumYear) || 9999;
    const yB = parseInt(b.albumYear) || 9999;
    return yA - yB;
  });

  const seenTrackIds = new Set();
  const enqueueTracks = (tracks) => {
    const unique = [];
    for (const t of tracks) {
      if (!seenTrackIds.has(t.id)) {
        seenTrackIds.add(t.id);
        unique.push(t);
      }
    }
    return unique;
  };

  const tracksToDownload = enqueueTracks(readyTracks);
  
  state.phase = 'downloading';
  artistResultsSection.innerHTML = '';
  artistResultsSection.hidden = false;

  const header = document.createElement('div');
  header.className = 'music-section-header';
  const titleEl = document.createElement('h3');
  titleEl.className = 'music-section-title';
  titleEl.textContent = `Preparando descargas...`;
  const subtitleEl = document.createElement('span');
  subtitleEl.className = 'music-section-subtitle';
  subtitleEl.textContent = escapeHtml(state.selectedArtist?.name || '');
  header.appendChild(titleEl);
  header.appendChild(subtitleEl);
  artistResultsSection.appendChild(header);

  const list = document.createElement('div');
  list.className = 'music-download-list';
  list.id = 'artist-download-list';
  artistResultsSection.appendChild(list);

  let totalEnqueued = 0;

  const appendToDOM = (tracks) => {
    tracks.forEach(track => {
      const row = createDownloadJobRow({
        track, status: 'pending', progress: 0, error: ''
      });
      row.dataset.jobId = track.jobId;
      list.appendChild(row);
    });
    totalEnqueued += tracks.length;
    if (totalEnqueued > 0) {
      titleEl.textContent = `Descargando ${totalEnqueued} canciones`;
    }
  };

  const queue = new DownloadQueue((jobId, status, data) => {
    updateDownloadRowStatus(jobId, status, data);
  });
  
  // Start queue immediately with whatever we have ready
  queue.setTracks(tracksToDownload);
  appendToDOM(queue.tracks);
  queue.start(3); // Start workers (they will wait dynamically if isFetchingMore=true)

  // Fetch missing albums incrementally
  for (const item of needsLoading) {
    let data = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        data = await getAlbumTracks(item.albumId);
        break;
      } catch (err) {
        if (attempt === 3) console.error(`Error loading tracks for album ${item.albumId}:`, err);
        else await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (!data) continue;

    state.albumTracks[item.albumId] = data.tracks || [];
    // Initialize track selection
    data.tracks.forEach(track => {
      if (!state.selection[item.albumId].tracks[track.id]) {
        state.selection[item.albumId].tracks[track.id] = true;
      }
    });

    const newlyLoaded = [];
    data.tracks.forEach(track => {
      if (state.selection[item.albumId].tracks[track.id] !== false) {
        newlyLoaded.push({
          ...track,
          albumType: item.albumType,
          albumYear: item.albumYear,
          albumId: item.albumId
        });
      }
    });

    const uniqueNew = enqueueTracks(newlyLoaded);
    if (uniqueNew.length > 0) {
      queue.addTracks(uniqueNew);
      const initializedNew = queue.tracks.slice(-uniqueNew.length);
      appendToDOM(initializedNew);
    }
  }

  queue.finishAddingTracks();
}


function updateDownloadRowStatus(jobId, status, data) {
  if (jobId === '__queue__') {
    // Queue complete
    const header = artistResultsSection.querySelector('.music-section-title');
    if (header) header.textContent = '¡Descarga completada!';
    return;
  }

  const list = document.getElementById('artist-download-list');
  if (!list) return;

  const existingRow = list.querySelector(`[data-job-id="${jobId}"]`);
  if (!existingRow) return;

  // Map internal status to display status
  let displayStatus = status;
  if (status === 'resolved') displayStatus = 'downloading';

  const statusMap = {
    resolving: 'resolving',
    resolved: 'downloading',
    downloading: 'downloading',
    complete: 'complete',
    error: 'error',
  };

  existingRow.className = `music-download-row music-download-row--${statusMap[status] || status}`;

  const statusIcon = existingRow.querySelector('.music-download-row__status-icon');
  const statusText = existingRow.querySelector('.music-download-row__status-text');

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
      let errorBtn = existingRow.querySelector('.music-error-btn');
      if (!errorBtn && data.details) {
        errorBtn = document.createElement('button');
        errorBtn.className = 'music-error-btn';
        errorBtn.innerHTML = 'Detalles';
        errorBtn.title = 'Ver detalles del error';
        errorBtn.onclick = () => window.showErrorModal(data.details);
        const actions = existingRow.querySelector('.music-download-row__actions');
        if (actions) actions.appendChild(errorBtn);
      }
    } else if (status === 'complete' && data && data.filename) {
      statusText.textContent = '¡Listo!';
    } else {
      statusText.textContent = texts[statusMap[status]] || status;
    }
  }

  // Progress bar
  if (status === 'downloading' && data.percent !== undefined) {
    let progressBar = existingRow.querySelector('.music-download-row__progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'music-download-row__progress';
      progressBar.innerHTML = '<div class="progress-bar"><div class="progress-bar__fill" style="width:0%"></div></div>';
      existingRow.appendChild(progressBar);
    }
    const fill = progressBar.querySelector('.progress-bar__fill');
    if (fill) fill.style.width = `${data.percent}%`;
  }
}

// ── Render Helpers ──

function renderLoading(message) {
  artistResultsSection.innerHTML = '';
  artistResultsSection.hidden = false;
  artistResultsSection.appendChild(createLoadingState(message));
}

function renderEmpty(message, icon) {
  artistResultsSection.innerHTML = '';
  artistResultsSection.hidden = false;
  artistResultsSection.appendChild(createEmptyState(message, icon));
}

function renderError(message, onRetry) {
  artistResultsSection.innerHTML = '';
  artistResultsSection.hidden = false;
  artistResultsSection.appendChild(createErrorState(message, onRetry));
}

/**
 * Music UI Components
 *
 * Shared DOM-building functions used by both artist-tab and album-tab.
 * All functions return DOM elements — no direct DOM insertion.
 */

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Artist Card ──

export function createArtistCard(artist, onClick) {
  const card = document.createElement('div');
  card.className = 'music-result-card';
  card.innerHTML = `
    <div class="music-result-card__icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    </div>
    <div class="music-result-card__info">
      <div class="music-result-card__name">${escapeHtml(artist.name)}</div>
      <div class="music-result-card__meta">
        ${artist.type ? `<span class="music-badge">${escapeHtml(artist.type)}</span>` : ''}
        ${artist.country ? `<span class="music-badge music-badge--subtle">${escapeHtml(artist.country)}</span>` : ''}
        ${artist.disambiguation ? `<span class="music-result-card__disambiguation">${escapeHtml(artist.disambiguation)}</span>` : ''}
      </div>
    </div>
    <div class="music-result-card__arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  `;
  card.addEventListener('click', () => onClick(artist));
  return card;
}

// ── Album Card (for album search results) ──

export function createAlbumResultCard(album, onClick) {
  const card = document.createElement('div');
  card.className = 'music-result-card';
  card.innerHTML = `
    <img class="music-result-card__cover" src="${escapeHtml(album.coverArtUrl)}"
         alt="" loading="lazy" onerror="this.style.display='none'" />
    <div class="music-result-card__info">
      <div class="music-result-card__name">${escapeHtml(album.title)}</div>
      <div class="music-result-card__meta">
        ${album.artistName ? `<span class="music-result-card__artist-name">${escapeHtml(album.artistName)}</span>` : ''}
        ${album.type ? `<span class="music-badge">${escapeHtml(album.type)}</span>` : ''}
        ${album.year ? `<span class="music-badge music-badge--subtle">${album.year}</span>` : ''}
      </div>
    </div>
    <div class="music-result-card__arrow">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  `;
  card.addEventListener('click', () => onClick(album));
  return card;
}

// ── Album Accordion (for discography view) ──

export function createAlbumAccordion(album, { onToggle, onCheckChange, isChecked = true }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'album-accordion';
  wrapper.dataset.albumId = album.id;

  wrapper.innerHTML = `
    <div class="album-accordion__header">
      <label class="track-checkbox album-accordion__cb" onclick="event.stopPropagation()">
        <input type="checkbox" class="album-cb" data-album-id="${album.id}" ${isChecked ? 'checked' : ''}>
        <span class="checkbox-mark"></span>
      </label>
      <img class="album-accordion__cover" src="${escapeHtml(album.coverArtUrl)}"
           alt="" loading="lazy" onerror="this.style.display='none'" />
      <div class="album-accordion__info">
        <div class="album-accordion__title">${escapeHtml(album.title)}</div>
        <div class="album-accordion__meta">
          ${album.type ? `<span class="music-badge music-badge--sm">${escapeHtml(album.type)}</span>` : ''}
          ${album.year ? `<span class="music-badge music-badge--sm music-badge--subtle">${album.year}</span>` : ''}
        </div>
      </div>
      <div class="album-accordion__chevron">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
    <div class="album-accordion__body" hidden>
      <div class="album-accordion__tracks"></div>
    </div>
  `;

  const header = wrapper.querySelector('.album-accordion__header');
  const body = wrapper.querySelector('.album-accordion__body');
  const chevron = wrapper.querySelector('.album-accordion__chevron');
  const cb = wrapper.querySelector('.album-cb');

  // Toggle expand/collapse
  header.addEventListener('click', (e) => {
    if (e.target.closest('.track-checkbox')) return; // Don't toggle when clicking checkbox
    const isOpen = !body.hidden;
    body.hidden = isOpen;
    wrapper.classList.toggle('album-accordion--open', !isOpen);
    if (!isOpen && onToggle) onToggle(album, wrapper);
  });

  // Checkbox change
  cb.addEventListener('change', () => {
    if (onCheckChange) onCheckChange(album, cb.checked, wrapper);
  });

  return wrapper;
}

// ── Track Row ──

export function createTrackRow(track, { onCheckChange, isChecked = true }) {
  const row = document.createElement('div');
  row.className = 'music-track-row';
  row.dataset.trackId = track.id;

  const durationFormatted = track.durationFormatted ||
    (track.durationMs ? formatDuration(track.durationMs) : '');

  row.innerHTML = `
    <label class="track-checkbox" onclick="event.stopPropagation()">
      <input type="checkbox" class="music-track-cb" data-track-id="${track.id}" ${isChecked ? 'checked' : ''}>
      <span class="checkbox-mark"></span>
    </label>
    <span class="music-track-row__position">${track.position || ''}</span>
    <span class="music-track-row__title">${escapeHtml(track.title)}</span>
    <span class="music-track-row__duration">${durationFormatted}</span>
  `;

  const cb = row.querySelector('.music-track-cb');
  cb.addEventListener('change', () => {
    if (onCheckChange) onCheckChange(track, cb.checked);
  });

  return row;
}

// ── States ──

export function createLoadingState(message = 'Cargando...') {
  const el = document.createElement('div');
  el.className = 'music-state music-state--loading';
  el.innerHTML = `
    <div class="spinner"></div>
    <p class="music-state__message">${escapeHtml(message)}</p>
  `;
  return el;
}

export function createEmptyState(message = 'No se encontraron resultados', icon = 'search') {
  const icons = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    album: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
  };

  const el = document.createElement('div');
  el.className = 'music-state music-state--empty';
  el.innerHTML = `
    <div class="music-state__icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        ${icons[icon] || icons.search}
      </svg>
    </div>
    <p class="music-state__message">${escapeHtml(message)}</p>
  `;
  return el;
}

export function createErrorState(message, onRetry) {
  const el = document.createElement('div');
  el.className = 'music-state music-state--error';
  el.innerHTML = `
    <div class="music-state__icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    </div>
    <p class="music-state__message">${escapeHtml(message)}</p>
    ${onRetry ? '<button class="btn btn--ghost btn--sm music-state__retry">Reintentar</button>' : ''}
  `;
  if (onRetry) {
    el.querySelector('.music-state__retry').addEventListener('click', onRetry);
  }
  return el;
}

// ── Selection Summary Bar ──

export function createSelectionSummary(textLeft, textButton, onDownload, isDisabled = false) {
  const el = document.createElement('div');
  el.className = 'music-selection-summary';
  el.innerHTML = `
    <span class="music-selection-summary__count">
      ${escapeHtml(textLeft)}
    </span>
    <button class="btn btn--primary btn--glow music-selection-summary__btn" ${isDisabled ? 'disabled' : ''}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${escapeHtml(textButton)}</span>
    </button>
  `;
  if (onDownload) {
    el.querySelector('.music-selection-summary__btn').addEventListener('click', onDownload);
  }
  return el;
}

// ── Download Job Row (for the download queue UI) ──

export function createDownloadJobRow(job) {
  const row = document.createElement('div');
  row.className = `music-download-row music-download-row--${job.status}`;
  row.dataset.trackId = job.track.id;

  const statusIcons = {
    pending: '<circle cx="12" cy="12" r="10"/>',
    resolving: '<circle cx="12" cy="12" r="10"/><path d="m21 21-4.3-4.3"/>',
    downloading: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    complete: '<polyline points="20 6 9 17 4 12"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  };

  const statusTexts = {
    pending: 'En cola',
    resolving: 'Buscando en YouTube...',
    downloading: `Descargando... ${job.progress}%`,
    complete: '¡Listo!',
    error: job.error || 'Error',
  };

  row.innerHTML = `
    <div class="music-download-row__status-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        ${statusIcons[job.status]}
      </svg>
    </div>
    <div class="music-download-row__info">
      <span class="music-download-row__title">${escapeHtml(job.track.title)}</span>
      <span class="music-download-row__artist">${escapeHtml(job.track.artistName)}</span>
    </div>
    <span class="music-download-row__status-text">${statusTexts[job.status]}</span>
    ${job.status === 'downloading' ? `
      <div class="music-download-row__progress">
        <div class="progress-bar"><div class="progress-bar__fill" style="width:${job.progress}%"></div></div>
      </div>
    ` : ''}
  `;
  return row;
}

// ── Utility ──

function formatDuration(ms) {
  if (!ms) return '';
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

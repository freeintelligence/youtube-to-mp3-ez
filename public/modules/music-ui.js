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

// ── Filters ──

export function createFilterPills(types, activeTypes, onToggle) {
  const container = document.createElement('div');
  container.className = 'music-filter-pills';

  types.forEach(type => {
    const isActive = activeTypes.has(type);
    const pill = document.createElement('button');
    pill.className = `music-filter-pill ${isActive ? 'music-filter-pill--active' : ''}`;
    pill.type = 'button';
    pill.innerHTML = `
      ${isActive ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      ${escapeHtml(type)}
    `;
    pill.addEventListener('click', () => onToggle(type));
    container.appendChild(pill);
  });

  return container;
}

// ── Floating YouTube Player ──

window.showYouTubePlayer = function(url) {
  let videoId = null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      videoId = u.searchParams.get('v');
    } else if (u.hostname.includes('youtu.be')) {
      videoId = u.pathname.substring(1);
    }
  } catch (e) {
    // ignore
  }

  if (!videoId) {
    console.error('Invalid YouTube URL for player:', url);
    return;
  }

  let existing = document.getElementById('music-floating-player');
  if (existing) {
    existing.remove();
  }

  const container = document.createElement('div');
  container.id = 'music-floating-player';
  container.className = 'music-floating-player';
  container.innerHTML = `
    <div class="music-floating-player__header">
      <span class="music-floating-player__title">Reproductor</span>
      <button class="music-floating-player__close" onclick="this.parentElement.parentElement.remove()" title="Cerrar reproductor">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="music-floating-player__body">
      <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
  `;

  document.body.appendChild(container);
};

// ── Global Audio Player ──
class GlobalAudioPlayer {
  constructor() {
    this.playlist = [];
    this.currentIndex = -1;
    this.audio = new Audio();
    this.currentYouTubeUrl = null;
    
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('playing', () => this.setPlayingState(true));
    this.audio.addEventListener('pause', () => this.setPlayingState(false));

    this.createUI();
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'global-audio-player';
    this.container.className = 'global-audio-player';
    this.container.innerHTML = `
      <div class="player-info">
        <img class="player-cover" id="player-cover" src="" alt="Cover" style="display:none;" />
        <div class="player-details">
          <span class="player-title" id="player-title">--</span>
          <span class="player-artist" id="player-artist">--</span>
        </div>
      </div>
      <div class="player-controls-container">
        <div class="player-controls">
          <button class="player-btn" id="player-prev" title="Anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg>
          </button>
          <button class="player-btn play-pause" id="player-play-pause" title="Reproducir">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="player-play-icon"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" id="player-pause-icon" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          <button class="player-btn" id="player-next" title="Siguiente">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>
          </button>
        </div>
        <div class="player-progress-container">
          <span id="player-time-current">0:00</span>
          <div class="player-progress-bar" id="player-progress-bar">
            <div class="player-progress-fill" id="player-progress-fill"></div>
          </div>
          <span id="player-time-total">0:00</span>
        </div>
      </div>
      <div class="player-actions">
        <button class="player-video-btn" id="player-video-btn" title="Ver Video en la Web" style="display:none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
          Ver Video
        </button>
      </div>
    `;
    
    document.body.appendChild(this.container);

    this.container.querySelector('#player-play-pause').addEventListener('click', () => this.togglePlay());
    this.container.querySelector('#player-next').addEventListener('click', () => this.next());
    this.container.querySelector('#player-prev').addEventListener('click', () => this.prev());
    
    const progressBar = this.container.querySelector('#player-progress-bar');
    progressBar.addEventListener('click', (e) => {
      if (!this.audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.audio.currentTime = percent * this.audio.duration;
    });

    this.container.querySelector('#player-video-btn').addEventListener('click', () => {
      if (this.currentYouTubeUrl) {
        this.audio.pause();
        window.showYouTubePlayer(this.currentYouTubeUrl);
      }
    });
  }

  play(playlist, startIndex, options = {}) {
    this.playlist = playlist;
    this.currentIndex = startIndex;
    this.options = options;
    this.container.classList.add('visible');
    this.loadCurrentTrack();
  }

  showLoading(message = 'Cargando...') {
    // Pause current audio and clear source
    this.audio.pause();
    this.audio.src = '';

    const cover = this.container.querySelector('#player-cover');
    cover.style.display = 'none';

    this.container.querySelector('#player-title').textContent = message;
    this.container.querySelector('#player-artist').textContent = 'Por favor espera';
    this.setPlayingState(false);
    this.currentYouTubeUrl = null;
    this.container.querySelector('#player-video-btn').style.display = 'none';

    // Reset progress details
    this.container.querySelector('#player-time-current').textContent = '0:00';
    this.container.querySelector('#player-time-total').textContent = '0:00';
    this.container.querySelector('#player-progress-fill').style.width = '0%';
  }

  async loadCurrentTrack() {
    const track = this.playlist[this.currentIndex];
    if (!track) return;

    // Update UI immediately with what we know
    const cover = this.container.querySelector('#player-cover');
    cover.src = track.thumbnail || track.coverArtUrl || '';
    cover.style.display = cover.src ? 'block' : 'none';
    
    this.container.querySelector('#player-title').textContent = track.title;
    this.container.querySelector('#player-artist').textContent = track.artist || track.artistName || 'Desconocido';
    
    // Set loading state
    this.setPlayingState(false);
    this.currentYouTubeUrl = null;
    this.container.querySelector('#player-video-btn').style.display = 'none';

    try {
      let youtubeUrl = track.url;
      
      // If we don't have a direct URL, we must resolve it
      if (!youtubeUrl) {
        const res = await fetch('/api/music/resolve-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            trackName: track.title, 
            artistName: track.artistName || track.artist, 
            albumName: track.albumName || '', 
            durationMs: track.durationMs 
          })
        });
        if (!res.ok) throw new Error('No se pudo resolver el audio');
        const data = await res.json();
        youtubeUrl = data.url;
        
        if (data.thumbnail) {
          cover.src = data.thumbnail;
          cover.style.display = 'block';
        }
      }

      this.currentYouTubeUrl = youtubeUrl;
      this.container.querySelector('#player-video-btn').style.display = 'flex';
      
      // Stream via the new endpoint
      this.audio.src = `/api/stream?url=${encodeURIComponent(youtubeUrl)}`;
      this.audio.play();
    } catch (err) {
      console.error('Player error:', err);
      alert('Error al reproducir: ' + err.message);
    }
  }

  togglePlay() {
    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  async next() {
    if (this.currentIndex < this.playlist.length - 1) {
      this.currentIndex++;
      this.loadCurrentTrack();
    } else if (this.options && typeof this.options.onNextBoundary === 'function') {
      const result = await this.options.onNextBoundary();
      if (result) {
        this.play(result.playlist, result.index, result.options);
      }
    }
  }

  async prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadCurrentTrack();
    } else if (this.options && typeof this.options.onPrevBoundary === 'function') {
      const result = await this.options.onPrevBoundary();
      if (result) {
        this.play(result.playlist, result.index, result.options);
      }
    }
  }

  setPlayingState(isPlaying) {
    this.container.querySelector('#player-play-icon').style.display = isPlaying ? 'none' : 'block';
    this.container.querySelector('#player-pause-icon').style.display = isPlaying ? 'block' : 'none';
  }

  updateProgress() {
    const formatTime = (secs) => {
      if (isNaN(secs)) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    const current = this.audio.currentTime;
    const total = this.audio.duration;
    
    this.container.querySelector('#player-time-current').textContent = formatTime(current);
    this.container.querySelector('#player-time-total').textContent = formatTime(total);
    
    if (total) {
      const percent = (current / total) * 100;
      this.container.querySelector('#player-progress-fill').style.width = `${percent}%`;
    }
  }
}

window.globalAudioPlayer = new GlobalAudioPlayer();

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

export function createTrackRow(track, { onCheckChange, onPlay, isChecked = true }) {
  const row = document.createElement('div');
  row.className = 'music-track-row';
  row.dataset.trackId = track.id;

  const durationFormatted = track.durationFormatted ||
    (track.durationMs ? formatDuration(track.durationMs) : '');

  // SVG placeholder for missing cover
  const placeholderCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  const coverUrl = track.coverArtUrl || track.thumbnail || placeholderCover;

  row.innerHTML = `
    <label class="track-checkbox" onclick="event.stopPropagation()">
      <input type="checkbox" class="music-track-cb" data-track-id="${track.id}" ${isChecked ? 'checked' : ''}>
      <span class="checkbox-mark"></span>
    </label>
    <span class="music-track-row__position">${track.position || ''}</span>
    <img class="music-track-row__cover" src="${escapeHtml(coverUrl)}" alt="Cover" loading="lazy" />
    <span class="music-track-row__title">${escapeHtml(track.title)}</span>
    <span class="music-track-row__duration">${durationFormatted}</span>
    <button class="music-play-btn" title="Reproducir">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
  `;

  const cb = row.querySelector('.music-track-cb');
  cb.addEventListener('change', () => {
    if (onCheckChange) onCheckChange(track, cb.checked);
  });

  const playBtn = row.querySelector('.music-play-btn');
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onPlay) onPlay(track, playBtn, row);
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

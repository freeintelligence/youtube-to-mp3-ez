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
    this.isPaused = false;
    this.cancelledJobIds = new Set();
    this.createFloatingUI();
  }

  createFloatingUI() {
    // Prevent duplicate containers
    let existing = document.getElementById('floating-download-controls');
    if (existing) existing.remove();

    this.floatingContainer = document.createElement('div');
    this.floatingContainer.id = 'floating-download-controls';
    this.floatingContainer.className = 'floating-download-controls';
    this.floatingContainer.innerHTML = `
      <div class="floating-download-controls__status">
        <div class="spinner spinner--sm" id="floating-spinner"></div>
        <span class="floating-download-controls__text" id="floating-text">Descargando...</span>
      </div>
      <button class="btn btn--primary btn--sm floating-download-controls__pause" id="floating-pause-btn" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px; vertical-align: middle; display: inline-block;" id="floating-pause-icon"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 4px; vertical-align: middle; display: none;" id="floating-resume-icon"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span id="floating-pause-text" style="vertical-align: middle;">Pausar</span>
      </button>
      <button class="btn btn--ghost btn--sm floating-download-controls__cancel" id="floating-cancel-btn" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 4px; vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span style="vertical-align: middle;">Cancelar todo</span>
      </button>
    `;
    document.body.appendChild(this.floatingContainer);

    this.floatingContainer.querySelector('#floating-pause-btn').addEventListener('click', () => this.togglePause());
    this.floatingContainer.querySelector('#floating-cancel-btn').addEventListener('click', () => {
      this.cancel();
      this.hideFloatingUI();
    });
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  pause() {
    this.isPaused = true;
    this._emit('__queue__', 'paused', {});
    this.updateFloatingUI();
  }

  resume() {
    this.isPaused = false;
    this._emit('__queue__', 'resumed', {});
    this.updateFloatingUI();
  }

  updateFloatingUI() {
    const textEl = this.floatingContainer.querySelector('#floating-text');
    const spinner = this.floatingContainer.querySelector('#floating-spinner');
    const pauseIcon = this.floatingContainer.querySelector('#floating-pause-icon');
    const resumeIcon = this.floatingContainer.querySelector('#floating-resume-icon');
    const pauseText = this.floatingContainer.querySelector('#floating-pause-text');

    if (this.isPaused) {
      textEl.textContent = 'Descargas pausadas';
      spinner.style.display = 'none';
      pauseIcon.style.display = 'none';
      resumeIcon.style.display = 'inline-block';
      pauseText.textContent = 'Reanudar';
    } else {
      textEl.textContent = 'Descargando...';
      spinner.style.display = 'block';
      pauseIcon.style.display = 'inline-block';
      resumeIcon.style.display = 'none';
      pauseText.textContent = 'Pausar';
    }
  }

  showFloatingUI() {
    this.isPaused = false;
    this.updateFloatingUI();
    this.floatingContainer.classList.add('visible');
  }

  hideFloatingUI() {
    this.floatingContainer.classList.remove('visible');
  }

  /** @param {QueuedTrack[]} tracks */
  setTracks(tracks) {
    this.tracks = tracks.map(t => ({
      ...t,
      jobId: t.jobId || `${t.id}-${Math.random().toString(36).substr(2, 9)}`
    }));
    this.isCancelled = false;
    this.isPaused = false;
  }

  addTracks(newTracks) {
    const initializedTracks = newTracks.map(t => ({
      ...t,
      jobId: t.jobId || `${t.id}-${Math.random().toString(36).substr(2, 9)}`
    }));
    this.tracks.push(...initializedTracks);
  }

  finishAddingTracks() {
    this.isFetchingMore = false;
  }

  cancel() {
    this.isCancelled = true;
    this.hideFloatingUI();
  }

  cancelTrack(jobId) {
    this.cancelledJobIds.add(jobId);
    this._emit(jobId, 'error', { message: 'Descarga cancelada' });
  }

  /**
   * Process all tracks with a configurable concurrency limit.
   */
  async start(concurrency = 3, isFetchingMore = false) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isCancelled = false;
    this.isPaused = false;
    this.isFetchingMore = isFetchingMore; // Wait for more tracks dynamically if set
    this.cancelledJobIds.clear();
    this.showFloatingUI();

    let currentIndex = 0;

    const worker = async () => {
      while (!this.isCancelled) {
        if (this.isPaused) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        if (currentIndex < this.tracks.length) {
          const i = currentIndex++;
          const track = this.tracks[i];

          if (this.cancelledJobIds.has(track.jobId)) {
            continue;
          }

          await this._processTrack(track);

          // Small delay between tracks on the same worker
          if (!this.isCancelled && currentIndex < this.tracks.length) {
            await new Promise(r => setTimeout(r, 1000));
          }
        } else if (this.isFetchingMore) {
          // Wait for more tracks to be added
          await new Promise(r => setTimeout(r, 500));
        } else {
          // No more tracks and not fetching more, exit worker
          break;
        }
      }
    };

    // Start 'concurrency' number of workers
    const workers = [];
    const numWorkers = this.isFetchingMore ? concurrency : Math.min(concurrency, this.tracks.length);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    this.isRunning = false;
    this.hideFloatingUI();
    this._emit('__queue__', 'complete', {});
  }

  async _processTrack(track) {
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.isCancelled || this.cancelledJobIds.has(track.jobId)) return;

      if (attempt > 1) {
        this._emit(track.jobId, 'resolving', { message: `Reintentando (${attempt}/${maxRetries})...` });
        await new Promise(r => setTimeout(r, 2000));
      } else {
        // Step 1: Resolve YouTube candidate
        this._emit(track.jobId, 'resolving', { message: 'Buscando en YouTube...' });
      }

      if (this.isCancelled || this.cancelledJobIds.has(track.jobId)) return;

      let youtubeUrl;
      try {
        const result = await resolveTrackCandidate({
          artistName: track.artistName,
          trackName: track.title,
          albumName: track.albumName,
          durationMs: track.durationMs,
        });

        youtubeUrl = result.url;
        this._emit(track.jobId, 'resolved', {
          url: youtubeUrl,
          title: result.title,
          score: result.score,
        });
      } catch (err) {
        if (attempt === maxRetries) {
          this._emit(track.jobId, 'error', {
            message: err.message || 'No se encontró candidato en YouTube',
            details: err.stack || err.message,
          });
          return;
        }
        continue;
      }

      if (this.isCancelled || this.cancelledJobIds.has(track.jobId)) return;

      // Step 2: Download via existing /api/download endpoint (SSE)
      try {
        await this._downloadViaSSE(track, youtubeUrl);
        return; // Success, exit retry loop
      } catch (err) {
        if (attempt === maxRetries) {
          this._emit(track.jobId, 'error', {
            message: err.message || 'Error durante la descarga',
            details: err.stack || err.message,
          });
          return;
        }
      }
    }
  }

  /**
   * Calls the existing /api/download with SSE progress tracking.
   * This is the exact same flow used by the existing single/bulk tabs.
   */
  async _downloadViaSSE(track, youtubeUrl) {
    this._emit(track.jobId, 'downloading', { percent: 0, message: 'Iniciando descarga...' });

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
      if (this.isCancelled || this.cancelledJobIds.has(track.jobId)) {
        await reader.cancel();
        throw new Error('Descarga cancelada');
      }
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
              this._emit(track.jobId, 'downloading', {
                percent: data.percent,
                message: data.status,
              });
            } else if (eventType === 'complete') {
              // Trigger file download via hidden anchor
              this._triggerFileDownload(data.downloadId, data.filename);
              this._emit(track.jobId, 'complete', { filename: data.filename });
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

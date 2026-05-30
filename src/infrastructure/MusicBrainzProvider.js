/**
 * MusicBrainzProvider
 *
 * Implements MusicMetadataRepository using the MusicBrainz public API.
 * Handles rate limiting (1 req/sec), proper User-Agent, and response mapping.
 */

const { MusicMetadataRepository } = require('../domain/interfaces');
const { Artist, Album, Track } = require('../domain/entities');

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'YouTubeMP3Downloader/1.0.0 (https://github.com/example/yt-mp3)';
const RATE_LIMIT_MS = 1100; // Just above 1 request per second

class MusicBrainzProvider extends MusicMetadataRepository {
  constructor() {
    super();
    this._lastRequestTime = 0;
  }

  /**
   * Throttled fetch — enforces MusicBrainz 1 req/sec rate limit.
   * @param {string} url
   * @returns {Promise<any>}
   */
  async _fetch(url) {
    const now = Date.now();
    const elapsed = now - this._lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    this._lastRequestTime = Date.now();

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (response.status === 503) {
      // Rate limited — wait and retry once
      console.warn('[MusicBrainz] Rate limited, waiting 2s and retrying...');
      await new Promise(r => setTimeout(r, 2000));
      this._lastRequestTime = Date.now();
      const retry = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });
      if (!retry.ok) throw new Error(`MusicBrainz API error: ${retry.status}`);
      return retry.json();
    }

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /** @override */
  async searchArtists(query, limit = 10) {
    const url = `${BASE_URL}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
    const data = await this._fetch(url);

    return (data.artists || []).map(a => new Artist({
      id: a.id,
      name: a.name,
      disambiguation: a.disambiguation || '',
      type: a.type || '',
      country: a.country || '',
      score: a.score || 0,
    }));
  }

  /** @override */
  async getArtistDiscography(artistId, options = {}) {
    const { offset = 0, limit = 25 } = options;

    // Build URL — fetch all types, sort by date
    let url = `${BASE_URL}/release-group?artist=${encodeURIComponent(artistId)}&fmt=json&limit=${limit}&offset=${offset}`;

    const data = await this._fetch(url);
    const totalCount = data['release-group-count'] || 0;

    const albums = (data['release-groups'] || []).map(rg => {
      const year = rg['first-release-date'] ? rg['first-release-date'].substring(0, 4) : '';
      return new Album({
        id: rg.id,
        title: rg.title,
        artistName: '', // Will be filled by the caller if needed
        artistId,
        type: rg['primary-type'] || 'Other',
        year,
        coverArtUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
      });
    });

    // Sort by year descending (newest first)
    albums.sort((a, b) => {
      if (!a.year && !b.year) return 0;
      if (!a.year) return 1;
      if (!b.year) return -1;
      return b.year.localeCompare(a.year);
    });

    return { albums, totalCount };
  }

  /** @override */
  async searchAlbums(query, limit = 10) {
    const url = `${BASE_URL}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
    const data = await this._fetch(url);

    return (data['release-groups'] || []).map(rg => {
      const year = rg['first-release-date'] ? rg['first-release-date'].substring(0, 4) : '';
      // Extract artist name from artist-credit if available
      const artistCredit = rg['artist-credit'] || [];
      const artistName = artistCredit.map(ac => ac.name || (ac.artist && ac.artist.name) || '').join('');
      const artistId = artistCredit.length > 0 && artistCredit[0].artist ? artistCredit[0].artist.id : '';

      return new Album({
        id: rg.id,
        title: rg.title,
        artistName,
        artistId,
        type: rg['primary-type'] || 'Other',
        year,
        score: rg.score || 0,
        coverArtUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
      });
    });
  }

  /** @override */
  async getAlbumTracks(albumId) {
    // Get the first release with recordings included
    const url = `${BASE_URL}/release?release-group=${encodeURIComponent(albumId)}&inc=recordings+artist-credits&fmt=json&limit=1`;
    const data = await this._fetch(url);

    const releases = data.releases || [];
    if (releases.length === 0) {
      return { tracks: [], albumTitle: '', artistName: '' };
    }

    // Pick the first (most canonical) release
    const release = releases[0];
    const albumTitle = release.title || '';

    // Extract artist from artist-credit
    const artistCredit = release['artist-credit'] || [];
    const artistName = artistCredit.map(ac => ac.name || (ac.artist && ac.artist.name) || '').join('');

    // Flatten tracks from all media (handle multi-disc releases)
    const tracks = [];
    let globalPosition = 0;
    for (const media of (release.media || [])) {
      for (const track of (media.tracks || [])) {
        globalPosition++;
        const recording = track.recording || {};
        tracks.push(new Track({
          id: recording.id || track.id,
          title: recording.title || track.title,
          position: globalPosition,
          durationMs: track.length || recording.length || 0,
          albumName: albumTitle,
          albumId,
          artistName,
        }));
      }
    }

    return { tracks, albumTitle, artistName };
  }
}

module.exports = { MusicBrainzProvider };

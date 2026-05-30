/**
 * Domain Interfaces (Repository Contracts)
 *
 * Base classes that define the contracts for infrastructure providers.
 * Use cases depend on these interfaces, NOT on concrete implementations.
 * This enables the Open/Closed and Dependency Inversion principles.
 *
 * Concrete providers (MusicBrainz, YouTube) extend these base classes.
 */

/**
 * Contract for music metadata providers (MusicBrainz, Discogs, etc.)
 *
 * @interface
 */
class MusicMetadataRepository {
  /**
   * Search for artists by name.
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {Promise<import('./entities').Artist[]>}
   */
  async searchArtists(query, limit = 10) {
    throw new Error('MusicMetadataRepository.searchArtists() not implemented');
  }

  /**
   * Get an artist's discography (release-groups).
   * @param {string} artistId
   * @param {object} [options]
   * @param {string[]} [options.types]  - e.g. ['Album', 'EP', 'Single']
   * @param {number}   [options.offset] - Pagination offset
   * @param {number}   [options.limit]  - Page size
   * @returns {Promise<{ albums: import('./entities').Album[], totalCount: number }>}
   */
  async getArtistDiscography(artistId, options = {}) {
    throw new Error('MusicMetadataRepository.getArtistDiscography() not implemented');
  }

  /**
   * Search for albums (release-groups) by name.
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {Promise<import('./entities').Album[]>}
   */
  async searchAlbums(query, limit = 10) {
    throw new Error('MusicMetadataRepository.searchAlbums() not implemented');
  }

  /**
   * Get the track listing for a specific album (release-group).
   * Picks the best available release and extracts recordings.
   * @param {string} albumId - Release-group MBID
   * @returns {Promise<{ tracks: import('./entities').Track[], albumTitle: string, artistName: string }>}
   */
  async getAlbumTracks(albumId) {
    throw new Error('MusicMetadataRepository.getAlbumTracks() not implemented');
  }
}

/**
 * Contract for searching tracks on a streaming/video platform (YouTube, etc.)
 *
 * @interface
 */
class TrackSearchRepository {
  /**
   * Search for video/audio candidates matching the given track metadata.
   * @param {object} query
   * @param {string} query.artistName
   * @param {string} query.trackName
   * @param {string} [query.albumName]
   * @param {number} [query.durationMs] - Expected duration in ms (for matching)
   * @param {number} [limit=5]
   * @returns {Promise<CandidateResult[]>}
   */
  async searchCandidates(query, limit = 5) {
    throw new Error('TrackSearchRepository.searchCandidates() not implemented');
  }
}

/**
 * A single candidate result from a track search.
 * @typedef {object} CandidateResult
 * @property {string} id          - Video/track ID
 * @property {string} title       - Video title
 * @property {string} url         - Playable URL
 * @property {string} channel     - Channel/uploader name
 * @property {number} durationSec - Duration in seconds
 * @property {string} thumbnail   - Thumbnail URL
 */

module.exports = { MusicMetadataRepository, TrackSearchRepository };

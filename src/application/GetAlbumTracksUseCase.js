/**
 * GetAlbumTracksUseCase
 *
 * Retrieves the track listing for a specific album (release-group).
 */

class GetAlbumTracksUseCase {
  /** @param {import('../domain/interfaces').MusicMetadataRepository} metadataRepository */
  constructor(metadataRepository) {
    this.metadataRepository = metadataRepository;
  }

  /**
   * @param {string} albumId - Release-group MBID
   * @returns {Promise<{ tracks: import('../domain/entities').Track[], albumTitle: string, artistName: string }>}
   */
  async execute(albumId) {
    if (!albumId || typeof albumId !== 'string') {
      throw new Error('Se requiere el ID del álbum');
    }
    return this.metadataRepository.getAlbumTracks(albumId);
  }
}

module.exports = { GetAlbumTracksUseCase };

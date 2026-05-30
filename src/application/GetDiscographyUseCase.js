/**
 * GetDiscographyUseCase
 *
 * Retrieves the paginated discography for an artist.
 * Supports filtering by release type and pagination.
 */

class GetDiscographyUseCase {
  /** @param {import('../domain/interfaces').MusicMetadataRepository} metadataRepository */
  constructor(metadataRepository) {
    this.metadataRepository = metadataRepository;
  }

  /**
   * @param {string} artistId - MusicBrainz MBID
   * @param {object} [options]
   * @param {string[]} [options.types]  - e.g. ['Album', 'EP', 'Single']
   * @param {number}   [options.offset=0]
   * @param {number}   [options.limit=25]
   * @returns {Promise<{ albums: import('../domain/entities').Album[], totalCount: number }>}
   */
  async execute(artistId, options = {}) {
    if (!artistId || typeof artistId !== 'string') {
      throw new Error('Se requiere el ID del artista');
    }
    return this.metadataRepository.getArtistDiscography(artistId, {
      types: options.types,
      offset: options.offset || 0,
      limit: options.limit || 25,
    });
  }
}

module.exports = { GetDiscographyUseCase };

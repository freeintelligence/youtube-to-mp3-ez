/**
 * SearchAlbumsUseCase
 *
 * Searches for albums (release-groups) by name.
 */

class SearchAlbumsUseCase {
  /** @param {import('../domain/interfaces').MusicMetadataRepository} metadataRepository */
  constructor(metadataRepository) {
    this.metadataRepository = metadataRepository;
  }

  /**
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {Promise<import('../domain/entities').Album[]>}
   */
  async execute(query, limit = 10) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Se requiere un término de búsqueda');
    }
    return this.metadataRepository.searchAlbums(query.trim(), limit);
  }
}

module.exports = { SearchAlbumsUseCase };

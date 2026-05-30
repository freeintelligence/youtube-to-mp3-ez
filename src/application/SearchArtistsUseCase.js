/**
 * SearchArtistsUseCase
 *
 * Searches for artists by name using the injected metadata repository.
 * Returns a list of Artist entities.
 */

class SearchArtistsUseCase {
  /** @param {import('../domain/interfaces').MusicMetadataRepository} metadataRepository */
  constructor(metadataRepository) {
    this.metadataRepository = metadataRepository;
  }

  /**
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {Promise<import('../domain/entities').Artist[]>}
   */
  async execute(query, limit = 10) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Se requiere un término de búsqueda');
    }
    return this.metadataRepository.searchArtists(query.trim(), limit);
  }
}

module.exports = { SearchArtistsUseCase };

/**
 * ResolveTrackCandidateUseCase
 *
 * Given track metadata, searches YouTube for candidates and uses
 * TrackCandidateMatcher to pick the best match. This is the bridge
 * between music metadata and the existing download pipeline.
 */

const { TrackCandidateMatcher } = require('../domain/services/TrackCandidateMatcher');

class ResolveTrackCandidateUseCase {
  /**
   * @param {import('../domain/interfaces').TrackSearchRepository} trackSearchRepository
   * @param {TrackCandidateMatcher} [matcher] - Optional: inject for testing
   */
  constructor(trackSearchRepository, matcher = null) {
    this.trackSearchRepository = trackSearchRepository;
    this.matcher = matcher || new TrackCandidateMatcher();
  }

  /**
   * @param {object} trackInfo
   * @param {string} trackInfo.artistName
   * @param {string} trackInfo.trackName
   * @param {string} [trackInfo.albumName]
   * @param {number} [trackInfo.durationMs]
   * @returns {Promise<{ url: string, title: string, channel: string, score: number } | null>}
   */
  async execute(trackInfo) {
    const { artistName, trackName, albumName, durationMs } = trackInfo;

    if (!artistName || !trackName) {
      throw new Error('Se requiere nombre del artista y de la canción');
    }

    const candidates = await this.trackSearchRepository.searchCandidates(
      { artistName, trackName, albumName, durationMs },
      5
    );

    if (!candidates || candidates.length === 0) {
      return null;
    }

    const result = this.matcher.pickBest(candidates, {
      trackName,
      artistName,
      durationMs,
    });

    if (!result) return null;

    return {
      url: result.candidate.url,
      title: result.candidate.title,
      channel: result.candidate.channel,
      thumbnail: result.candidate.thumbnail,
      score: result.score,
    };
  }
}

module.exports = { ResolveTrackCandidateUseCase };

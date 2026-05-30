/**
 * TrackCandidateMatcher — Domain Service
 *
 * Scores YouTube search results against expected track metadata
 * to pick the best candidate for download. Encapsulates all matching
 * heuristics in a single, testable service.
 */

/** Words that indicate unwanted versions (unless present in the original track title) */
const NEGATIVE_KEYWORDS = [
  'live', 'en vivo', 'karaoke', 'cover', 'remix', 'slowed',
  'reverb', 'lyrics', 'lyric', 'extended', 'instrumental',
  'acoustic', 'concert', 'session', 'demo', 'mashup',
  'sped up', '8d audio', 'nightcore',
];

class TrackCandidateMatcher {
  /**
   * Score a single candidate against expected track metadata.
   *
   * @param {object} candidate
   * @param {string} candidate.title
   * @param {string} candidate.channel
   * @param {number} candidate.durationSec
   * @param {object} expected
   * @param {string} expected.trackName
   * @param {string} expected.artistName
   * @param {number} [expected.durationMs]
   * @returns {number} Score (higher = better match)
   */
  scoreSingle(candidate, expected) {
    let score = 0;
    const cTitle = candidate.title.toLowerCase();
    const cChannel = candidate.channel.toLowerCase();
    const trackName = expected.trackName.toLowerCase();
    const artistName = expected.artistName.toLowerCase();

    // ── Positive signals ──

    // Title contains the track name
    if (cTitle.includes(trackName)) {
      score += 30;
    } else {
      // Partial: check if most words of the track name appear
      const words = trackName.split(/\s+/).filter(w => w.length > 2);
      const matched = words.filter(w => cTitle.includes(w)).length;
      if (words.length > 0 && matched / words.length >= 0.7) {
        score += 15;
      }
    }

    // Title or channel contains artist name
    if (cTitle.includes(artistName) || cChannel.includes(artistName)) {
      score += 20;
    }

    // Duration matching (if both durations are known)
    if (expected.durationMs && candidate.durationSec) {
      const expectedSec = expected.durationMs / 1000;
      const diff = Math.abs(candidate.durationSec - expectedSec);
      if (diff <= 5) {
        score += 25;
      } else if (diff <= 15) {
        score += 20;
      } else if (diff <= 30) {
        score += 10;
      }

      // Big duration mismatch is a red flag
      if (candidate.durationSec > expectedSec * 2) {
        score -= 30;
      }
      if (candidate.durationSec < expectedSec * 0.4) {
        score -= 30;
      }
    }

    // Auto-generated "Topic" channels (e.g., "Radiohead - Topic")
    if (cChannel.includes('- topic') || cChannel.endsWith(' topic')) {
      score += 15;
    }

    // VEVO channels
    if (cChannel.includes('vevo')) {
      score += 10;
    }

    // Official content indicators
    if (cTitle.includes('official') || cTitle.includes('oficial')) {
      score += 5;
    }

    // ── Negative signals ──
    // Only penalize if the keyword is NOT part of the original track name
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (cTitle.includes(keyword) && !trackName.includes(keyword)) {
        score -= 25;
        break; // One penalty is enough
      }
    }

    return score;
  }

  /**
   * Pick the best candidate from a list.
   *
   * @param {Array<{title: string, channel: string, durationSec: number, url: string, id: string}>} candidates
   * @param {object} expected
   * @param {string} expected.trackName
   * @param {string} expected.artistName
   * @param {number} [expected.durationMs]
   * @param {number} [minScore=15] - Minimum score threshold
   * @returns {{ candidate: object, score: number } | null}
   */
  pickBest(candidates, expected, minScore = 15) {
    if (!candidates || candidates.length === 0) return null;

    let best = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const score = this.scoreSingle(candidate, expected);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (bestScore < minScore) return null;

    return { candidate: best, score: bestScore };
  }
}

module.exports = { TrackCandidateMatcher, NEGATIVE_KEYWORDS };

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { TrackCandidateMatcher } = require('../src/domain/services/TrackCandidateMatcher');

const matcher = new TrackCandidateMatcher();

describe('TrackCandidateMatcher', () => {

  describe('scoreSingle', () => {
    it('scores high for exact title + artist match', () => {
      const score = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'Radiohead - Topic', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      // title match (30) + artist in title (20) + Topic channel (15) + duration <5s (25) = 90
      assert.ok(score >= 80, `Expected high score, got ${score}`);
    });

    it('gives bonus to Topic channels', () => {
      const withTopic = matcher.scoreSingle(
        { title: 'Creep', channel: 'Radiohead - Topic', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      const withoutTopic = matcher.scoreSingle(
        { title: 'Creep', channel: 'RandomUser', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      assert.ok(withTopic > withoutTopic, 'Topic channel should score higher');
    });

    it('penalizes live versions when not in track name', () => {
      const score = matcher.scoreSingle(
        { title: 'Radiohead - Creep (Live at Glastonbury)', channel: 'Fan', durationSec: 300 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      const cleanScore = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'Fan', durationSec: 300 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      assert.ok(score < cleanScore, 'Live version should score lower');
    });

    it('does NOT penalize "live" if present in the original track name', () => {
      const score = matcher.scoreSingle(
        { title: 'Radiohead - Live From the Basement', channel: 'Fan', durationSec: 200 },
        { trackName: 'Live From the Basement', artistName: 'Radiohead', durationMs: 200000 }
      );
      // Should not be penalized
      assert.ok(score > 0, `Expected positive score, got ${score}`);
    });

    it('penalizes karaoke/cover/remix versions', () => {
      const karaoke = matcher.scoreSingle(
        { title: 'Creep - Karaoke Version', channel: 'Karaoke', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      const clean = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'Radiohead - Topic', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      assert.ok(karaoke < clean, 'Karaoke version should score much lower');
    });

    it('penalizes duration mismatch > 2x', () => {
      const score = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'Fan', durationSec: 600 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      const normalDuration = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'Fan', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      assert.ok(score < normalDuration, 'Duration 2x+ should penalize');
    });

    it('handles missing duration gracefully', () => {
      const score = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'Fan', durationSec: 0 },
        { trackName: 'Creep', artistName: 'Radiohead' }
      );
      assert.ok(score >= 0, 'Should not crash with missing durations');
    });

    it('gives VEVO channels a bonus', () => {
      const vevo = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'RadioheadVEVO', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      const regular = matcher.scoreSingle(
        { title: 'Radiohead - Creep', channel: 'RandomUser', durationSec: 239 },
        { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }
      );
      assert.ok(vevo > regular, 'VEVO should score higher');
    });
  });

  describe('pickBest', () => {
    it('picks the highest scoring candidate', () => {
      const candidates = [
        { id: '1', title: 'Creep Cover', channel: 'Fan', durationSec: 200, url: 'url1' },
        { id: '2', title: 'Radiohead - Creep', channel: 'Radiohead - Topic', durationSec: 239, url: 'url2' },
        { id: '3', title: 'Creep Remix', channel: 'DJ', durationSec: 300, url: 'url3' },
      ];
      const result = matcher.pickBest(candidates, { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 });
      assert.ok(result, 'Should return a result');
      assert.equal(result.candidate.id, '2');
    });

    it('returns null for empty candidates', () => {
      const result = matcher.pickBest([], { trackName: 'Creep', artistName: 'Radiohead' });
      assert.equal(result, null);
    });

    it('returns null when all candidates score below threshold', () => {
      const candidates = [
        { id: '1', title: 'Completely unrelated video about cooking', channel: 'CookingChannel', durationSec: 600, url: 'url1' },
      ];
      const result = matcher.pickBest(candidates, { trackName: 'Creep', artistName: 'Radiohead', durationMs: 239000 }, 50);
      assert.equal(result, null);
    });

    it('returns null for null input', () => {
      const result = matcher.pickBest(null, { trackName: 'Creep', artistName: 'Radiohead' });
      assert.equal(result, null);
    });
  });
});

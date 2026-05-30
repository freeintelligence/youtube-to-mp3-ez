/**
 * Domain Entities
 *
 * Pure data objects that represent core business concepts.
 * No dependencies on infrastructure, frameworks, or UI.
 */

class Artist {
  /**
   * @param {object} props
   * @param {string} props.id             - MusicBrainz MBID
   * @param {string} props.name
   * @param {string} [props.disambiguation] - Extra text to distinguish artists with the same name
   * @param {string} [props.type]          - 'Person' | 'Group' | 'Orchestra' | 'Choir' | etc.
   * @param {string} [props.country]       - ISO country code
   * @param {number} [props.score]         - Search relevance score (0–100)
   */
  constructor({ id, name, disambiguation = '', type = '', country = '', score = 0 }) {
    this.id = id;
    this.name = name;
    this.disambiguation = disambiguation;
    this.type = type;
    this.country = country;
    this.score = score;
  }
}

class Album {
  /**
   * @param {object} props
   * @param {string} props.id              - MusicBrainz release-group MBID
   * @param {string} props.title
   * @param {string} props.artistName
   * @param {string} [props.artistId]
   * @param {string} [props.type]          - 'Album' | 'EP' | 'Single' | 'Compilation' | 'Live' | etc.
   * @param {string} [props.year]          - First release year, e.g. '1997'
   * @param {number} [props.trackCount]    - Number of tracks (may be unknown initially)
   * @param {string} [props.coverArtUrl]   - Cover Art Archive URL
   * @param {number} [props.score]         - Search relevance score
   */
  constructor({
    id, title, artistName, artistId = '', type = 'Album',
    year = '', trackCount = 0, coverArtUrl = '', score = 0,
  }) {
    this.id = id;
    this.title = title;
    this.artistName = artistName;
    this.artistId = artistId;
    this.type = type;
    this.year = year;
    this.trackCount = trackCount;
    this.coverArtUrl = coverArtUrl;
    this.score = score;
  }
}

class Track {
  /**
   * @param {object} props
   * @param {string} props.id              - MusicBrainz recording MBID
   * @param {string} props.title
   * @param {number} [props.position]      - Track number within the album
   * @param {number} [props.durationMs]    - Duration in milliseconds
   * @param {string} [props.albumName]
   * @param {string} [props.albumId]       - Release-group MBID
   * @param {string} [props.artistName]
   * @param {string} [props.artistId]
   */
  constructor({
    id, title, position = 0, durationMs = 0,
    albumName = '', albumId = '', artistName = '', artistId = '',
  }) {
    this.id = id;
    this.title = title;
    this.position = position;
    this.durationMs = durationMs;
    this.albumName = albumName;
    this.albumId = albumId;
    this.artistName = artistName;
    this.artistId = artistId;
  }

  /** Duration formatted as m:ss */
  get durationFormatted() {
    if (!this.durationMs) return '';
    const totalSec = Math.round(this.durationMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

/** Represents a single track download attempt */
class DownloadJob {
  /**
   * @param {object} props
   * @param {Track}  props.track
   * @param {string} [props.youtubeUrl]    - Resolved YouTube URL (filled after candidate resolution)
   * @param {'pending'|'resolving'|'downloading'|'complete'|'error'} [props.status]
   * @param {string} [props.error]
   * @param {number} [props.progress]      - 0–100
   */
  constructor({ track, youtubeUrl = '', status = 'pending', error = '', progress = 0 }) {
    this.track = track;
    this.youtubeUrl = youtubeUrl;
    this.status = status;
    this.error = error;
    this.progress = progress;
  }
}

module.exports = { Artist, Album, Track, DownloadJob };

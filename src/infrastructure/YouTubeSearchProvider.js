/**
 * YouTubeSearchProvider
 *
 * Implements TrackSearchRepository using yt-dlp's ytsearch feature.
 * Reuses the youtube-dl-exec dependency already in the project.
 */

const { TrackSearchRepository } = require('../domain/interfaces');

class YouTubeSearchProvider extends TrackSearchRepository {
  /**
   * @param {Function} youtubedl - The youtube-dl-exec function (injected for testability)
   */
  constructor(youtubedl) {
    super();
    this.youtubedl = youtubedl;
  }

  /** @override */
  async searchCandidates(query, limit = 5) {
    const { artistName, trackName, albumName } = query;

    // Build a search query — include album if available for better precision
    let searchQuery = `${artistName} ${trackName}`;
    if (albumName) {
      searchQuery += ` ${albumName}`;
    }

    try {
      const result = await this.youtubedl(`ytsearch${limit}:${searchQuery}`, {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
        noCheckCertificates: true,
        skipDownload: true,
      });

      const entries = result.entries || [];

      return entries.map(entry => ({
        id: entry.id,
        title: entry.title || '',
        url: entry.url || entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
        channel: entry.uploader || entry.channel || '',
        durationSec: entry.duration || 0,
        thumbnail: (entry.thumbnails && entry.thumbnails.length > 0)
          ? entry.thumbnails[entry.thumbnails.length - 1].url
          : `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
      }));
    } catch (err) {
      console.error('[YouTubeSearch] Error searching:', err.message);
      return [];
    }
  }
}

module.exports = { YouTubeSearchProvider };

/**
 * Music Routes — Presentation Layer
 *
 * Express Router that exposes music metadata and track resolution endpoints.
 * Acts as the composition root: wires use cases with infrastructure providers.
 */

const express = require('express');
const router = express.Router();

// ── Infrastructure (concrete implementations) ──
const { MusicBrainzProvider } = require('../infrastructure/MusicBrainzProvider');
const { YouTubeSearchProvider } = require('../infrastructure/YouTubeSearchProvider');

// ── Use Cases ──
const { SearchArtistsUseCase } = require('../application/SearchArtistsUseCase');
const { GetDiscographyUseCase } = require('../application/GetDiscographyUseCase');
const { SearchAlbumsUseCase } = require('../application/SearchAlbumsUseCase');
const { GetAlbumTracksUseCase } = require('../application/GetAlbumTracksUseCase');
const { ResolveTrackCandidateUseCase } = require('../application/ResolveTrackCandidateUseCase');

// ── Composition Root ──
// Providers are instantiated once and shared across use cases.
// To swap MusicBrainz for another provider, only this section changes.
const metadataProvider = new MusicBrainzProvider();

const youtubedl = require('youtube-dl-exec');
const youtubeSearchProvider = new YouTubeSearchProvider(youtubedl);

const searchArtists = new SearchArtistsUseCase(metadataProvider);
const getDiscography = new GetDiscographyUseCase(metadataProvider);
const searchAlbums = new SearchAlbumsUseCase(metadataProvider);
const getAlbumTracks = new GetAlbumTracksUseCase(metadataProvider);
const resolveTrack = new ResolveTrackCandidateUseCase(youtubeSearchProvider);

// ── Routes ──

/**
 * GET /api/music/artists?q=radiohead
 * Search artists by name.
 */
router.get('/artists', async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: 'Parámetro "q" requerido' });

    const artists = await searchArtists.execute(q, parseInt(limit) || 10);
    return res.json({ artists });
  } catch (err) {
    console.error('[music/artists] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/music/artists/:id/discography?offset=0&limit=25
 * Get paginated discography for an artist.
 */
router.get('/artists/:id/discography', async (req, res) => {
  try {
    const { id } = req.params;
    const { offset, limit } = req.query;

    const result = await getDiscography.execute(id, {
      offset: parseInt(offset) || 0,
      limit: parseInt(limit) || 25,
    });

    return res.json(result);
  } catch (err) {
    console.error('[music/discography] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/music/albums?q=ok+computer
 * Search albums by name.
 */
router.get('/albums', async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: 'Parámetro "q" requerido' });

    const albums = await searchAlbums.execute(q, parseInt(limit) || 10);
    return res.json({ albums });
  } catch (err) {
    console.error('[music/albums] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/music/albums/:id/tracks
 * Get the track listing for a specific album.
 */
router.get('/albums/:id/tracks', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getAlbumTracks.execute(id);

    if (result.tracks.length === 0) {
      return res.status(404).json({ error: 'No se encontraron canciones para este álbum' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[music/tracks] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/music/resolve-track
 * Find the best YouTube URL for a given track.
 * Body: { artistName, trackName, albumName?, durationMs? }
 */
router.post('/resolve-track', async (req, res) => {
  try {
    const { artistName, trackName, albumName, durationMs } = req.body;

    if (!artistName || !trackName) {
      return res.status(400).json({ error: 'artistName y trackName son requeridos' });
    }

    const result = await resolveTrack.execute({ artistName, trackName, albumName, durationMs });

    if (!result) {
      return res.status(404).json({
        error: `No se encontró un candidato confiable en YouTube para "${artistName} - ${trackName}"`,
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('[music/resolve-track] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

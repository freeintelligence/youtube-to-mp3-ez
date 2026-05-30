const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { SearchArtistsUseCase } = require('../src/application/SearchArtistsUseCase');
const { GetDiscographyUseCase } = require('../src/application/GetDiscographyUseCase');
const { SearchAlbumsUseCase } = require('../src/application/SearchAlbumsUseCase');
const { GetAlbumTracksUseCase } = require('../src/application/GetAlbumTracksUseCase');
const { ResolveTrackCandidateUseCase } = require('../src/application/ResolveTrackCandidateUseCase');
const { Artist, Album, Track } = require('../src/domain/entities');

// ── Mock Repositories ──

class MockMetadataRepo {
  constructor(data = {}) {
    this._data = data;
  }
  async searchArtists(query, limit) {
    return this._data.artists || [];
  }
  async getArtistDiscography(artistId, options) {
    return this._data.discography || { albums: [], totalCount: 0 };
  }
  async searchAlbums(query, limit) {
    return this._data.albums || [];
  }
  async getAlbumTracks(albumId) {
    return this._data.albumTracks || { tracks: [], albumTitle: '', artistName: '' };
  }
}

class MockTrackSearchRepo {
  constructor(candidates = []) {
    this._candidates = candidates;
  }
  async searchCandidates(query, limit) {
    return this._candidates;
  }
}

// ── Tests ──

describe('SearchArtistsUseCase', () => {
  it('returns artists from the repository', async () => {
    const artists = [new Artist({ id: '1', name: 'Radiohead' })];
    const uc = new SearchArtistsUseCase(new MockMetadataRepo({ artists }));
    const result = await uc.execute('radiohead');
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Radiohead');
  });

  it('returns empty array when no results', async () => {
    const uc = new SearchArtistsUseCase(new MockMetadataRepo({}));
    const result = await uc.execute('nonexistent');
    assert.equal(result.length, 0);
  });

  it('throws on empty query', async () => {
    const uc = new SearchArtistsUseCase(new MockMetadataRepo({}));
    await assert.rejects(() => uc.execute(''), /término de búsqueda/);
  });

  it('throws on whitespace-only query', async () => {
    const uc = new SearchArtistsUseCase(new MockMetadataRepo({}));
    await assert.rejects(() => uc.execute('   '), /término de búsqueda/);
  });
});

describe('GetDiscographyUseCase', () => {
  it('returns albums from the repository', async () => {
    const discography = {
      albums: [new Album({ id: 'a1', title: 'OK Computer', artistName: 'Radiohead' })],
      totalCount: 1,
    };
    const uc = new GetDiscographyUseCase(new MockMetadataRepo({ discography }));
    const result = await uc.execute('artist-id');
    assert.equal(result.albums.length, 1);
    assert.equal(result.albums[0].title, 'OK Computer');
  });

  it('throws on missing artistId', async () => {
    const uc = new GetDiscographyUseCase(new MockMetadataRepo({}));
    await assert.rejects(() => uc.execute(''), /ID del artista/);
  });
});

describe('SearchAlbumsUseCase', () => {
  it('returns albums from the repository', async () => {
    const albums = [new Album({ id: 'a1', title: 'OK Computer', artistName: 'Radiohead' })];
    const uc = new SearchAlbumsUseCase(new MockMetadataRepo({ albums }));
    const result = await uc.execute('ok computer');
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'OK Computer');
  });

  it('throws on empty query', async () => {
    const uc = new SearchAlbumsUseCase(new MockMetadataRepo({}));
    await assert.rejects(() => uc.execute(''), /término de búsqueda/);
  });
});

describe('GetAlbumTracksUseCase', () => {
  it('returns tracks from the repository', async () => {
    const albumTracks = {
      tracks: [new Track({ id: 't1', title: 'Airbag', position: 1 })],
      albumTitle: 'OK Computer',
      artistName: 'Radiohead',
    };
    const uc = new GetAlbumTracksUseCase(new MockMetadataRepo({ albumTracks }));
    const result = await uc.execute('album-id');
    assert.equal(result.tracks.length, 1);
    assert.equal(result.tracks[0].title, 'Airbag');
  });

  it('throws on missing albumId', async () => {
    const uc = new GetAlbumTracksUseCase(new MockMetadataRepo({}));
    await assert.rejects(() => uc.execute(''), /ID del álbum/);
  });
});

describe('ResolveTrackCandidateUseCase', () => {
  it('returns the best YouTube match', async () => {
    const candidates = [
      { id: '1', title: 'Radiohead - Creep', channel: 'Radiohead - Topic', durationSec: 239, url: 'https://youtube.com/watch?v=1' },
    ];
    const uc = new ResolveTrackCandidateUseCase(new MockTrackSearchRepo(candidates));
    const result = await uc.execute({ artistName: 'Radiohead', trackName: 'Creep', durationMs: 239000 });
    assert.ok(result, 'Should return a result');
    assert.equal(result.url, 'https://youtube.com/watch?v=1');
  });

  it('returns null when no candidates found', async () => {
    const uc = new ResolveTrackCandidateUseCase(new MockTrackSearchRepo([]));
    const result = await uc.execute({ artistName: 'Radiohead', trackName: 'Nonexistent' });
    assert.equal(result, null);
  });

  it('throws on missing track metadata', async () => {
    const uc = new ResolveTrackCandidateUseCase(new MockTrackSearchRepo([]));
    await assert.rejects(() => uc.execute({ artistName: '', trackName: '' }), /nombre del artista/);
  });
});

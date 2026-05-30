/**
 * Music API Client
 *
 * Frontend module that wraps calls to the /api/music/ endpoints.
 * All functions return parsed JSON or throw errors.
 */

export async function searchArtists(query) {
  const res = await fetch(`/api/music/artists?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error buscando artistas');
  }
  return res.json();
}

export async function getDiscography(artistId, offset = 0, limit = 100) {
  const res = await fetch(`/api/music/artists/${encodeURIComponent(artistId)}/discography?offset=${offset}&limit=${limit}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error obteniendo discografía');
  }
  return res.json();
}

export async function searchAlbums(query) {
  const res = await fetch(`/api/music/albums?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error buscando álbumes');
  }
  return res.json();
}

export async function getAlbumTracks(albumId) {
  const res = await fetch(`/api/music/albums/${encodeURIComponent(albumId)}/tracks`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error obteniendo canciones');
  }
  return res.json();
}

export async function resolveTrackCandidate(trackInfo) {
  const res = await fetch('/api/music/resolve-track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trackInfo),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error resolviendo candidato');
  }
  return res.json();
}

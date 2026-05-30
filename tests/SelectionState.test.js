const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Tests for the album/track selection state logic.
 *
 * This models the state management used in the artist-tab frontend module.
 * We test the pure logic here, independent of DOM.
 */

// ── Selection State Helper (mirrors the logic from artist-tab.js) ──

function createSelectionState(albums, tracksByAlbum) {
  const selection = {};
  for (const album of albums) {
    const tracks = tracksByAlbum[album.id] || [];
    const trackState = {};
    tracks.forEach(t => { trackState[t.id] = true; });
    selection[album.id] = { selected: true, indeterminate: false, tracks: trackState };
  }
  return selection;
}

function toggleAlbum(selection, albumId, checked) {
  const sel = selection[albumId];
  if (!sel) return;
  sel.selected = checked;
  sel.indeterminate = false;
  for (const trackId in sel.tracks) {
    sel.tracks[trackId] = checked;
  }
}

function toggleTrack(selection, albumId, trackId, checked) {
  const sel = selection[albumId];
  if (!sel) return;
  sel.tracks[trackId] = checked;

  const trackStates = Object.values(sel.tracks);
  const allChecked = trackStates.every(v => v);
  const noneChecked = trackStates.every(v => !v);

  sel.selected = allChecked;
  sel.indeterminate = !allChecked && !noneChecked;
}

function getSelectedTracks(selection, tracksByAlbum) {
  const selected = [];
  for (const albumId in selection) {
    const sel = selection[albumId];
    const tracks = tracksByAlbum[albumId] || [];
    for (const track of tracks) {
      if (sel.tracks[track.id] !== false) {
        selected.push(track);
      }
    }
  }
  return selected;
}

// ── Test Data ──

const albums = [
  { id: 'album1', title: 'OK Computer' },
  { id: 'album2', title: 'The Bends' },
];

const tracksByAlbum = {
  album1: [
    { id: 't1', title: 'Airbag' },
    { id: 't2', title: 'Paranoid Android' },
    { id: 't3', title: 'Subterranean Homesick Alien' },
  ],
  album2: [
    { id: 't4', title: 'Planet Telex' },
    { id: 't5', title: 'The Bends' },
  ],
};

// ── Tests ──

describe('Selection State', () => {

  describe('createSelectionState', () => {
    it('all albums and tracks are selected by default', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      assert.equal(sel.album1.selected, true);
      assert.equal(sel.album1.indeterminate, false);
      assert.equal(sel.album1.tracks.t1, true);
      assert.equal(sel.album1.tracks.t2, true);
      assert.equal(sel.album1.tracks.t3, true);
      assert.equal(sel.album2.selected, true);
    });
  });

  describe('toggleAlbum', () => {
    it('unchecking an album deselects all its tracks', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleAlbum(sel, 'album1', false);
      assert.equal(sel.album1.selected, false);
      assert.equal(sel.album1.indeterminate, false);
      assert.equal(sel.album1.tracks.t1, false);
      assert.equal(sel.album1.tracks.t2, false);
      assert.equal(sel.album1.tracks.t3, false);
    });

    it('re-checking an album selects all its tracks', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleAlbum(sel, 'album1', false);
      toggleAlbum(sel, 'album1', true);
      assert.equal(sel.album1.selected, true);
      assert.equal(sel.album1.tracks.t1, true);
      assert.equal(sel.album1.tracks.t2, true);
    });

    it('does not affect other albums', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleAlbum(sel, 'album1', false);
      assert.equal(sel.album2.selected, true);
      assert.equal(sel.album2.tracks.t4, true);
    });
  });

  describe('toggleTrack', () => {
    it('unchecking one track sets album to indeterminate', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleTrack(sel, 'album1', 't2', false);
      assert.equal(sel.album1.selected, false);
      assert.equal(sel.album1.indeterminate, true);
      assert.equal(sel.album1.tracks.t1, true);
      assert.equal(sel.album1.tracks.t2, false);
      assert.equal(sel.album1.tracks.t3, true);
    });

    it('unchecking all tracks sets album to unchecked', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleTrack(sel, 'album1', 't1', false);
      toggleTrack(sel, 'album1', 't2', false);
      toggleTrack(sel, 'album1', 't3', false);
      assert.equal(sel.album1.selected, false);
      assert.equal(sel.album1.indeterminate, false);
    });

    it('re-checking all tracks restores album to fully selected', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleTrack(sel, 'album1', 't2', false);
      assert.equal(sel.album1.indeterminate, true);
      toggleTrack(sel, 'album1', 't2', true);
      assert.equal(sel.album1.selected, true);
      assert.equal(sel.album1.indeterminate, false);
    });
  });

  describe('getSelectedTracks', () => {
    it('returns all tracks when all selected', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      const selected = getSelectedTracks(sel, tracksByAlbum);
      assert.equal(selected.length, 5);
    });

    it('excludes unchecked tracks', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleTrack(sel, 'album1', 't2', false);
      const selected = getSelectedTracks(sel, tracksByAlbum);
      assert.equal(selected.length, 4);
      assert.ok(!selected.some(t => t.id === 't2'));
    });

    it('excludes entire album when unchecked', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleAlbum(sel, 'album1', false);
      const selected = getSelectedTracks(sel, tracksByAlbum);
      assert.equal(selected.length, 2);
      assert.ok(selected.every(t => t.id === 't4' || t.id === 't5'));
    });

    it('returns empty when all deselected', () => {
      const sel = createSelectionState(albums, tracksByAlbum);
      toggleAlbum(sel, 'album1', false);
      toggleAlbum(sel, 'album2', false);
      const selected = getSelectedTracks(sel, tracksByAlbum);
      assert.equal(selected.length, 0);
    });
  });
});

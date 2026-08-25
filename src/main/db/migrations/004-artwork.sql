-- Cached cover art, content-addressed.
--
-- A row is recorded even when nothing was found, with source 'none', so a track without a cover is
-- not searched again on every play. Deleting the cache directory is safe: the rows point at files
-- that are regenerated on demand.

CREATE TABLE artwork (
  id        INTEGER PRIMARY KEY,
  album_id  INTEGER REFERENCES albums(id) ON DELETE CASCADE,
  track_id  INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  source    TEXT NOT NULL,          -- 'embedded' | 'folder' | 'none'
  origin    TEXT,                   -- the file the image came from
  hash      TEXT,                   -- content hash of the image bytes
  path      TEXT,                   -- cached original
  width     INTEGER,
  height    INTEGER,
  bytes     INTEGER,
  found_at  INTEGER NOT NULL
) STRICT;

-- Art hangs off an album where there is one, and off the track otherwise, so a loose single still
-- gets a cover. Two partial indexes rather than one constraint, since either column may be null.
CREATE UNIQUE INDEX artwork_album ON artwork(album_id) WHERE album_id IS NOT NULL;
CREATE UNIQUE INDEX artwork_track ON artwork(track_id) WHERE track_id IS NOT NULL;
CREATE INDEX artwork_hash ON artwork(hash);

-- A play event is identified by its track, its instant and its kind. Without this, re-importing a
-- gmusicbrowser library appends a second copy of every play in its history.
DELETE FROM play_history
WHERE id NOT IN (SELECT MIN(id) FROM play_history GROUP BY track_id, at, kind);

CREATE UNIQUE INDEX play_history_unique ON play_history(track_id, at, kind);

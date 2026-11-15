import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fail } from './core.js';

export function createStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY, entity_id TEXT NOT NULL, kind TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, deleted INTEGER NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL, reason TEXT NOT NULL, UNIQUE(entity_id,version));
    CREATE TABLE IF NOT EXISTS originals(id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  function decode(row) { return row ? { id: row.id, kind: row.kind, data: JSON.parse(row.data), version: row.version, deleted: Boolean(row.deleted), updatedAt: row.updated_at, updatedBy: row.updated_by } : null; }
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } }
  function get(id, kind, includeDeleted = false) { const value = decode(db.prepare('SELECT * FROM entities WHERE id=? AND kind=?').get(id, kind)); if (!value || (!includeDeleted && value.deleted)) fail(404, '자료를 찾을 수 없습니다.'); return value; }
  function save(kind, id, data, version, actor, reason, deleted = false) {
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 300) fail(400, '변경 사유를 300자 이내로 입력해주세요.');
    return transaction(() => {
      const old = decode(db.prepare('SELECT * FROM entities WHERE id=? AND kind=?').get(id, kind));
      if ((old && old.version !== version) || (!old && version !== 0)) fail(409, '다른 사용자가 먼저 수정했습니다. 최신 내용을 확인해주세요.', 'VERSION_CONFLICT');
      const next = (old?.version || 0) + 1, at = new Date().toISOString(), serialized = JSON.stringify(data);
      db.prepare('INSERT INTO entities(id,kind,data,version,deleted,updated_at,updated_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,deleted=excluded.deleted,updated_at=excluded.updated_at,updated_by=excluded.updated_by').run(id, kind, serialized, next, Number(deleted), at, actor);
      db.prepare('INSERT INTO history(entity_id,kind,version,data,deleted,actor,at,reason) VALUES(?,?,?,?,?,?,?,?)').run(id, kind, next, serialized, Number(deleted), actor, at, reason.trim());
      return get(id, kind, true);
    });
  }
  return {
    db, get, save,
    version(id, kind, version) { get(id, kind, true); const row = db.prepare('SELECT data FROM history WHERE entity_id=? AND kind=? AND version=?').get(id, kind, version); if (!row) fail(404, '자료 버전을 찾을 수 없습니다.'); return JSON.parse(row.data); },
    list(kind, includeDeleted = false) { return db.prepare(`SELECT * FROM entities WHERE kind=? ${includeDeleted ? '' : 'AND deleted=0'} ORDER BY updated_at DESC,id`).all(kind).map(decode); },
    create(kind, data, actor, reason = '새 자료 등록') { return save(kind, randomUUID(), data, 0, actor, reason); },
    history(id, kind) { get(id, kind, true); return db.prepare('SELECT version,deleted,actor,at,reason FROM history WHERE entity_id=? AND kind=? ORDER BY version DESC LIMIT 100').all(id, kind); },
    restore(id, kind, targetVersion, currentVersion, actor, reason) { const row = db.prepare('SELECT data,deleted FROM history WHERE entity_id=? AND kind=? AND version=?').get(id, kind, targetVersion); if (!row) fail(404, '복구할 버전을 찾을 수 없습니다.'); return save(kind, id, JSON.parse(row.data), currentVersion, actor, reason, Boolean(row.deleted)); },
    addOriginal(name, type, bytes) { const id = randomUUID(); db.prepare('INSERT INTO originals VALUES(?,?,?,?)').run(id, name, type, bytes); return id; },
    original(id) { const row = db.prepare('SELECT * FROM originals WHERE id=?').get(id); if (!row) fail(404, '원본을 찾을 수 없습니다.'); return row; },
    removeOriginal(id) { db.prepare('DELETE FROM originals WHERE id=?').run(id); },
    meta(key, value) { if (value !== undefined) db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); const row = db.prepare('SELECT value FROM meta WHERE key=?').get(key); return row ? JSON.parse(row.value) : null; },
    replaceSource(source, records, actor, sources) {
      transaction(() => {
        const at = new Date().toISOString(), keys = new Set(records.map(r => r.id));
        const current = db.prepare("SELECT * FROM entities WHERE kind='equipment'").all().filter(row => JSON.parse(row.data).source === source);
        const write = (id, data, version, deleted) => {
          const serialized = JSON.stringify(data);
          db.prepare("INSERT INTO entities(id,kind,data,version,deleted,updated_at,updated_by) VALUES(?,'equipment',?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,deleted=excluded.deleted,updated_at=excluded.updated_at,updated_by=excluded.updated_by").run(id, serialized, version, Number(deleted), at, actor);
          db.prepare("INSERT INTO history(entity_id,kind,version,data,deleted,actor,at,reason) VALUES(?,'equipment',?,?,?,?,?,?)").run(id, version, serialized, Number(deleted), actor, at, '승인된 내부 전체 스냅샷 반영');
        };
        for (const record of records) {
          const previous = db.prepare('SELECT version FROM entities WHERE id=?').get(record.id);
          write(record.id, record.data, (previous?.version || 0) + 1, false);
        }
        for (const row of current) if (!row.deleted && !keys.has(row.id)) write(row.id, JSON.parse(row.data), row.version + 1, true);
        db.prepare("INSERT INTO meta VALUES('sources',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(sources));
      });
    },
    close() { db.close(); }
  };
}

// Datenbankschema, Öffnen und Migration älterer Datenbanken
import { DatabaseSync } from 'node:sqlite';
import { LIMITS } from '../public/config.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  creator TEXT NOT NULL,
  buyer TEXT NOT NULL,
  paypal TEXT NOT NULL DEFAULT '',
  delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  service_fee_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  close_when_ready INTEGER NOT NULL DEFAULT 0,
  ordered_at INTEGER,
  eta_at INTEGER,
  eta_minutes INTEGER,
  delivered_at INTEGER
);
CREATE TABLE IF NOT EXISTS participants (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  paid INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (round_id, user)
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user TEXT NOT NULL,
  article TEXT NOT NULL,
  akey TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  vkey TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_profiles (
  user_key TEXT PRIMARY KEY,
  paypal TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deleted_rounds (
  id INTEGER PRIMARY KEY,
  creator TEXT NOT NULL,
  restaurant TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_round ON items(round_id);
CREATE INDEX IF NOT EXISTS rounds_created ON rounds(created_at);
`;

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // Migration älterer Datenbanken (vor Einführung der Varianten)
  const cols = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
  if (!cols.includes('variant')) db.exec("ALTER TABLE items ADD COLUMN variant TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('vkey')) db.exec("ALTER TABLE items ADD COLUMN vkey TEXT NOT NULL DEFAULT ''");
  const rcols = db.prepare('PRAGMA table_info(rounds)').all().map((c) => c.name);
  if (!rcols.includes('close_when_ready')) db.exec('ALTER TABLE rounds ADD COLUMN close_when_ready INTEGER NOT NULL DEFAULT 0');
  if (!rcols.includes('ordered_at')) db.exec('ALTER TABLE rounds ADD COLUMN ordered_at INTEGER');
  if (!rcols.includes('eta_at')) db.exec('ALTER TABLE rounds ADD COLUMN eta_at INTEGER');
  if (!rcols.includes('eta_minutes')) db.exec('ALTER TABLE rounds ADD COLUMN eta_minutes INTEGER');
  if (!rcols.includes('delivered_at')) db.exec('ALTER TABLE rounds ADD COLUMN delivered_at INTEGER');
  if (!rcols.includes('service_fee_cents')) db.exec('ALTER TABLE rounds ADD COLUMN service_fee_cents INTEGER NOT NULL DEFAULT 0');
  const scols = db.prepare('PRAGMA table_info(restaurants)').all().map((c) => c.name);
  if (!scols.includes('address')) db.exec("ALTER TABLE restaurants ADD COLUMN address TEXT NOT NULL DEFAULT ''");
  const pcols = db.prepare('PRAGMA table_info(participants)').all().map((c) => c.name);
  if (!pcols.includes('approved')) db.exec('ALTER TABLE participants ADD COLUMN approved INTEGER NOT NULL DEFAULT 1');
  mergeDuplicateItems(db);
  return db;
}

/** Noch nicht bestellte Runden: gleiche Positionen eines Nutzers (Artikel, Variante, Preis) zu einer mit größerer Menge zusammenführen. */
export function mergeDuplicateItems(db) {
  const rows = db.prepare(`SELECT i.* FROM items i JOIN rounds r ON r.id = i.round_id WHERE r.ordered_at IS NULL ORDER BY i.id`).all();
  const keep = new Map();
  for (const it of rows) {
    const key = [it.round_id, it.user.toLocaleLowerCase('de'), it.akey, it.vkey, it.price_cents].join('\u0001');
    const first = keep.get(key);
    if (first && first.qty + it.qty <= LIMITS.qtyMax) {
      first.qty += it.qty;
      db.prepare('UPDATE items SET qty = ? WHERE id = ?').run(first.qty, first.id);
      db.prepare('DELETE FROM items WHERE id = ?').run(it.id);
    } else if (!first) keep.set(key, { id: it.id, qty: it.qty });
  }
}

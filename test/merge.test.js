import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, createLogic } from '../db.js';
import { mergeDuplicateItems } from '../db/schema.js';

test('mergeDuplicateItems: gleiche Positionen vor „Bestellt“ werden eine, später bestellte bleiben unberührt', () => {
  const db = openDb(':memory:');
  const logic = createLogic(db, { admins: [] });
  const open = logic.createRound('alex', { restaurant: { name: 'A', url: '', phone: '' }, buyer: 'alex', paypal: 'x', minutes: 20 });
  const sent = logic.createRound('alex', { restaurant: { name: 'B', url: '', phone: '' }, buyer: 'alex', paypal: 'x', minutes: 20 });
  const ins = db.prepare("INSERT INTO items (round_id, user, article, akey, variant, vkey, price_cents, qty) VALUES (?, 'anna', 'Pizza', 'pizza', '', '', 1100, ?)");
  ins.run(open, 1); ins.run(open, 1); ins.run(open, 9); // 1 + 1 = 2, +9 würde über 10 gehen
  ins.run(sent, 1); ins.run(sent, 1);
  db.prepare('UPDATE rounds SET ordered_at = 1 WHERE id = ?').run(sent);
  mergeDuplicateItems(db);
  const qtys = (r) => db.prepare('SELECT qty FROM items WHERE round_id = ? ORDER BY id').all(r).map((x) => x.qty);
  assert.deepEqual(qtys(open), [2, 9]);
  assert.deepEqual(qtys(sent), [1, 1]);
});

test('Gelöschte Bestellungen: nach mehr als 2 Wochen endgültig weg', () => {
  const db = openDb(':memory:');
  const logic = createLogic(db, { admins: [] });
  const mk = (name) => logic.createRound('alex', { restaurant: { name, url: '', phone: '' }, buyer: 'alex', paypal: 'x', minutes: 20 });
  const old = mk('Alt');
  const fresh = mk('Neu');
  logic.deleteRound('alex', old);
  logic.deleteRound('alex', fresh);
  const day = 24 * 60 * 60 * 1000;
  db.prepare('UPDATE deleted_rounds SET deleted_at = ? WHERE id = ?').run(Date.now() - 15 * day, old);
  db.prepare('UPDATE deleted_rounds SET deleted_at = ? WHERE id = ?').run(Date.now() - 13 * day, fresh);
  assert.deepEqual(logic.deletedRounds('alex').map((x) => x.restaurant), ['Neu'], 'Liste zeigt nur Frisches');
  assert.throws(() => logic.restoreRound('alex', old), /nicht gefunden/, 'Abgelaufenes lässt sich nicht holen');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM deleted_rounds').get().n, 1, 'Abgelaufenes ist aus der Datenbank gelöscht');
  assert.ok(logic.restoreRound('alex', fresh) > 0);
});

test('Nummern: nach endgültigem Entfernen wird die oberste Nummer wieder frei, eine Nummer unter einer höheren nicht', () => {
  const db = openDb(':memory:');
  const logic = createLogic(db, { admins: [] });
  const mk = (name) => logic.createRound('alex', { restaurant: { name, url: '', phone: '' }, buyer: 'alex', paypal: 'x', minutes: 20 });
  const a = mk('A');
  const b = mk('B');
  logic.deleteRound('alex', b); // B (oberste Nummer) liegt im Papierkorb
  assert.equal(mk('C'), b + 1, 'solange B wiederherstellbar ist, bleibt seine Nummer reserviert');
  db.prepare('DELETE FROM deleted_rounds').run(); // B endgültig weg, C belegt eine höhere Nummer
  assert.equal(mk('D'), b + 2, 'unter einer höheren belegten Nummer wird nichts wieder vergeben');
  logic.deleteRound('alex', b + 2);
  logic.deleteRound('alex', b + 1);
  db.prepare('DELETE FROM deleted_rounds').run();
  assert.equal(mk('E'), a + 1, 'ganz oben frei: die Nummern ab a+1 sind wieder zu haben');
});

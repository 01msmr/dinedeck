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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, createLogic } from '../db.js';
import { seedDemo, DEMO_NAMES } from '../demo.js';
import { beforeThisYear } from '../public/format.js';

test('seedDemo: fünf erfundene Bestellungen in verschiedenen Zuständen, nur in leerer Datenbank', () => {
  const db = openDb(':memory:');
  const logic = createLogic(db, { admins: [] });
  assert.equal(seedDemo(db, logic), true);
  const rounds = logic.listRounds('', 50);
  assert.equal(rounds.length, 5);
  const by = (name) => rounds.find((r) => r.restaurant === name);
  assert.equal(by('Pizzeria Demo').locked, false, 'offen');
  assert.equal(by('Burger Beispiel').locked && !by('Burger Beispiel').ordered, true, 'geschlossen, nicht bestellt');
  assert.equal(by('Sushi Muster').unpaid, true, 'bestellt, Zahlungen offen');
  assert.equal(by('Curry Testhausen').all_paid, true, 'geliefert und bezahlt');
  assert.equal(beforeThisYear(by('Pasta Probe').created_at), true, 'ältere Bestellung: aus dem Vorjahr (Datum mit Jahr)');
  // nur erfundene Namen
  const names = new Set();
  for (const r of rounds) for (const u of logic.roundDetail(r.id, '').users) names.add(u.user);
  for (const n of names) assert.ok(DEMO_NAMES.includes(n), `${n} ist kein Demo-Name`);
  // zweiter Aufruf ändert nichts
  assert.equal(seedDemo(db, logic), false);
  assert.equal(logic.listRounds('', 50).length, 5);
});

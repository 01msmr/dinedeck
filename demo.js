// Demo-Daten: erfundene Bestellungen mit erfundenen Namen, nur in eine leere Datenbank
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openDb, createLogic } from './db.js';

export const DEMO_NAMES = ['Alex', 'Sam', 'Jo', 'Kim', 'Robin', 'Lee'];

const MIN = 60000;
const DAY = 24 * 60 * MIN;
const PAYPAL = 'demo-beispiel-nur-zum-testen'; // erfundener Platzhalter

// Bestellungen: Restaurant, Besteller, Tage zurück, Stand und Artikel je Nutzer
const ROUNDS = [
  { restaurant: 'Pizzeria Demo', buyer: 'Alex', fee: '2,00', ago: 0, stage: 'open', ready: ['Alex', 'Sam'], items: { Alex: [['Pizza Margherita', 8.5, 1, '26 cm']], Sam: [['Pizza Salami', 9.5, 1], ['Cola', 2.5, 1]], Jo: [['Pizza Funghi', 9, 1]], Kim: [['Tiramisu', 4.5, 1]] } },
  { restaurant: 'Burger Beispiel', buyer: 'Robin', fee: '', ago: 0, stage: 'closed', ready: ['Robin', 'Lee', 'Jo'], items: { Robin: [['Cheeseburger', 7.9, 1]], Lee: [['Veggie Burger', 8.4, 1], ['Pommes', 3.2, 1]], Jo: [['Cheeseburger', 7.9, 2]] } },
  { restaurant: 'Sushi Muster', buyer: 'Kim', fee: '3,00', ago: 1, stage: 'delivered', ready: ['Kim', 'Alex', 'Sam', 'Lee'], paid: ['Alex'], items: { Kim: [['Maki Mix', 11, 1]], Alex: [['Nigiri Set', 13.5, 1]], Sam: [['Maki Mix', 11, 1], ['Misosuppe', 3.5, 1]], Lee: [['Vegetarisch Set', 12, 1]] } },
  { restaurant: 'Curry Testhausen', buyer: 'Jo', fee: '2,50', ago: 5, stage: 'delivered', ready: ['Jo', 'Robin', 'Sam'], paid: ['Robin', 'Sam'], items: { Jo: [['Linsen-Curry', 9.8, 1]], Robin: [['Hähnchen-Curry', 11.2, 1], ['Reis extra', 2, 1]], Sam: [['Linsen-Curry', 9.8, 1]] } },
];

/** Legt die Demo-Bestellungen an, wenn die Datenbank noch leer ist; true = angelegt. */
export function seedDemo(db, logic, now = Date.now()) {
  if (db.prepare('SELECT COUNT(*) AS n FROM rounds').get().n > 0) return false;
  for (const spec of ROUNDS) {
    const id = logic.createRound(spec.buyer, {
      restaurant: { name: spec.restaurant, url: 'https://example.org/speisekarte', phone: '' },
      buyer: spec.buyer,
      paypal: PAYPAL,
      delivery_fee: spec.fee,
      minutes: 20,
    });
    for (const [user, items] of Object.entries(spec.items)) {
      for (const [article, price, qty, variant] of items) logic.addItem(user, id, { article, price, qty, ...(variant ? { variant } : {}) });
    }
    for (const user of spec.ready) logic.setFlag(user, id, 'done', { value: true });
    if (spec.stage !== 'open') logic.changeTime(spec.buyer, id, { action: 'lock' });
    if (spec.stage === 'delivered') {
      logic.updateRound(spec.buyer, id, { ordered: true, eta_minutes: 40 });
      logic.updateRound(spec.buyer, id, { delivered: true });
    }
    for (const user of spec.paid ?? []) logic.setFlag(spec.buyer, id, 'paid', { user, value: true });
    if (spec.ago > 0) {
      // früherer Tag: alle Zeitpunkte um ago Tage zurückdatieren
      const shift = spec.ago * DAY;
      db.prepare('UPDATE rounds SET created_at = created_at - ?, expires_at = expires_at - ?, ordered_at = ordered_at - ?, eta_at = eta_at - ?, delivered_at = delivered_at - ? WHERE id = ?').run(shift, shift, shift, shift, shift, id);
    }
  }
  return true;
}

/** Öffnet die Datenbankdatei und legt bei Bedarf die Demo-Daten an. */
export function seedDemoFile(dbFile) {
  if (dbFile !== ':memory:') mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
  const db = openDb(dbFile);
  const done = seedDemo(db, createLogic(db, { admins: [] }));
  db.close();
  return done;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dbFile = process.env.DB_FILE ?? './data/demo.db';
  console.log(seedDemoFile(dbFile) ? `Demo-Bestellungen angelegt in ${dbFile}` : `${dbFile} ist nicht leer, nichts geändert`);
}

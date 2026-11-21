import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtRemaining, genitive, payHref, joinList, isToday, centsToInput, roundStage, owedByMe, owedToMe, shortVariant, bellStep, nbspUnits, beforeThisYear, rowsNeeded, splitRows } from '../public/format.js';
import { isCurrentRound, startRound } from '../public/group.js';

const MIN = 60000;

test('fmtRemaining: Minuten, Sekunden erst in den letzten 3 Minuten', () => {
  assert.equal(fmtRemaining(28 * MIN + 10000), '29 min');
  assert.equal(fmtRemaining(3 * MIN), '3 min');
  assert.equal(fmtRemaining(3 * MIN - 1000), '02:59');
  assert.equal(fmtRemaining(2 * MIN), '02:00');
  assert.equal(fmtRemaining(5000), '00:05');
  assert.equal(fmtRemaining(-5), '00:00');
  assert.equal(fmtRemaining(3 * 60 * MIN + 49 * MIN + 55000), '3:50 h');
  assert.equal(fmtRemaining(60 * MIN), '1:00 h');
});

test('genitive: Apostroph bei Namen auf s/ß/x/z, sonst s', () => {
  assert.equal(genitive('maria', 'de'), 'marias');
  assert.equal(genitive('Klaus', 'de'), 'Klaus’');
  assert.equal(genitive('Max', 'de'), 'Max’');
  assert.equal(genitive('Moritz', 'de'), 'Moritz’');
  assert.equal(genitive('Voß', 'de'), 'Voß’');
  assert.equal(genitive('SCHULZ', 'de'), 'SCHULZ’');
  assert.equal(genitive('Anna', 'en'), 'Anna’s');
  assert.equal(genitive('James', 'en'), 'James’');
});

test('isCurrentRound: offen oder heute angelegt', () => {
  const now = new Date(2026, 10, 7, 14).getTime();
  const at = (d, h) => new Date(2026, 10, d, h).getTime();
  assert.equal(isCurrentRound({ locked: false, created_at: at(1, 9) }, now), true);
  assert.equal(isCurrentRound({ locked: true, created_at: at(7, 9) }, now), true);
  assert.equal(isCurrentRound({ locked: true, created_at: at(6, 23) }, now), false);
});

test('isCurrentRound: der Abend zählt über Mitternacht bis 4 Uhr noch als heute', () => {
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
  const evening = { locked: true, created_at: at(7, 22, 30) };
  assert.equal(isCurrentRound(evening, at(8, 0, 30), 4), true, '0:30 Uhr: noch heute');
  assert.equal(isCurrentRound(evening, at(8, 3, 59), 4), true);
  assert.equal(isCurrentRound(evening, at(8, 5), 4), false, 'ab 4 Uhr: gestern');
});

test('startRound: neueste offene, sonst neueste von heute, sonst insgesamt neueste', () => {
  const at = (d, h) => new Date(2026, 10, d, h).getTime();
  const now = at(8, 14);
  const r = (id, day, hour, locked) => ({ id, created_at: at(day, hour), locked });
  // Liste wie vom Server: neueste zuerst
  assert.equal(startRound([r(5, 8, 13, false), r(4, 8, 12, false), r(3, 8, 9, true)], now, 4).id, 5, 'neueste offene');
  assert.equal(startRound([r(4, 8, 13, true), r(3, 8, 9, true), r(2, 5, 9, true)], now, 4).id, 4, 'keine offene: neueste von heute');
  assert.equal(startRound([r(2, 6, 12, true), r(1, 5, 9, true)], now, 4).id, 2, 'nichts von heute: insgesamt neueste');
  assert.equal(startRound([], now, 4), null);
});

import { medianMinutes } from '../public/format.js';

test('medianMinutes: Median in ganzen Minuten, leer = null', () => {
  assert.equal(medianMinutes([]), null);
  assert.equal(medianMinutes([40 * MIN]), 40);
  assert.equal(medianMinutes([50 * MIN, 30 * MIN, 40 * MIN]), 40);
  assert.equal(medianMinutes([30 * MIN, 41 * MIN]), 36);
});

import { pendingRound } from '../public/group.js';

test('pendingRound: offen oder geschlossen-unbestellt (12 h) blockiert, bestellt nicht', () => {
  const now = Date.now();
  const mk = (o) => ({ id: 1, restaurant: 'Pizza Roma', locked: false, ordered: false, created_at: now - 60000, ...o });
  assert.equal(pendingRound([mk({})], ' pizza  roma ', now, 12).id, 1);
  assert.equal(pendingRound([mk({ locked: true, ordered: true })], 'Pizza Roma', now, 12), null);
  assert.equal(pendingRound([mk({ locked: true })], 'Pizza Roma', now, 12).id, 1);
  assert.equal(pendingRound([mk({ locked: true, created_at: now - 13 * 3600000 })], 'Pizza Roma', now, 12), null);
  assert.equal(pendingRound([mk({})], 'Burger', now, 12), null);
  assert.equal(pendingRound([mk({})], '', now, 12), null);
});

test('payHref: PayPal-Name/-Link, Betrag optional, sonst kein Link', () => {
  assert.equal(payHref('alex', 1250), 'https://paypal.me/alex/12.50EUR');
  assert.equal(payHref('https://paypal.me/alex/', 500), 'https://paypal.me/alex/5.00EUR');
  assert.equal(payHref('paypal.me/alex'), 'https://paypal.me/alex', 'ohne Betrag nur die Adresse');
  assert.equal(payHref('paypal.me/alex', 0), 'https://paypal.me/alex');
  assert.equal(payHref('DE12 3456 7890'), null, 'keine PayPal-Adresse');
  assert.equal(payHref(''), null);
});

test('joinList: Komma-Liste mit „und“ vor dem letzten Eintrag', () => {
  assert.equal(joinList([], 'und'), '');
  assert.equal(joinList(['A'], 'und'), 'A');
  assert.equal(joinList(['A', 'B'], 'und'), 'A und B');
  assert.equal(joinList(['darkc', 'mister H', 'David'], 'und'), 'darkc, mister H und David');
  assert.equal(joinList(['A', 'B', 'C'], 'and'), 'A, B and C');
});

test('isToday: heute, und in der Nacht bis 4 Uhr noch der Abend davor', () => {
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
  assert.equal(isToday(at(12, 19, 49), at(12, 21), 4), true, 'gleicher Tag');
  assert.equal(isToday(at(12, 1, 3), at(12, 21), 4), true, 'heute nach Mitternacht');
  assert.equal(isToday(at(12, 19, 49), at(13, 2), 4), true, 'Nacht nach dem Abend');
  assert.equal(isToday(at(12, 19, 49), at(13, 5), 4), false, 'nach 4 Uhr ist es gestern');
  assert.equal(isToday(at(11, 12), at(12, 10), 4), false, 'gestern');
});

test('centsToInput: Cent als Eingabetext mit Komma', () => {
  assert.equal(centsToInput(1300), '13,00');
  assert.equal(centsToInput(5), '0,05');
  assert.equal(centsToInput(0), '0,00');
  assert.equal(centsToInput(9950), '99,50');
  assert.equal(centsToInput(1300, '.'), '13.00', 'Dezimalzeichen wählbar (Englisch)');
});

test('roundStage: alles bezahlt vor geliefert vor bestellt vor geschlossen', () => {
  assert.equal(roundStage({ locked: true, ordered: true, delivered: true, all_paid: true }), 'alles bezahlt');
  assert.equal(roundStage({ locked: true, ordered: true, delivered: true }), 'geliefert');
  assert.equal(roundStage({ locked: true, ordered: true }), 'bestellt');
  assert.equal(roundStage({ locked: true }), 'geschlossen');
  assert.equal(roundStage({ locked: false }), null);
});

const DAY = 86400000;
const NOW = new Date(2026, 10, 14, 12, 0).getTime();
const rounds = [
  { id: 1, ordered: true, buyer: 'bob', created_at: NOW - DAY, debts_users: ['Anna', 'clara'] },
  { id: 2, ordered: false, buyer: 'bob', created_at: NOW - DAY, debts_users: ['anna'] },
  { id: 3, ordered: true, buyer: 'anna', created_at: NOW - DAY, debts_users: ['clara'] },
  { id: 4, ordered: true, buyer: 'bob', created_at: NOW - 2 * 3600000, debts_users: ['anna'] },
  { id: 5, ordered: true, buyer: 'bob', created_at: NOW - 3 * DAY, debts_users: [] },
];

test('owedByMe: bestellt, nicht heute, ich schulde und bin nicht Besteller', () => {
  assert.deepEqual(owedByMe(rounds, 'anna', NOW, 4).map((r) => r.id), [1]);
  assert.deepEqual(owedByMe(rounds, 'nobody', NOW, 4), []);
});

test('owedToMe: bestellt, nicht heute, ich bin Besteller und es ist etwas offen', () => {
  assert.deepEqual(owedToMe(rounds, 'anna', NOW, 4).map((r) => r.id), [3]);
  assert.deepEqual(owedToMe(rounds, 'bob', NOW, 4).map((r) => r.id), [1]);
});

test('shortVariant: Füllwörter weg, „und“ wird Komma, nichts übrig bleibt leer', () => {
  assert.equal(shortVariant('Mit extra Schinken'), 'extra Schinken');
  assert.equal(shortVariant('Schinken und Pilze'), 'Schinken, Pilze');
  assert.equal(shortVariant('zusätzlich Käse'), 'Käse');
  assert.equal(shortVariant('mit Zwiebeln und zusätzlich Käse'), 'Zwiebeln, Käse');
  assert.equal(shortVariant('Mitte'), 'Mitte'); // nur ganze Wörter
  assert.equal(shortVariant('26 cm, Fladenbrot'), '26 cm, Fladenbrot');
  assert.equal(shortVariant(''), '');
  assert.equal(shortVariant('mit'), '');
});

test('bellStep: läutet je Schwelle einmal, nimmt bei verpassten die kleinste erreichte', () => {
  const at = [180000, 120000, 60000];
  assert.equal(bellStep(190000, at, Infinity), null, 'noch über 3 min');
  assert.equal(bellStep(170000, at, Infinity), 180000);
  assert.equal(bellStep(170000, at, 180000), null, 'schon geläutet');
  assert.equal(bellStep(110000, at, 180000), 120000);
  assert.equal(bellStep(110000, at, Infinity), 120000, 'Seite erst bei 1:50 geöffnet: ein Läuten');
  assert.equal(bellStep(50000, at, 120000), 60000);
  assert.equal(bellStep(50000, at, 60000), null);
  assert.equal(bellStep(0, at, Infinity), null, 'abgelaufen: keine Glocke');
  assert.equal(bellStep(0, [60000, 0], 60000), 0, 'Schwelle 0: läutet zum Ablauf');
  assert.equal(bellStep(-5000, [60000, 0], 0), null, 'nicht noch einmal');
});

test('nbspUnits: Zahl und Einheit bleiben zusammen (geschütztes Leerzeichen)', () => {
  const nb = '\u00a0';
  assert.equal(nbspUnits('26 cm, Fladenbrot'), `26${nb}cm, Fladenbrot`);
  assert.equal(nbspUnits('0,5 l und 330 ml'), `0,5${nb}l und 330${nb}ml`);
  assert.equal(nbspUnits('2 Stück'), `2${nb}Stück`);
  assert.equal(nbspUnits('26 CM'), `26${nb}CM`, 'Groß/Klein egal');
  assert.equal(nbspUnits('extra Schinken'), 'extra Schinken', 'ohne Zahl unverändert');
  assert.equal(nbspUnits('26 cmx'), '26 cmx', 'nur ganze Einheiten');
  assert.equal(nbspUnits(''), '');
  assert.equal(nbspUnits(null), '');
});

test('beforeThisYear: Bestellungen aus früheren Kalenderjahren', () => {
  const now = new Date(2026, 10, 15, 12).getTime(); // 15. 11. 2026
  assert.equal(beforeThisYear(new Date(2026, 0, 1, 0, 5).getTime(), now), false, 'Jahresanfang gehört noch dazu');
  assert.equal(beforeThisYear(new Date(2026, 9, 6).getTime(), now), false, 'Vormonat im selben Jahr: kein Jahr');
  assert.equal(beforeThisYear(new Date(2025, 11, 31, 23, 59).getTime(), now), true, 'Silvester des Vorjahrs');
  assert.equal(beforeThisYear(new Date(2024, 4, 1).getTime(), now), true, 'zwei Jahre zurück');
});

test('rowsNeeded: so wenige Zeilen wie möglich, bis jeder Name in seine Spalte passt', () => {
  assert.equal(rowsNeeded(8, 90, 800), 1, 'passt in eine Zeile');
  assert.equal(rowsNeeded(8, 110, 800), 2, '8 × 110 > 800, 4 × 110 passt');
  assert.equal(rowsNeeded(9, 110, 400), 3, 'oben 3 pro Zeile');
  assert.equal(rowsNeeded(3, 500, 200), 3, 'nie mehr Zeilen als Personen');
  assert.equal(rowsNeeded(0, 90, 800), 1);
});

test('splitRows: gleichmäßig, die oberen Zeilen bekommen den Überschuss', () => {
  assert.deepEqual(splitRows([1, 2, 3, 4, 5, 6, 7], 2), [[1, 2, 3, 4], [5, 6, 7]]);
  assert.deepEqual(splitRows([1, 2, 3, 4, 5, 6, 7, 8], 3), [[1, 2, 3], [4, 5, 6], [7, 8]]);
  assert.deepEqual(splitRows([1, 2, 3, 4], 1), [[1, 2, 3, 4]]);
  assert.deepEqual(splitRows([], 2), [[]], 'leer: eine leere Zeile');
});

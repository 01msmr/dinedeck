import { DEFAULTS } from './config.js';
import { isToday } from './format.js';

// Historie bündeln: letzte N Monate je Monat, ältere je Jahr (neueste zuerst).
export function groupHistory(rounds, now, monthsGrouped) {
  const n = new Date(now);
  const cut = new Date(n.getFullYear(), n.getMonth() - monthsGrouped + 1, 1).getTime();
  const groups = new Map();
  for (const r of [...rounds].sort((a, b) => b.created_at - a.created_at)) {
    const d = new Date(r.created_at);
    const monthly = r.created_at >= cut;
    const key = monthly ? `m${d.getFullYear()}-${d.getMonth()}` : `y${d.getFullYear()}`;
    if (!groups.has(key)) groups.set(key, { kind: monthly ? 'month' : 'year', year: d.getFullYear(), month: monthly ? d.getMonth() : null, items: [] });
    groups.get(key).items.push(r);
  }
  return [...groups.values()];
}

// „Aktuell“ = noch offen oder heute angelegt; der Abend davor zählt bis nightEndHour (4 Uhr) noch als heute.
export function isCurrentRound(r, now, nightEndHour = DEFAULTS.nightEndHour) {
  if (!r.locked) return true;
  return isToday(r.created_at, now, nightEndHour);
}

// Welche Bestellung beim Start gezeigt wird: neueste offene, sonst neueste von heute (bis 4 Uhr nachts noch der Abend davor), sonst keine – nie automatisch eine alte (Liste: neueste zuerst).
export function startRound(rounds, now, nightEndHour = DEFAULTS.nightEndHour) {
  return rounds.find((r) => !r.locked) ?? rounds.find((r) => isCurrentRound(r, now, nightEndHour)) ?? null;
}

// Bestellung desselben Restaurants, die eine neue blockiert (Regel wie db.js createRound).
export function pendingRound(rounds, name, now, blockHours) {
  const key = String(name ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
  if (!key) return null;
  return rounds.find((r) => String(r.restaurant).toLocaleLowerCase('de') === key && (!r.locked || (!r.ordered && now - r.created_at < blockHours * 3600000))) ?? null;
}

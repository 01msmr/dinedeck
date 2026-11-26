// Zentrale Werte – von Server (db.js, server.js) und Frontend gemeinsam genutzt.
// Hinweis: Fehlermeldungen in db.js nennen Grenzen im Text („1–240 Minuten“); bei Änderung dort und in i18n.js mitziehen.

/** Grenzen für Eingaben (Zeichen, Anzahl, Minuten, Euro). */
export const LIMITS = {
  userName: 32,
  restaurantName: 80,
  restaurantUrl: 300,
  restaurantPhone: 40,
  restaurantAddress: 160,
  article: 80,
  variant: 80,
  paypal: 120,
  qtyMin: 1,
  qtyMax: 10,
  deadlineMinMinutes: 1,
  deadlineMaxMinutes: 240,
  extendMaxMinutes: 120,
  etaMaxMinutes: 240,
  unorderedBlockHours: 12, // geschlossen, aber nicht bestellt: blockiert neue Bestellung so lange
  priceMaxEuro: 1000,
  feeMaxEuro: 100,
  requestBodyBytes: 64 * 1024,
};

/** Voreinstellungen. */
export const DEFAULTS = {
  deadlineMinutes: 20,
  extendMinutes: 5,
  etaMinutes: 40, // vorbelegte geschätzte Lieferzeit
  nightEndHour: 4, // bis zu dieser Uhrzeit zählt der Abend davor noch als „heute“
};

/** Kürzung der Variante in der Bestellliste (nur Anzeige). */
export const VARIANT_SHORT = {
  filler: ['mit', 'zusätzlich'], // fallen weg
  joiners: ['und'], // werden zu Komma
  units: ['mm', 'cm', 'm', 'g', 'kg', 'cl', 'dl', 'ml', 'l', 'stück', 'stk', 'st.'], // Einheiten: Zahl und Einheit werden nicht getrennt (geschütztes Leerzeichen)
};

/** Listen und Auswertungen. */
export const LISTS = {
  rounds: 60, // Bestellungen in Sidebar/Startseite
  deletedKept: 3, // so viele zuletzt gelöschte Bestellungen lassen sich wiederherstellen
  deletedKeepDays: 14, // und nur so lange, danach werden sie endgültig gelöscht
  closedShown: 10, // abgeschlossene Bestellungen auf der Startseite (mobil)
  sideWeeks: 12, // Zeitraum abgeschlossener Bestellungen in der Sidebar
  historyMonths: 12, // so viele Monate einzeln gruppiert, ältere je Jahr
  statsLast: 30, // „letzte N Bestellungen“ in der Statistik
  catalogMax: 300, // Katalogeinträge je Restaurant
  catalogMinUses: 2, // ab so vielen Bestellungen wird ein Artikel vorgeschlagen
  deliveryStatsLast: 10, // so viele letzte Lieferungen bilden die statistische Lieferzeit
  suggestMax: 5, // Vorschläge im Eingabefeld
};

/** Zeiten in Millisekunden. */
export const TIMING = {
  toastMs: 2600,
  confirmMs: 4000, // so lange bleibt eine Rückfrage im Knopf („bestellt melden?“, „zurücknehmen?“ usw.)
  undoMs: 10 * 1000, // so lange bleibt „Rückgängig“ nach dem Löschen einer Zeile
  refreshDebounceMs: 150,
  tickMs: 1000,
  lowTimeMs: 5 * 60 * 1000, // darunter wird der Countdown rot
  alarmMs: 3 * 60 * 1000, // darunter blinkt der Kopf rot (Takt: --alarm-period in style.css)
  blinkTimeMs: 10 * 60 * 1000, // von hier bis lowTimeMs pulsiert der Hintergrund der Restzeit in der Ablaufzeile
  editRevertMs: 30 * 1000, // ungespeicherte Änderung im Bestellkopf wird danach zurückgenommen
  editWarnMs: 10 * 1000, // so lange läuft der Warnbalken rückwärts
  barTickMs: 100,
  showSecondsMs: 3 * 60 * 1000, // Sekunden erst in den letzten 3 Minuten
  sseHeartbeatMs: 25000,
  sseRetryMs: 2000,
};

/** Warnton (Telefonklingeln) bei den letzten Minuten einer Frist. */
export const SOUND = {
  bellAtMs: [3].map((m) => m * 60 * 1000), // klingelt einmal, 3 min vor Ende
  file: '/sounds/old-telephone-ringing.mp3', // Aufnahme (liegt nur lokal, nicht im Repository); ohne Datei bleibt es still
  volume: 0.3, // Lautstärke (0–1)
  fileStartSec: 0, // Anfang der Aufnahme überspringen (die Datei ist schon auf das erste Klingeln gekürzt)
  ringSeconds: 1.2, // abgespielte Länge in Sekunden
  fadeSec: 0.2, // Ausblenden am Ende
};

/** Ablaufleiste. */
export const STATUS = {
  quietButtons: true, // ↩ und +5 erst beim Überfahren sichtbar (nur Geräte mit Maus); false = immer sichtbar wie vorher
};

/** Personen-Strips in „Alle Bestellungen“. */
export const STRIPS = {
  maxChars: 22, // längster Text eines roten Strips im Zahlungsblock (Zeichen), darüber wird mit „…“ gekürzt
  namePadPx: 16, // Platz je Strip neben dem Namen (Innenabstand und Trenner); reicht der Platz nicht, wird in Zeilen umbrochen
};

/** Benachrichtigung über offene Zahlungen. */
export const NOTICE = {
  showEveryLoad: false, // false: einmal je Sitzung und Stand der offenen Zahlungen; true zum Testen bei jedem Seitenaufruf
};

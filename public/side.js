// Sidebar: offene/unbezahlte und letzte 12 Wochen abgeschlossener Bestellungen, Links „Alle“ und „Statistik“ (ab 1280 px angedockt, darunter als Drawer) und globale Countdown-Badges.
import { t, locale } from '/i18n.js';
import { LISTS, TIMING, SOUND } from '/config.js';
import { ringPhone } from '/phone.js';
import { groupHistory, isCurrentRound } from '/group.js';
import { roundStage, bellPlan } from '/format.js';
import { eur, h, api, me, fmtRemaining, fmtWhen } from '/util.js';
import { allIcon, statsIcon } from '/icons.js';

const sideEl = document.getElementById('side');

let sideRounds = [];
export const groupTitle = (g) => (g.kind === 'year' ? String(g.year) : new Date(g.year, g.month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }));
export async function loadSide() {
  if (!me) return;
  const r = await api('GET', '/rounds').catch(() => null);
  if (r) {
    sideRounds = r;
    renderSide();
  }
}
export function renderSide() {
  const hash = location.hash || '#/';
  // Einheitlicher Eintrag: Name links, Stand als Pille rechts, darunter Zeit · Ersteller
  const state = (r) => {
    if (r.unpaid) { // wie „alle bezahlt“, aber Ausrufezeichen auf Rot; Handy: nur die Zahl im roten Kreis
      const n = (r.debts_users ?? []).length;
      return h('span', { class: 'side-paid', title: t('{n} unbezahlt', { n }) }, h('span', { class: 'check-circle bad', 'aria-hidden': 'true' }, h('span', { class: 'mk-excl' }, '!'), h('span', { class: 'mk-n' }, String(n))), h('span', { class: 'side-paid-txt' }, t('{n} unbezahlt', { n })));
    }
    if (!r.locked) return h('span', { class: 'badge on', 'data-expires': r.expires_at }, '…');
    const stage = roundStage(r);
    if (stage === 'alles bezahlt') return h('span', { class: 'side-paid', title: t('alle bezahlt') }, h('span', { class: 'check-circle', 'aria-hidden': 'true' }, '✓'), h('span', { class: 'side-paid-txt' }, t('alle bezahlt'))); // Häkchen im grünen Kreis, Text wie der Name (Handy: nur der Kreis)
    return h('span', { class: stage === 'geliefert' ? 'badge on' : 'badge mid' }, t(stage)); // geliefert grün wie in der Ablaufzeile
  };
  const item = (r) =>
    h(
      'a',
      { class: 'side-item' + (hash === `#/r/${r.id}` ? ' active' : ''), href: `#/r/${r.id}` },
      h('div', { class: 'side-head' }, h('span', { class: 'side-name' }, r.restaurant), state(r)),
      h('div', { class: 'sub' }, `${fmtWhen(r.created_at)} · ${r.creator}`)
    );
  const group = (title, list) => (list.length ? [h('h4', null, title), ...list.map(item)] : []);
  const now = Date.now();
  const since = now - LISTS.sideWeeks * 7 * 864e5;
  const link = (href, icon, label, extra = null) => h('a', { class: 'side-item side-link' + (hash === href ? ' active' : ''), href, 'data-tip': label, 'aria-label': label }, icon, h('span', { class: 'side-label' }, label), extra);
  const unpaidCount = sideRounds.filter((r) => r.unpaid).length;
  const countDot = unpaidCount ? h('span', { class: 'count-dot', 'aria-label': t('Bestellungen mit unbezahlten Artikeln') }, String(unpaidCount)) : null;
  const today = sideRounds.filter((r) => isCurrentRound(r, now));
  const rest = sideRounds.filter((r) => !isCurrentRound(r, now));
  const railNo = (r) => h('a', { class: 'rail-no' + (r.unpaid ? ' unpaid' : r.all_paid ? ' paid' : ''), href: `#/r/${r.id}`, 'data-tip': `${r.restaurant}${r.unpaid ? ` · ${t('{n} unbezahlt', { n: (r.debts_users ?? []).length })}` : r.all_paid ? '\u00a0\u00a0\u00a0✓' : ''}`, 'data-tone': r.unpaid ? 'unpaid' : r.all_paid ? 'paid' : '', 'aria-label': `${r.restaurant} #${r.id}` }, `#${r.id}`);
  const menuBtn = document.getElementById('menu');
  sideEl.replaceChildren(
    ...(menuBtn.parentElement === sideEl ? [menuBtn] : []), // der Hamburger lebt breit in der Leiste und bleibt beim Neuzeichnen
    // Heute: jede Bestellung einzeln (eine Bestellung hat immer genau ein Restaurant)
    ...(today.length
      ? [h('section', { class: 'side-today' }, h('h4', null, t('Heute')), ...today.map(item))]
      : [h('section', { class: 'side-today' }, h('h4', null, t('Heute')), h('span', { class: 'soft-note' }, t('noch keine Bestellung')))]), // Bereich bleibt sichtbar
    ...group(t('Unbezahlt'), rest.filter((r) => r.unpaid)),
    ...groupHistory(rest.filter((r) => r.locked && !r.unpaid && r.created_at >= since), now, LISTS.historyMonths).flatMap((g) => group(groupTitle(g), g.items)),
    // schmale Leiste (breit, zu): alle Bestellungen als „#1“; Hintergrund rot bei offenen Zahlungen, grün wenn alles bezahlt
    h('div', { class: 'rail-orders' }, ...(today.length ? [h('div', { class: 'rail-today' }, ...today.map(railNo))] : []), ...rest.map(railNo)),
    h('div', { class: 'side-foot' }, link('#/all', allIcon(), t('Alle Bestellungen'), countDot), link('#/stats', statsIcon(), t('Statistik')), h('a', { class: 'btn side-new', href: '#/new', 'data-tip': t('Neue Bestellung'), 'aria-label': t('Neue Bestellung') }, h('span', { class: 'side-plus', 'aria-hidden': 'true' }, '+'), h('span', { class: 'side-label' }, t('Neue Bestellung'))))
  );
  tickCountdowns();
}
const belledKey = 'bb_belled'; // „Fristende:zuletzt geläutete Schwelle“ (überlebt Neuladen)
let belled = { until: '', last: Infinity };
try {
  const [u, l] = (sessionStorage.getItem(belledKey) ?? '').split(':');
  if (u) belled = { until: u, last: Number(l) };
} catch {}
let seenUntil = null; // zuletzt gesehenes Fristende in dieser Ansicht; null nach Navigation
window.addEventListener('hashchange', () => { seenUntil = null; });
function ringIfDue(until, left) {
  const silent = seenUntil !== null && seenUntil !== until; // Frist hat sich unter den Augen geändert (verlängert/wieder geöffnet): kein Klingeln
  seenUntil = until;
  const last = belled.until === until ? belled.last : Infinity;
  const { step, ring } = bellPlan(left, SOUND.bellAtMs, last, silent);
  if (step === null || (ring && !ringPhone())) return; // erst „erledigt“, wenn der Browser den Ton wirklich abgespielt hat
  belled = { until, last: step };
  try { sessionStorage.setItem(belledKey, `${until}:${step}`); } catch {}
}
// Countdown-Badges (Sidebar und Startseite) – einmal global, nicht je Ansicht
export function tickCountdowns() {
  for (const el of document.querySelectorAll('[data-expires]')) {
    const left = Number(el.dataset.expires) - Date.now();
    el.textContent = left > 0 ? fmtRemaining(left) : t('abgelaufen');
    el.className = 'badge ' + (left > 0 ? (left < TIMING.lowTimeMs ? 'off' : 'on') : 'mid');
  }
  const timeEl = document.querySelector('[data-until]'); // Kopf blinkt rot, wenn die gezeigte Bestellung bald schließt
  const alarmLeft = timeEl ? Number(timeEl.dataset.until) - Date.now() : -1;
  const alarm = alarmLeft > 0 && alarmLeft <= TIMING.alarmMs;
  if (timeEl) ringIfDue(timeEl.dataset.until, alarmLeft); // Glocke bei 3, 2 und 1 min (Versuch, bis der Browser Ton erlaubt)
  document.body.classList.toggle('alarm', alarm);
  for (const el of document.querySelectorAll('[data-until]')) { // Restzeit in der Ablaufzeile: nur Text, kein Badge
    const left = Number(el.dataset.until) - Date.now();
    el.textContent = left > 0 ? fmtRemaining(left) : t('abgelaufen');
    el.classList.toggle('low', left < TIMING.lowTimeMs);
    el.classList.toggle('blink', left > TIMING.lowTimeMs && left <= TIMING.blinkTimeMs); // 10–5 min: Hintergrund pulsiert grau
    el.classList.toggle('glow', left > 0 && left <= TIMING.lowTimeMs); // 5–0 min: rot mit pulsierendem Schein
  }
}
setInterval(tickCountdowns, TIMING.tickMs);


// Sprechblase statt träger Browser-Tooltips an der schmalen Leiste: sofort, einzeilig, mit Pfeil auf das Element, in der Zustandsfarbe
const tip = h('div', { class: 'rail-tip', role: 'tooltip' });
document.body.append(tip);
const railClosed = () => matchMedia('(min-width: 80em)').matches && !document.body.classList.contains('nav-open');
function showTip(el) {
  if (!railClosed()) return;
  const r = el.getBoundingClientRect();
  tip.textContent = el.dataset.tip;
  tip.className = `rail-tip show ${el.dataset.tone ?? ''}`;
  tip.style.left = `${r.right + 12}px`;
  tip.style.top = `${r.top + r.height / 2}px`;
}
const hideTip = () => tip.classList.remove('show');
sideEl.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); else hideTip(); });
sideEl.addEventListener('mouseleave', hideTip);
sideEl.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
sideEl.addEventListener('focusout', hideTip);
sideEl.addEventListener('click', hideTip);

// Sidebar: offene/unbezahlte und letzte 12 Wochen abgeschlossener Bestellungen, Links „Alle“ und „Statistik“ (ab 1280 px angedockt, darunter als Drawer) und globale Countdown-Badges.
import { t, locale } from '/i18n.js';
import { LISTS, TIMING } from '/config.js';
import { groupHistory, isCurrentRound } from '/group.js';
import { roundStage } from '/format.js';
import { eur, h, api, me, fmtRemaining, fmtWhen } from '/util.js';

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
    if (r.unpaid) return h('span', { class: 'badge off' }, eur(r.debts_total_cents));
    if (!r.locked) return h('span', { class: 'badge on', 'data-expires': r.expires_at }, '…');
    const stage = roundStage(r);
    if (stage === 'alles bezahlt') return h('span', { class: 'side-paid' }, h('span', { class: 'check-circle', 'aria-hidden': 'true' }, '✓'), t('bezahlt')); // Häkchen im grünen Kreis, Text wie der Name
    return h('span', { class: 'badge mid' }, t(stage));
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
  const link = (href, label) => h('a', { class: 'side-item' + (hash === href ? ' active' : ''), href }, label);
  const unpaidCount = sideRounds.filter((r) => r.unpaid).length;
  const allLabel = unpaidCount ? [h('span', null, t('Alle Bestellungen')), h('span', { class: 'count-dot', title: t('Bestellungen mit unbezahlten Artikeln') }, String(unpaidCount))] : t('Alle Bestellungen');
  const today = sideRounds.filter((r) => isCurrentRound(r, now));
  const rest = sideRounds.filter((r) => !isCurrentRound(r, now));
  sideEl.replaceChildren(
    // Mehrere Bestellungen heute: nur „Heute“ (die Auswahl steht im Hauptbereich); genau eine: diese direkt
    ...(today.length > 1
      ? [
          h(
            'a',
            { class: 'side-item side-today-link' + (today.some((r) => hash === `#/r/${r.id}`) ? ' active' : ''), href: '#/' },
            h('h4', null, t('Heute')),
            h('span', { class: 'muted' }, t('{n} Bestellungen', { n: today.length }))
          ),
        ]
      : today.length
        ? [h('section', { class: 'side-today' }, h('h4', null, t('Heute')), ...today.map(item))]
        : []),
    ...group(t('Unbezahlt'), rest.filter((r) => r.unpaid)),
    ...groupHistory(rest.filter((r) => r.locked && !r.unpaid && r.created_at >= since), now, LISTS.historyMonths).flatMap((g) => group(groupTitle(g), g.items)),
    h('div', { class: 'side-foot' }, link('#/all', allLabel), link('#/stats', t('Statistik')), h('a', { class: 'btn side-new', href: '#/new' }, t('+ Neue Bestellung')))
  );
  tickCountdowns();
}
// Countdown-Badges (Sidebar und Startseite) – einmal global, nicht je Ansicht
export function tickCountdowns() {
  for (const el of document.querySelectorAll('[data-expires]')) {
    const left = Number(el.dataset.expires) - Date.now();
    el.textContent = left > 0 ? fmtRemaining(left) : t('abgelaufen');
    el.className = 'badge ' + (left > 0 ? (left < TIMING.lowTimeMs ? 'off' : 'on') : 'mid');
  }
}
setInterval(tickCountdowns, TIMING.tickMs);


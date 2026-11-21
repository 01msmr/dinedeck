// Karte „Name – Betrag – als bezahlt markieren“ im Design der Nutzerkarten (roter Streifen, graues Kopfband)
import { t } from '/i18n.js';
import { eur, h } from '/util.js';

/** Eine offene Zahlung als Nutzerkarte: links Text, rechts Betrag/Knopf, optional eine Fußzeile (rechtsbündig); `tag: 'a'` für Verweise. */
export function debtCard(left, right, { tag = 'section', foot = null, ...attrs } = {}) {
  return h(tag, { class: 'card user-card unpaid debt-card', ...attrs },
    h('div', { class: 'row between card-head' }, left, right),
    foot ? h('div', { class: 'debt-foot' }, foot) : null);
}

/** Kopfband „Offene Zahlungen – <Zusatz>“, in der Bestellung und im Overlay gleich. */
export function debtsHead(rest, count, sum, ...extra) {
  return h('div', { class: 'debts-head' + (extra.length ? ' with-pay' : '') }, h('span', { class: 'debts-head-text' }, h('span', { class: 'debts-head-main' }, `${t('Offene Zahlungen')}${count ? ` (${count})` : ''}`), ' ', h('span', { class: 'debts-head-rest' }, `– ${rest}`), sum != null ? h('span', { class: 'debts-head-sum' }, `∑ ${eur(sum)}`) : null), ...extra);
}

/** Eintrag im Overlay: roter Chip (Name, Betrag) wie in der Bestellung, darunter außerhalb Restaurant und Datum; Verweis auf die Bestellung. */
export function debtLinkChip(left, right, caption, attrs) {
  return h('a', { class: 'debt-entry', ...attrs },
    h('div', { class: 'debt-chip' }, h('strong', null, left), h('strong', null, right)),
    h('div', { class: 'debt-caption' }, caption));
}

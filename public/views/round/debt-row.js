// Karte „Name – Betrag – als bezahlt markieren“ im Design der Nutzerkarten (roter Streifen, graues Kopfband)
import { t } from '/i18n.js';
import { eur, h } from '/util.js';

/** Eine offene Zahlung als Nutzerkarte: links Text, rechts Betrag/Knopf, optional eine Fußzeile (rechtsbündig); `tag: 'a'` für Verweise. */
export function debtCard(left, right, { tag = 'section', foot = null, ...attrs } = {}) {
  return h(tag, { class: 'card user-card unpaid debt-card', ...attrs },
    h('div', { class: 'row between card-head' }, left, right),
    foot ? h('div', { class: 'debt-foot' }, foot) : null);
}

// Status der Bestellung: offene Zahlung als roter Chip (Markierungsfarbe) mit Knopf darin; zweistufig: erst Rückfrage „ist bezahlt?“
export function debtChipEl(x, { asking, onClick }) {
  return h('div', { class: 'debt-chip' },
    h('strong', null, x.user),
    h('strong', null, eur(x.amount_cents)),
    onClick ? h('button', { class: 'debt-pay' + (asking ? ' confirm' : ''), type: 'button', onclick: onClick }, asking ? t('ist bezahlt?') : t('als bezahlt markieren')) : null);
}

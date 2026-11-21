// Bezahlstand als Uhr-Kreis mit Personen-Strips: Zeile in „Alle Bestellungen“ und Block „Offene Zahlungen“ in der Bestellung
import { t } from '/i18n.js';
import { STRIPS } from '/config.js';
import { rowsNeeded, splitRows } from '/format.js';
import { h } from '/util.js';

/** Bezahlte zuerst, sonst die Reihenfolge wie im Tab „Alle“. */
export const paidFirst = (payers) => [...payers].sort((a, b) => Number(b.paid) - Number(a.paid));

/** Kreis vor der Zeile: offen = Sektor ab 6 Uhr mit der Zahl der Unbezahlten, alle bezahlt = grün mit Haken. */
export function payMark(payers) {
  const paidN = payers.filter((p) => p.paid).length;
  const open = paidN < payers.length;
  const label = `${t('bezahlt')}: ${paidN}/${payers.length}`;
  return h('span', { class: 'pay-mark ' + (open ? 'ring' : 'done'), style: `--paid: ${(100 * paidN) / payers.length}%; --mid: ${(180 * paidN) / payers.length}deg${paidN ? '' : '; --count-r: 0rem'}`, title: label, role: 'img', 'aria-label': label }, open ? h('span', { class: 'pay-count' }, String(payers.length - paidN)) : '✓');
}

/** Strips je Person (bezahlt links); `label(p)` ist der Text, `pick(p)` liefert bei offenen Personen eine Klick-Funktion oder null. Reicht die Breite nicht, werden die Namen auf Zeilen verteilt (oben ggf. einer mehr). */
export function payStrips(payers, label, pick = null) {
  if (payers.every((p) => p.paid)) return h('div', { class: 'pstrips' }, h('div', { class: 'prow all-paid' }, h('span', { class: 'paid-pill' }, `✓ ${t('alle bezahlt')}`))); // alle bezahlt: keine Personen, nur die Pille rechts unten
  const rowOf = (list) => h('div', { class: 'prow' }, ...list.flatMap((p, i) => {
    const onclick = !p.paid && pick ? pick(p) : null;
    return [
      i > 0 ? h('span', { class: 'psep ' + (list[i - 1].paid === p.paid ? 'line' : 'gap') }) : null,
      h(onclick ? 'button' : 'span', { class: 'pseg ' + (p.paid ? 'paid' : 'open'), type: onclick ? 'button' : null, onclick }, h('span', { class: 'pseg-name' }, label(p))),
    ];
  }));
  const strips = h('div', { class: 'pstrips' });
  let rows = 0;
  const draw = (n) => {
    rows = n;
    const list = splitRows(payers, n);
    strips.replaceChildren(...list.map(rowOf));
    // Lage des Spalts bezahlt/offen für das Kopfband: erste Zeile, in der beide Stände vorkommen
    const mixed = list.find((r) => r.some((p) => p.paid) && r.some((p) => !p.paid));
    const bar = strips.closest('.bar');
    if (bar && mixed) { bar.style.setProperty('--gk', mixed.filter((p) => p.paid).length); bar.style.setProperty('--gn', mixed.length); }
  };
  draw(1);
  new ResizeObserver(() => {
    const width = strips.clientWidth;
    const need = Math.max(0, ...[...strips.querySelectorAll('.pseg-name')].map((e) => e.scrollWidth)) + STRIPS.namePadPx;
    const n = width ? rowsNeeded(payers.length, need, width) : rows;
    if (n !== rows) draw(n);
  }).observe(strips);
  return strips;
}

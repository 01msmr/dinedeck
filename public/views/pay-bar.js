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

/** Startwerte für die Lage des Spalts im Kopfband (eine Zeile): bezahlte Strips zusammengelegt (`merge`) haben untereinander keine Trennlinien. */
export function gapStyle(payers, merge = false) {
  const k = payers.filter((p) => p.paid).length;
  const n = payers.length;
  return `--gk: ${k}; --gn: ${n}; --gt: ${merge ? n - k - 1 : n - 2}; --gb: ${merge ? 0 : k - 1}`;
}

/** Variablen für den Zahlungsblock (eine Zeile): Rote gleich breit, so breit wie der längste Text (höchstens STRIPS.maxChars Zeichen); der Spalt oben liegt genau auf dem unten. */
export function mergedVars(payers, label, nameLabel = label) { // nameLabel: schmale Geräte zeigen nur den Namen, ohne Betrag
  const open = payers.filter((p) => !p.paid);
  const chars = Math.min(Math.max(0, ...open.map((p) => label(p).length)), STRIPS.maxChars);
  const red = payers.length > open.length ? 'max(min(calc(var(--nred) * var(--sw) + (var(--nred) - 1) * var(--seg-line-w) + var(--seg-gap)), 72%), var(--red-min, 0px))' : '100%';
  const charsName = Math.min(Math.max(0, ...open.map((p) => nameLabel(p).length)), STRIPS.maxChars);
  return `--strip-w-full: calc(${chars}ch + 1.25rem); --strip-w-name: calc(${charsName}ch + 1.25rem); --nred: ${open.length}; --red-w: ${red}`;
}

/**
 * Strips je Person (bezahlt links); `label(p)` ist der Text, `pick(p)` liefert bei offenen Personen eine Klick-Funktion oder null.
 * Mit `merge(n)` bilden die Bezahlten einen einzigen Strip ohne Trennlinien (Text optional: `merge` kann null liefern); zum roten Bereich bleibt der Spalt.
 * `detail(p)` ist ein Zusatz hinter dem Namen (Betrag), der auf schmalen Geräten ausgeblendet wird.
 * Reicht die Breite nicht, werden die Namen auf Zeilen verteilt (oben ggf. einer mehr).
 */
export function payStrips(payers, label, pick = null, merge = null, detail = null) {
  if (merge) { // eine Zeile: Bezahlte als ein Strip vorn, dahinter die Unbezahlten gleich breit; die Namen werden bei Bedarf mit „…“ gekürzt
    const paid = payers.filter((p) => p.paid);
    const open = payers.filter((p) => !p.paid);
    const owed = paid.filter((p) => !p.isBuyer).length;
    const openSeg = (p) => {
      const onclick = pick ? pick(p) : null;
      return h(onclick ? 'button' : 'span', { class: 'pseg open', type: onclick ? 'button' : null, onclick }, h('span', { class: 'pseg-name' }, label(p), detail ? [' ', h('span', { class: 'pay-amt' }, detail(p))] : null));
    };
    const reds = open.flatMap((p, i) => [i > 0 ? h('span', { class: 'psep line' }) : null, openSeg(p)]);
    return h('div', { class: 'pstrips' }, h('div', { class: 'prow' },
      ...(paid.length ? [h('span', { class: 'pseg paid merged' }, merge(owed) ? h('span', { class: 'pseg-name' }, merge(owed)) : null), h('div', { class: 'reds' }, h('span', { class: 'psep gap' }), ...reds)] : [h('div', { class: 'reds' }, ...reds)])));
  }
  const paidTotal = payers.filter((p) => p.paid && !p.isBuyer).length;
  let labelled = false;
  const rowOf = (list) => {
    const paid = list.filter((p) => p.paid);
    const open = list.filter((p) => !p.paid);
    const items = [];
    const sep = (cls) => h('span', { class: 'psep ' + cls });
    const openSeg = (p) => {
      const onclick = pick ? pick(p) : null;
      return h(onclick ? 'button' : 'span', { class: 'pseg open', type: onclick ? 'button' : null, onclick }, h('span', { class: 'pseg-name' }, label(p), detail ? [' ', h('span', { class: 'pay-amt' }, detail(p))] : null));
    };
    if (merge) {
      if (paid.length) {
        const text = !labelled && paidTotal ? merge(paidTotal) : null;
        labelled = labelled || !!text;
        items.push(h('span', { class: 'pseg paid merged', style: `flex-grow: ${paid.length}` }, text ? h('span', { class: 'pseg-name' }, text) : null));
      }
      open.forEach((p, i) => { if (items.length) items.push(sep(i === 0 ? 'gap' : 'line')); items.push(openSeg(p)); });
    } else {
      list.forEach((p, i) => {
        if (i > 0) items.push(sep(list[i - 1].paid === p.paid ? 'line' : 'gap'));
        items.push(p.paid ? h('span', { class: 'pseg paid' }, h('span', { class: 'pseg-name' }, label(p))) : openSeg(p));
      });
    }
    return h('div', { class: 'prow' }, ...items);
  };
  const strips = h('div', { class: 'pstrips' });
  let rows = 0;
  const draw = (n) => {
    rows = n;
    labelled = false;
    const list = splitRows(payers, n);
    strips.replaceChildren(...list.map(rowOf));
    // Lage des Spalts bezahlt/offen für das Kopfband: bei einer Zeile genau wie unten, bei mehreren Zeilen nach dem Gesamtanteil
    const bar = strips.closest('.bar');
    if (bar) {
      const mixed = list.length === 1 ? list[0] : null;
      const rowPaid = (mixed ?? payers).filter((p) => p.paid).length;
      const rowN = (mixed ?? payers).length;
      bar.style.setProperty('--gk', rowPaid);
      bar.style.setProperty('--gn', rowN);
      bar.style.setProperty('--gt', mixed ? (merge ? rowN - rowPaid - 1 : rowN - 2) : 0);
      bar.style.setProperty('--gb', mixed ? (merge ? 0 : rowPaid - 1) : 0);
    }
  };
  draw(1);
  new ResizeObserver(() => {
    const width = strips.clientWidth;
    const need = Math.max(0, ...[...strips.querySelectorAll(merge ? '.pseg.open .pseg-name' : '.pseg-name')].map((e) => e.scrollWidth)) + STRIPS.namePadPx;
    const n = width ? rowsNeeded(payers.length, need, width) : rows;
    if (n !== rows) draw(n);
  }).observe(strips);
  return strips;
}

// „Alle“-Liste: Karten je User mit Artikeln, Ready-/Bezahlt-Marken
import { t } from '/i18n.js';
import { TIMING } from '/config.js';
import { eur, h, lc, me } from '/util.js';

let payConfirm = null; // { user, timer }: wartet auf die zweite Bestätigung

export function flagBadge(d, toggle, u, flag) {
  const on = u[flag];
  const label = flag === 'done' ? (on ? t('✓ ready') : t('○ unready')) : on ? t('✓ bezahlt') : t('nicht bezahlt');
  const cls = flag === 'done' ? (on ? (d.ordered_at ? 'faded' : 'mid') : 'off') : on ? 'on' : 'off'; // ready gelb (ab „Bestellt“ blass), unready rot, bezahlt grün
  const editable = lc(u.user) === lc(me) || (flag === 'paid' && d.viewer.is_buyer);
  const isPaid = flag === 'paid' && on; // bezahlt: Häkchen im grünen Kreis + Text, hebt sich von „nicht bezahlt“ ab
  const klass = isPaid ? 'side-paid' : `badge ${cls}`;
  const content = isPaid ? [h('span', { class: 'check-circle', 'aria-hidden': 'true' }, '✓'), t('bezahlt')] : label;
  if (flag === 'paid' && !on && !u.done) return h('span', { class: 'badge faded', title: t('Erst ready setzen, dann bezahlen') }, content); // vor ready nicht klickbar und abgeschwächt (grau)
  if (!editable || flag === 'done') return h('span', { class: klass }, content); // ready wird nur über den Button gesetzt
  const key = lc(u.user);
  const confirming = flag === 'paid' && !on; // „bezahlt“ setzen braucht eine zweite Bestätigung
  const asking = confirming && payConfirm?.user === key;
  const btn = h('button', { class: asking ? `${klass} confirm` : klass, title: t('Umschalten') }, asking ? t('ist bezahlt?') : content);
  btn.addEventListener('click', () => {
    if (!confirming) return toggle(flag, { user: u.user, value: !on });
    if (payConfirm?.user === key) {
      clearTimeout(payConfirm.timer);
      payConfirm = null;
      return toggle(flag, { user: u.user, value: true });
    }
    clearTimeout(payConfirm?.timer);
    payConfirm = { user: key, timer: setTimeout(() => { payConfirm = null; btn.textContent = label; btn.classList.remove('confirm'); }, TIMING.confirmMs) };
    btn.textContent = t('ist bezahlt?');
    btn.classList.add('confirm');
  });
  return btn;
}

// Passive Marke „ist Besteller“ (grau, wie ein inaktives ready)
export const buyerBadge = () => h('span', { class: 'badge idle', title: t('Der Besteller zahlt bei der Bestellung und bekommt das Geld von den anderen.') }, t('ist Besteller'));

// Spalten: Menge · Artikel · Einzelpreis · Gesamtsumme (nur in der Zeile des letzten Artikels); keine Zeilensummen
function itemsTable(u, single, total) {
  const last = u.items.length - 1;
  return h(
    'table',
    { class: 'user-items' },
    h(
      'tbody',
      null,
      u.items.map((i, n) => h('tr', null,
        h('td', { class: 'num' }, `${i.qty}×`),
        h('td', null, i.article, i.variant ? h('span', { class: 'muted' }, ` · ${i.variant}`) : null),
        h('td', { class: 'num unit' }, single ? null : eur(i.price_cents)),
        h('td', { class: 'num total' }, single ? h('strong', { class: 'text-fg' }, eur(i.price_cents)) : total && n === last ? h('strong', { class: 'text-fg' }, total) : null)))
    )
  );
}

// „Alle“: ready-User oben; nicht ready deutlich abgesetzt ganz unten (zählen nicht in der Bestellung)
export function renderUsers(d, toggle, usersPane) {
  if (!d.users.length) {
    usersPane.replaceChildren(h('div', { class: 'card muted' }, t('Noch niemand dabei.')));
    return;
  }
  const card = (u) => {
    const count = u.items.reduce((a, i) => a + i.qty, 0);
    return h(
      'section',
      { class: `card user-card ${u.done ? (u.paid || lc(u.user) === lc(d.buyer) ? 'paid' : 'unpaid') : 'unready'}` },
      h('div', { class: 'row between card-head' }, h('div', { class: 'row gap-3' }, h('strong', null, u.user + (lc(u.user) === lc(d.buyer) ? t(' (Besteller)') : '')), count > 1 || u.fee_cents ? h('span', { class: 'muted' }, [count > 1 ? t('{n} Artikel', { n: count }) : null, u.fee_cents ? `${t('Lieferanteil')} ${eur(u.fee_cents)}` : null].filter(Boolean).join(' · ')) : null), h('div', { class: 'row' }, flagBadge(d, toggle, u, 'done'), lc(u.user) === lc(d.buyer) ? buyerBadge() : null, !u.done || lc(u.user) === lc(d.buyer) ? null : flagBadge(d, toggle, u, 'paid'))),
      u.items.length
        ? itemsTable(u, u.done && count === 1 && !u.fee_cents, u.done && (count > 1 || u.fee_cents) ? eur(u.total_cents) : null) // bei nur 1 Artikel ohne Lieferanteil wäre die Summe doppelt
        : h('div', { class: 'muted' }, t('noch nichts'))
    );
  };
  const filterKey = 'bb_user_filter';
  let onlyUnpaid = false;
  try { onlyUnpaid = sessionStorage.getItem(filterKey) === 'unpaid'; } catch {}
  onlyUnpaid = onlyUnpaid && !!d.ordered_at; // „unbezahlt“ gibt es erst nach „Bestellt“
  const debtors = new Set(d.debts.map((x) => lc(x.user)));
  const keep = (u) => !onlyUnpaid || debtors.has(lc(u.user));
  const box = h('input', { type: 'checkbox', checked: onlyUnpaid, onchange: (e) => { try { sessionStorage.setItem(filterKey, e.target.checked ? 'unpaid' : 'all'); } catch {} renderUsers(d, toggle, usersPane); } });
  const bar = d.ordered_at ? h('label', { class: 'card filter-bar' }, box, t('Nur Unbezahlte')) : null;
  const shown = d.users.filter(keep);
  const ready = shown.filter((u) => u.done);
  const unready = shown.filter((u) => !u.done);
  usersPane.replaceChildren(
    ...(bar ? [bar] : []),
    ...(shown.length ? [] : [h('div', { class: 'card muted' }, t('Keine passenden Bestellungen.'))]),
    ...ready.map(card),
    ...(unready.length ? [h('div', { class: 'unready-gap' }), h('div', { class: 'unready-block' }, h('div', { class: 'unready-sep' }, t('Noch nicht ready – zählt nicht in der Bestellung')), ...unready.map(card))] : [])
  );
}

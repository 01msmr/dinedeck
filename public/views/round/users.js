// „Alle“-Liste: Karten je User mit Artikeln, Ready-/Bezahlt-Marken
import { t } from '/i18n.js';
import { eur, h, lc, me } from '/util.js';
import { nbspUnits } from '/format.js';
import { checkPill, filterPill } from '/views/check-pill.js';

export function flagBadge(d, toggle, u, flag) {
  const on = !!u[flag];
  if (flag === 'done') { // ready setzt nur der Nutzer selbst (auch hier, wie im Reiter); nach „bezahlt“ und ab „geliefert“ blass und fest
    const fixed = !!u.paid || !!d.delivered_at;
    const own = lc(u.user) === lc(me) && !fixed && !(on && d.locked);
    return checkPill(t('ready'), { on, dim: fixed, title: own && !on ? t('Klicken: als ready bestätigen') : null, onclick: own ? () => toggle('done', { user: u.user, value: !on }) : null });
  }
  const editable = lc(u.user) === lc(me) || d.viewer.is_buyer;
  const blocked = !d.ordered_at ? t('Bezahlen erst nach „Bestellt“') : !u.done ? t('Erst ready setzen, dann bezahlen') : null; // vorher stehen Anteile bzw. Artikel nicht fest
  const clickable = editable && !blocked;
  return checkPill(t('bezahlt'), {
    on, dim: !on && !!blocked, title: blocked ?? (clickable ? t('Umschalten') : null),
    onclick: clickable ? () => toggle(flag, { user: u.user, value: !on }) : null, // sofort, ohne Rückfrage
  });
}

// „ist Besteller“: nur eine Anzeige, Text mit Haken davor, ab „geliefert“ blass
export const buyerBadge = (d) => h('span', { class: 'role-note' + (d.delivered_at ? ' dim' : ''), title: t('Der Besteller zahlt bei der Bestellung und bekommt das Geld von den anderen.') }, `✓ ${t('ist Besteller')}`);

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
        h('td', null, i.article, h('span', { class: 'detail-line' }, i.variant ? h('span', { class: 'muted var' }, nbspUnits(i.variant)) : null, single ? null : h('span', { class: 'muted unit-m' }, eur(i.price_cents)))), // Handy: Zusatz und Einzelpreis in Zeile 2
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
      h('div', { class: 'row between card-head' }, h('div', { class: 'row gap-3 head-id' }, h('strong', null, u.user + (lc(u.user) === lc(d.buyer) ? t(' (Besteller)') : '')), count > 1 || u.fee_cents ? h('span', { class: 'muted' }, [count > 1 ? t('{n} Artikel', { n: count }) : null, u.fee_cents ? `${t('Liefer- und Serviceanteil')} ${eur(u.fee_cents)}` : null].filter(Boolean).join(' · ')) : null), h('div', { class: 'row head-flags' }, flagBadge(d, toggle, u, 'done'), lc(u.user) === lc(d.buyer) ? buyerBadge(d) : null, !u.done || lc(u.user) === lc(d.buyer) ? null : flagBadge(d, toggle, u, 'paid'))),
      u.items.length
        ? itemsTable(u, u.done && count === 1 && !u.fee_cents, u.done && (count > 1 || u.fee_cents) ? eur(u.total_cents) : null) // bei nur 1 Artikel ohne Lieferanteil wäre die Summe doppelt
        : h('div', { class: 'muted' }, t('noch nichts'))
    );
  };
  const filterKey = 'bb_user_filter';
  const unreadyKey = 'bb_user_unready';
  const stored = (key, on) => { try { return sessionStorage.getItem(key) === on; } catch { return false; } };
  const onlyUnpaid = stored(filterKey, 'unpaid') && !!d.ordered_at; // „unbezahlt“ gibt es erst nach „Bestellt“
  const onlyUnready = stored(unreadyKey, 'unready') && !d.locked; // „nicht ready“ nur solange die Bestellung läuft
  const debtors = new Set(d.debts.map((x) => lc(x.user)));
  const keep = (u) => (!onlyUnpaid || debtors.has(lc(u.user))) && (!onlyUnready || !u.done);
  const filterBox = (key, on, checked, label) => filterPill(label, { on: checked, onchange: (v) => { try { sessionStorage.setItem(key, v ? on : 'all'); } catch {} renderUsers(d, toggle, usersPane); } });
  const bars = [
    ...(d.locked ? [] : [filterBox(unreadyKey, 'unready', onlyUnready, t('nur unready'))]),
    ...(d.ordered_at ? [filterBox(filterKey, 'unpaid', onlyUnpaid, t('nur unbezahlt'))] : []),
  ];
  const bar = bars.length ? h('div', { class: 'filter-row' }, ...bars) : null;
  const shown = d.users.filter(keep);
  const orders = d.users.filter((u) => u.items?.length).length; // Bestellungen = Nutzer mit Artikeln
  const ready = shown.filter((u) => u.done);
  const unready = shown.filter((u) => !u.done);
  usersPane.replaceChildren(
    ...(bar ? [bar] : []),
    ...(shown.length ? [] : [h('div', { class: 'card muted' }, onlyUnready ? t('alle sind ready') : onlyUnpaid ? t(orders === 1 ? 'die Bestellung ist bezahlt' : 'alle {n} Bestellungen sind bezahlt', { n: orders }) : t('Keine passenden Bestellungen.'))]),
    ...ready.map(card),
    ...(unready.length ? [h('div', { class: 'unready-gap' }), h('div', { class: 'unready-block' }, h('div', { class: 'unready-sep' }, t('Noch nicht ready – zählt nicht in der Bestellung')), ...unready.map(card))] : [])
  );
}

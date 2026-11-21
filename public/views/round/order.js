// Bestellliste: Gruppentabelle, Summen und Text zum Kopieren
import { t } from '/i18n.js';
import { shortVariant, nbspUnits } from '/format.js';
import { eur, h, flashButton, copyIcon } from '/util.js';

export function orderText(d) {
  const lines = [`${t('Bestellung')} ${d.restaurant.name}`];
  for (const g of d.groups) lines.push(`${g.qty}× ${g.article}${g.variant ? ` – ${g.variant}` : ''} (${eur(g.price_cents)})`);
  lines.push('', `${t('Summe Artikel')}: ${eur(d.items_total_cents)}`);
  return lines.join('\n');
}

// Ein Nutzer oder keine Variante: alles in einer Zeile; sonst Artikel, darunter Variante · Namen
function articleCell(g) {
  const variant = nbspUnits(shortVariant(g.variant));
  const who = g.users.map((x) => (x.qty > 1 ? `${x.user} ${x.qty}×` : x.user)).join(', ');
  const unit = h('span', { class: 'muted unit-inline' }, `${g.qty}× à ${eur(g.price_cents)}`);
  if (!variant || g.users.length < 2) return [h('strong', { class: 'art-name' }, g.article), variant ? h('span', { class: 'art-var' }, `·\u00a0${variant}`) : '', unit, ' ', h('span', { class: 'muted who' }, who)];
  return [h('strong', { class: 'art-name' }, g.article), unit, h('span', { class: 'who-line' }, h('span', { class: 'muted' }, `${variant} · ${who}`))];
}

// „Bestellliste kopieren“ steht im Kopf beim Restaurant (immer, für alle); angerufen wird über die Nummer dahinter
export function orderActions(d) {
  return [
    h('button', {
      class: 'link-pill', type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget; // nach dem await ist currentTarget leer
        try {
          await navigator.clipboard.writeText(orderText(d));
          flashButton(btn, `✓ ${t('Kopiert')}`);
        } catch {
          flashButton(btn, `✕ ${t('Kopieren nicht möglich')}`, 2500);
        }
      },
    }, copyIcon(), t('Bestellliste kopieren')),
  ].filter(Boolean);
}

export function orderContent(d) {
  const placed = !!d.ordered_at; // nach „Bestellt“ zählt nur noch die Liste: Kopf, Hinweis und Knöpfe stehen oben bzw. sind erledigt
  return [
    placed ? null : h('h3', { class: 'flush' }, t('Bestellliste')), // Restaurant, Besteller und Kontakt stehen schon im Kopf
    d.groups.length
      ? h(
          'table',
          { class: 'order-table mt-3' },
          h('thead', null, h('tr', null, h('th', { class: 'num' }, t('Menge')), h('th', null, t('Artikel')), h('th', { class: 'num unit-q-head' }), h('th', { class: 'num unit-head' }, h('span', { class: 'unit-head-lbl' }, t('Einzelpreis'))), h('th', { class: 'num' }, t('Summe')))),
          h(
            'tbody',
            null,
            d.groups.map((g) =>
              h(
                'tr',
                null,
                h('td', { class: 'num qty-cell' }, `${g.qty}×`),
                h('td', null, ...articleCell(g), g.price_differs && !placed ? h('div', { class: 'warn-text' }, t('Preis prüfen – zuletzt {p}', { p: eur(g.known_price_cents) })) : null),
                h('td', { class: 'num unit-qty' }, `${g.qty}×`), h('td', { class: 'num unit-col' }, eur(g.price_cents)),
                h('td', { class: 'num' }, eur(g.sum_cents))
              )
            )
          ),
          h(
            'tfoot',
            null,
            h('tr', null, h('td', { class: 'num qty-cell qty-total', title: t('Anzahl aller Artikel') }, `${d.groups.reduce((a, g) => a + g.qty, 0)}×`), h('td', { colspan: 3, class: 'foot-lbl' }, t('Summe Artikel')), h('td', { class: 'num' }, eur(d.items_total_cents))),
            h('tr', { class: 'foot-fees' }, h('td', { colspan: 4, class: 'foot-lbl' }, t('Liefer- und Servicekosten')), h('td', { class: 'num' }, eur(d.delivery_fee_cents ?? 0))), // immer, auch bei 0; Servicekosten haben noch kein Datenfeld
            h('tr', null, h('td', { colspan: 4, class: 'foot-lbl' }, t('Gesamt')), h('td', { class: 'num' }, eur(d.grand_total_cents)))
          )
        )
      : h('p', { class: 'muted' }, t('Noch keine Positionen.')),
    d.users.some((u) => u.excluded)
      ? h('p', { class: 'muted mt-3' }, t('{n} nicht ready – nicht enthalten: {names}', { n: d.users.filter((u) => u.excluded).length, names: d.users.filter((u) => u.excluded).map((u) => u.user).join(', ') }))
      : null,
  ];
}

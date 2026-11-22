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
          h('thead', null, h('tr', null, h('th', { class: 'num' }, t('Menge')), h('th', null, t('Artikel')), h('th', null, t('Variante')), h('th', null, t('Nutzer')), h('th', { class: 'num unit-q-head' }), h('th', { class: 'num unit-head' }, h('span', { class: 'unit-head-lbl' }, t('Einzelpreis'))), h('th', { class: 'num' }, t('Summe')))),
          h(
            'tbody',
            null,
            d.groups.map((g) =>
              h(
                'tr',
                null,
                h('td', { class: 'num qty-cell' }, `${g.qty}×`),
                h('td', { class: 'art-cell' }, h('strong', { class: 'art-name' }, g.article), h('span', { class: 'muted unit-inline' }, `${g.qty}× à ${eur(g.price_cents)}`), g.price_differs && !placed ? h('div', { class: 'warn-text' }, t('Preis prüfen – zuletzt {p}', { p: eur(g.known_price_cents) })) : null),
                h('td', { class: 'var-cell' }, nbspUnits(shortVariant(g.variant))), // Zusatz und Nutzer in eigenen, linksbündigen Spalten
                h('td', { class: 'who-cell muted' }, g.users.map((x) => (x.qty > 1 ? `${x.user} ${x.qty}×` : x.user)).join(', ')),
                h('td', { class: 'num unit-qty' }, `${g.qty}×`), h('td', { class: 'num unit-col' }, eur(g.price_cents)),
                h('td', { class: 'num' }, eur(g.sum_cents))
              )
            )
          ),
          h(
            'tfoot',
            null,
            h('tr', null, h('td', { colspan: 2, class: 'qty-total' }, t('{n} Artikel', { n: d.groups.reduce((a, g) => a + g.qty, 0) })), h('td', { colspan: 4, class: 'foot-lbl' }, t('Summe Artikel')), h('td', { class: 'num' }, eur(d.items_total_cents))),
            h('tr', { class: 'foot-fees' }, h('td', { colspan: 6, class: 'foot-lbl' }, t('Liefer- und Servicekosten')), h('td', { class: 'num' }, eur((d.delivery_fee_cents ?? 0) + (d.service_fee_cents ?? 0)))), // Liefer- und Servicekosten zusammen, immer auch bei 0
            h('tr', null, h('td', { colspan: 6, class: 'foot-lbl' }, t('Gesamt')), h('td', { class: 'num' }, eur(d.grand_total_cents)))
          )
        )
      : h('p', { class: 'muted' }, t('Noch keine Positionen.')),
    d.users.some((u) => u.excluded)
      ? h('p', { class: 'muted mt-3' }, t('{n} nicht ready – nicht enthalten: {names}', { n: d.users.filter((u) => u.excluded).length, names: d.users.filter((u) => u.excluded).map((u) => u.user).join(', ') }))
      : null,
  ];
}

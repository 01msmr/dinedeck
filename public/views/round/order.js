// Sammelbestellung: Gruppentabelle, Summen und Text zum Kopieren
import { t } from '/i18n.js';
import { eur, h, telHref, contactLinks, flashButton } from '/util.js';

export function orderText(d) {
  const lines = [`${t('Bestellung')} ${d.restaurant.name}`];
  for (const g of d.groups) lines.push(`${g.qty}× ${g.article}${g.variant ? ` – ${g.variant}` : ''} (${eur(g.price_cents)})`);
  lines.push('', `${t('Summe Artikel')}: ${eur(d.items_total_cents)}`);
  return lines.join('\n');
}

export function orderContent(d) {
  const tel = telHref(d.restaurant.phone);
  const placed = !!d.ordered_at; // nach „Bestellt“ zählt nur noch die Liste: Kopf, Hinweis und Knöpfe stehen oben bzw. sind erledigt
  return [
    placed ? null : h('div', { class: 'order-head' },
      h('h3', { class: 'flush' }, t('Sammelbestellung'), ' ', h('span', { class: 'plain' }, t('bei')), ` ${d.restaurant.name} `, h('span', { class: 'plain' }, t('durch')), ` ${d.buyer}`),
      contactLinks(d.restaurant, { pill: true })),
    d.groups.length
      ? h(
          'table',
          { class: 'order-table mt-3' },
          h('thead', null, h('tr', null, h('th', { class: 'num' }, t('Menge')), h('th', null, t('Artikel')), h('th', { class: 'num', colspan: 2 }, t('Einzelpreis')), h('th', { class: 'num' }, t('Summe')))),
          h(
            'tbody',
            null,
            d.groups.map((g) =>
              h(
                'tr',
                null,
                h('td', { class: 'num qty-cell' }, `${g.qty}×`),
                h('td', null, h('strong', null, g.article), g.variant ? ` · ${g.variant}` : '', h('span', { class: 'muted unit-inline' }, `${g.qty}× à ${eur(g.price_cents)}`), h('span', { class: 'who-line' }, h('span', { class: 'muted who' }, g.users.map((x) => (x.qty > 1 ? `${x.user} ${x.qty}×` : x.user)).join(', '))), g.price_differs && !placed ? h('div', { class: 'warn-text' }, t('Preis prüfen – zuletzt {p}', { p: eur(g.known_price_cents) })) : null),
                h('td', { class: 'num unit-qty' }, `${g.qty}×`), h('td', { class: 'num unit-col' }, eur(g.price_cents)),
                h('td', { class: 'num' }, eur(g.sum_cents))
              )
            )
          ),
          h(
            'tfoot',
            null,
            h('tr', null, h('td', { class: 'num qty-cell qty-total', title: t('Anzahl aller Artikel') }, `${d.groups.reduce((a, g) => a + g.qty, 0)}×`), h('td', { colspan: 3, class: 'foot-lbl' }, t('Summe Artikel')), h('td', { class: 'num' }, eur(d.items_total_cents))),
            d.delivery_fee_cents ? h('tr', null, h('td', { colspan: 4, class: 'foot-lbl' }, t('Lieferkosten')), h('td', { class: 'num' }, eur(d.delivery_fee_cents))) : null,
            h('tr', null, h('td', { colspan: 4, class: 'foot-lbl' }, t('Gesamt')), h('td', { class: 'num' }, eur(d.grand_total_cents)))
          )
        )
      : h('p', { class: 'muted' }, t('Noch keine Positionen.')),
    placed ? null : h('div', { class: 'notice mt-4' }, h('strong', null, t('Preise sind nicht geprüft'))),
    placed ? null : h(
      'div',
      { class: 'row mt-4' },
      h(
        'button',
        {
          class: 'btn small',
          onclick: async (e) => {
            const btn = e.currentTarget; // nach dem await ist currentTarget leer
            try {
              await navigator.clipboard.writeText(orderText(d));
              flashButton(btn, `✓ ${t('Kopiert')}`);
            } catch {
              flashButton(btn, `✕ ${t('Kopieren nicht möglich')}`, 2500);
            }
          },
        },
        t('Text kopieren')
      ),
      tel ? h('a', { class: 'btn small no-underline', href: tel }, t('Anrufen')) : null
    )
  ];
}

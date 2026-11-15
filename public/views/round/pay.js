// Bezahlbereich: Desktop mit Adresse, Kopieren, QR und PayPal-Knopf; Handy kompakt (Zahl-Link als Knopf, QR dahinter)
import { t } from '/i18n.js';
import { eur, h, lc, me, flashButton } from '/util.js';
import { payHref } from '/format.js';
import { qrIcon } from './qr-icon.js';

// Standard-Kopiersymbol (zwei überlappende Rechtecke) als Knopf mit Hinweistext
function copyButton(text, hint) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '1.5rem', height: '1.5rem', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  const back = document.createElementNS(ns, 'path');
  back.setAttribute('d', 'M5 15V5a2 2 0 0 1 2-2h10');
  const front = document.createElementNS(ns, 'rect');
  for (const [k, v] of Object.entries({ x: '9', y: '7', width: '12', height: '14', rx: '2' })) front.setAttribute(k, v);
  svg.append(back, front);
  return h('button', {
    class: 'btn small ghost copy-btn', type: 'button', title: hint, 'aria-label': hint,
    onclick: async (e) => {
      const btn = e.currentTarget; // nach dem await ist currentTarget leer
      try {
        await navigator.clipboard.writeText(text);
        flashButton(btn, `✓ ${t('Kopiert')}`);
      } catch {
        flashButton(btn, `✕ ${t('Kopieren nicht möglich')}`, 2500);
      }
    },
  }, svg);
}

function payRowsDesktop(d) {
  const hasOrders = d.users.some((u) => u.subtotal_cents > 0);
  if (!hasOrders) return null;
  const meU = d.users.find((u) => lc(u.user) === lc(me));
  const isBuyer = lc(me) === lc(d.buyer);
  const [pre, post] = t('Bezahlen an {buyer}', { buyer: '\u0001' }).split('\u0001'); // „Bezahlen an“ bleibt stehen, nur der Name darf kürzen
  const title = h('h3', { class: 'flush pay-title' }, h('span', { class: 'pay-label' }, pre.trim()), h('span', { class: 'pay-who' }, d.buyer), post.trim() ? h('span', { class: 'pay-label' }, post.trim()) : null);
  const rows = [title];
  const canPay = !!meU && meU.done && !meU.paid && meU.subtotal_cents > 0; // bezahlen erst nach ready
  const payLink = !isBuyer && canPay && d.paypal ? payHref(d.paypal, meU.total_cents) : null;
  if (!d.paypal_visible) rows.push(h('div', { class: 'muted' }, t('PayPal-Adresse ist nur für Teilnehmer der Bestellung sichtbar.')));
  else if (!d.paypal) rows.push(h('div', { class: 'muted' }, t('Keine PayPal-Adresse hinterlegt.')));
  else {
    rows.splice(
      0,
      1,
      h('div', { class: 'pay-line' }, h(
        'div',
        { class: 'row gap-3 pay-info' }, // Titel, Adresse und Kopieren in einer Zeile
        title,
        payLink
          ? h('a', { class: 'payaddr', href: payLink, target: '_blank', rel: 'noopener noreferrer' }, d.paypal)
          : h('strong', { class: 'payaddr' }, d.paypal),
        copyButton(payLink ?? d.paypal, payLink ? t('Bezahl-Link kopieren') : t('Adresse kopieren'))
      ))
    );
  }
  if (isBuyer) {
    // Besteller zahlt nicht an sich selbst: nur die Adresse zum Kopieren
  } else if (meU && meU.subtotal_cents > 0 && meU.paid) rows.unshift(h('div', { class: 'ready-strip on' }, t('✓ Du hast bezahlt')));
  else if (meU && meU.subtotal_cents > 0 && !meU.done) rows.push(h('div', { class: 'muted' }, t('Erst ready setzen, dann bezahlen')));
  else if (meU && meU.subtotal_cents > 0) {
    const href = d.paypal ? payHref(d.paypal, meU.total_cents) : null;
    if (href && rows[0].classList.contains('pay-line')) {
      // QR-Symbol und PayPal-Knopf in dieselbe Zeile wie Adresse und Kopieren (umbricht nur bei Platzmangel)
      rows[0].append(qrIcon(href), h('a', { class: 'btn pay-go', href, target: '_blank', rel: 'noopener noreferrer' }, t('{amount} per PayPal zahlen', { amount: eur(meU.total_cents) })));
    } else {
      rows.push(h('div', { class: 'muted' }, t('Dein Betrag: {amount}', { amount: eur(meU.total_cents) })));
    }
  }
  return rows;
}

// Handy: Zahl-Link als runder Knopf mit Betrag, QR-Code dahinter, ohne Kopierknopf und ohne „Bezahlen an“
function payRowsMobile(d) {
  const hasOrders = d.users.some((u) => u.subtotal_cents > 0);
  if (!hasOrders) return null;
  const meU = d.users.find((u) => lc(u.user) === lc(me));
  const isBuyer = lc(me) === lc(d.buyer);
  const canPay = !!meU && meU.done && !meU.paid && meU.subtotal_cents > 0; // bezahlen erst nach ready
  const payLink = !isBuyer && canPay && d.paypal ? payHref(d.paypal, meU.total_cents) : null;
  const rows = [];
  if (!d.paypal_visible) rows.push(h('div', { class: 'muted' }, t('PayPal-Adresse ist nur für Teilnehmer der Bestellung sichtbar.')));
  else if (!d.paypal) rows.push(h('div', { class: 'muted' }, t('Keine PayPal-Adresse hinterlegt.')));
  else {
    rows.push(h(
      'div',
      { class: 'pay-line' },
      payLink
        ? [h('a', { class: 'link-pill pay-pill', href: payLink, target: '_blank', rel: 'noopener noreferrer' }, `${eur(meU.total_cents)} · ${d.paypal}`), qrIcon(payLink)]
        : h('strong', { class: 'payaddr' }, d.paypal)
    ));
  }
  if (isBuyer) {
    // Besteller zahlt nicht an sich selbst: nur die Adresse
  } else if (meU && meU.subtotal_cents > 0 && meU.paid) rows.unshift(h('div', { class: 'ready-strip on' }, t('✓ Du hast bezahlt')));
  else if (meU && meU.subtotal_cents > 0 && !meU.done) rows.push(h('div', { class: 'muted' }, t('Erst ready setzen, dann bezahlen')));
  else if (meU && meU.subtotal_cents > 0 && !payLink) rows.push(h('div', { class: 'muted' }, t('Dein Betrag: {amount}', { amount: eur(meU.total_cents) })));
  return rows;
}

export function payRows(d) {
  const desk = payRowsDesktop(d);
  if (!desk) return null;
  return [h('div', { class: 'desk-only pay-variant' }, ...desk), h('div', { class: 'mobile-only pay-variant' }, ...payRowsMobile(d))];
}

// Statusleiste oben: Ablaufzeile, Hinweise, offene Beträge
import { t } from '/i18n.js';
import { TIMING } from '/config.js';
import { joinList } from '/format.js';
import { debtRowEl } from '/views/round/debt-row.js';
import { fmtWhen, h, lc, me } from '/util.js';

export function createStatus({ banners, toggle, decide }) {
  let d = null;
  let payConfirm = null; // {user, timer}: Rückfrage im Button vor „bezahlt“
  const debtRow = (x) =>
    debtRowEl(x, {
      asking: payConfirm?.user === x.user,
      onClick: lc(x.user) === lc(me) || d.viewer.is_buyer
        ? () => {
            if (payConfirm?.user === x.user) {
              clearTimeout(payConfirm.timer);
              payConfirm = null;
              toggle('paid', { user: x.user, value: true });
              return;
            }
            clearTimeout(payConfirm?.timer);
            payConfirm = { user: x.user, timer: setTimeout(() => { payConfirm = null; render(d); }, TIMING.confirmMs) };
            render(d);
          }
        : null,
    });

  function render(data) {
    d = data;
    const b = [];
    const allReady = d.ready.total > 0 && !d.ready.not_ready.length;
    const step = (cls, text, time) => h('span', { class: `step ${cls}` }, text, time ? [' \u00A0\u00A0', h('span', { class: 'step-time' }, time)] : null);
    const sep = () => h('span', { class: 'step-sep' }, '›');
    const readyTxt = d.ready.total ? t('ready {done}/{total}', { done: d.ready.done, total: d.ready.total }) : t('ready');
    const opened = step('done', `✓ ${t('eröffnet')}`, d.ordered_at ? null : fmtWhen(d.created_at)); // Zeiten früherer Schritte entfallen, sobald der nächste bestätigt ist
    const ordTxt = `✓ ${t('bestellt')}`;
    const allPaid = !d.debts.length && d.ordered_at && d.users.some((u) => u.subtotal_cents > 0);
    const unpaid = d.unpaid && !!d.ordered_at; // offene Beträge erst nach „Bestellt“
    const flow = d.delivered_at
      ? [opened, step('done', `✓ ${t('ready')}`), step('done', ordTxt), step('now', `✓ ${t('geliefert')}`, fmtWhen(d.delivered_at))]
      : d.ordered_at
        ? [opened, step('done', `✓ ${t('ready')}`), step('now', ordTxt, fmtWhen(d.ordered_at)), step('todo', t('geliefert'))]
        : d.ready.total
          ? [opened, allReady ? step('now ready', `✓ ${readyTxt}`) : Object.assign(step('now unready', readyTxt), { title: t('Noch nicht ready: {names}', { names: d.ready.not_ready.join(', ') }) }), step('todo', t('bestellt')), step('todo', t('geliefert'))] // noch nicht alle ready: derselbe Ablauf, ready rot
          : null;
    const payers = d.users.filter((u) => u.done && u.subtotal_cents > 0 && lc(u.user) !== lc(d.buyer)); // Besteller zahlt nicht an sich selbst
    const paidN = payers.filter((u) => u.paid).length;
    if (flow) {
      const counting = !allPaid && !!d.delivered_at && payers.length > 0; // nach „geliefert“: x/y bezahlt (gelb), alle bezahlt (grün)
      if (allPaid || counting) flow.forEach((el) => el.classList.replace('now', 'done'));
      flow.push(allPaid ? step('now', `✓ ${t('bezahlt')}`) : counting ? step('now ready', t('{paid}/{total} bezahlt', { paid: paidN, total: payers.length })) : step('todo', t('bezahlt')));
    }
    if (flow) b.push(h('div', { class: 'status-flow' + (unpaid ? ' unpaid' : allPaid ? ' paid' : '') }, ...flow.flatMap((x, n) => (n ? [sep(), x] : [x]))));
    if (unpaid) {
      const [before, after] = joinList(d.debts.map((x) => x.user), '\u0001').split('\u0001'); // nur das Wort „und“ in normaler Schrift
      b.push(h('div', { class: 'banner bad' }, t('{n} unbezahlt:', { n: d.debts.length }), h('span', { class: 'banner-names' }, before, after === undefined ? null : [h('span', { class: 'und' }, t('und')), after])));
    }
    if (d.ordered_at && d.debts.length) b.push(h('div', { class: 'status-debts' }, ...d.debts.map(debtRow)));
    else if (allPaid) b.push(h('div', { class: 'banner ok' }, t('✓ alles bezahlt')));
    for (const u of d.pending) {
      b.unshift(h('div', { class: 'banner bad row between' },
        h('span', null, t('Neu: {user} möchte mitbestellen', { user: u })),
        h('span', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => decide({ approve: u }) }, t('Freigeben')),
          h('button', { class: 'btn small ghost', onclick: () => decide({ reject: u }) }, t('Ablehnen')))));
    }
    if (d.viewer_pending) b.unshift(h('div', { class: 'banner warn' }, t('Wartet auf Freigabe durch den Besteller')));
    banners.replaceChildren(...b);
  }

  return { render };
}

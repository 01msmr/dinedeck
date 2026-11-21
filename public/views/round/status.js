// Statusleiste oben: Ablaufzeile, Hinweise, offene Beträge
import { t } from '/i18n.js';
import { TIMING, DEFAULTS, STATUS } from '/config.js';
import { isToday, beforeThisYear } from '/format.js';
import { payMark, payStrips, paidFirst } from '/views/pay-bar.js';
import { chevronIcon } from '/icons.js';
import { payRows } from '/views/round/pay.js';
import { eur, fmtDay, fmtClock, fmtRemaining, lockIcon, undoIcon, h, lc, me } from '/util.js';

const quiet = STATUS.quietButtons ? ' quiet' : '';

export function createStatus({ banners, debtsHost, toggle, decide, undo, advance, etaField, time, autoClose }) {
  let d = null;
  let payConfirm = null; // {user, timer}: Rückfrage im Button vor „bezahlt“
  let confirm = null; // {key, timer}: Rückfrage vor Zurücknehmen/Weitergehen
  // Roter Strip: wer zahlt oder der Besteller darf „bezahlt“ setzen; erster Klick fragt „ist bezahlt?“, zweiter setzt es
  const pickPay = (p) => (lc(p.user) === lc(me) || d.viewer.is_buyer
    ? () => {
        if (payConfirm?.user === p.user) {
          clearTimeout(payConfirm.timer);
          payConfirm = null;
          toggle('paid', { user: p.user, value: true });
          return;
        }
        clearTimeout(payConfirm?.timer);
        payConfirm = { user: p.user, timer: setTimeout(() => { payConfirm = null; render(d); }, TIMING.confirmMs) };
        render(d);
      }
    : null);

  function render(data) {
    d = data;
    const b = [];
    const allReady = d.ready.total > 0 && !d.ready.not_ready.length;
    const step = (cls, text, time) => h('span', { class: `step ${cls}` }, text, time ? [' \u00A0\u00A0', h('span', { class: 'step-time' }, time)] : null);
    // Verwalter: ↩ hinter dem letzten Schritt (nimmt ihn zurück), der nächste Schritt ist der Knopf (vor); erster Klick fragt, zweiter führt aus
    const asking = (key) => confirm?.key === key;
    const run = (key, fn) => () => {
      if (asking(key)) { clearTimeout(confirm.timer); confirm = null; fn(); return; }
      clearTimeout(confirm?.timer);
      confirm = { key, timer: setTimeout(() => { confirm = null; render(d); }, TIMING.confirmMs) };
      render(d);
    };
    const after = new Map(); // Schritt -> Knopf direkt dahinter
    const undoable = (el, body) => {
      if (d.viewer.can_manage) after.set(el, h('button', { class: 'step-btn' + quiet + (asking('undo') ? ' confirm' : ''), type: 'button', title: typeof body === 'function' ? t('Wieder öffnen') : t('Schritt zurücknehmen'), 'aria-label': typeof body === 'function' ? t('Wieder öffnen') : t('Schritt zurücknehmen'), onclick: run('undo', () => (typeof body === 'function' ? body() : undo(body))) }, asking('undo') ? t('zurücknehmen?') : '↩'));
      return el;
    };
    const goStep = (key, label, ask, can = true, hint = '') =>
      !d.viewer.can_manage
        ? step('todo', label)
        : h('button', { class: 'step todo step-go' + (asking(key) ? ' confirm' : ''), type: 'button', disabled: !can, title: can ? '' : hint, onclick: run(key, () => advance(key)) }, asking(key) ? ask : label);
    const sep = () => h('span', { class: 'step-sep', 'aria-hidden': 'true' }, chevronIcon());
    const readyTxt = d.ready.total ? t('ready {done}/{total}', { done: d.ready.done, total: d.ready.total }) : t('ready');
    const opened = step('done', `✓ ${t('eröffnet')}`);
    const ordTxt = `✓ ${t('bestellt')}`;
    // „ready“: offen = Kästchen „Schließen, wenn alle ready“ in der Pille (Verwalter klicken, andere sehen es grau), davor +5, dahinter Schließen; geschlossen = Pille mit ↩ „Wieder öffnen“
    const readyStep = () => {
      const names = allReady ? '' : t('Noch nicht ready: {names}', { names: d.ready.not_ready.join(', ') });
      if (d.locked) {
        const pill = allReady ? step('now ready', `✓ ${readyTxt}`) : Object.assign(step('now unready', readyTxt), { title: names });
        const when = h('span', { class: 'step-left', title: t('Geschlossen um') }, lockIcon(), fmtClock(d.expires_at)); // Schloss + Schließzeit statt Restzeit
        if (!d.viewer.can_manage) return h('span', { class: 'step-group' }, pill, when);
        const plus = h('button', { class: 'step-btn' + quiet, type: 'button', disabled: true, title: t('Zum Verlängern erst wieder öffnen'), 'aria-label': t('Zum Verlängern erst wieder öffnen') }, `+${DEFAULTS.extendMinutes}`);
        const reopen = h('button', { class: 'step-btn' + quiet + (asking('undo') ? ' confirm' : ''), type: 'button', title: t('Wieder öffnen'), 'aria-label': t('Wieder öffnen'), onclick: run('undo', () => time('reopen', DEFAULTS.extendMinutes)) }, asking('undo') ? t('öffnen?') : undoIcon());
        return h('span', { class: 'step-group' }, pill, plus, when, reopen); // am selben Platz wie vorher das Schloss
      }
      const hint = t('Schließen, wenn alle ready');
      const cb = h('input', { type: 'checkbox', checked: !!d.close_when_ready, disabled: !d.viewer.can_manage, title: hint, 'aria-label': hint, onchange: () => autoClose(cb.checked) });
      const pill = h('span', { class: `step now ${allReady ? 'ready' : 'unready'}`, title: names }, cb, readyTxt);
      const left = h('span', { class: 'step-left', 'data-until': d.expires_at, title: t('Bestellfrist') }, fmtRemaining(d.expires_at - d.server_now)); // tickt zentral (side.js)
      const closeBtn = h('button', { class: 'step-btn' + (asking('close') ? ' confirm' : ''), type: 'button', title: t('Jetzt schließen'), 'aria-label': t('Jetzt schließen'), onclick: run('close', () => advance('close')) }, asking('close') ? t('schließen?') : lockIcon());
      if (!d.viewer.can_manage) return h('span', { class: 'step-group' }, pill, left);
      const plus = h('button', { class: 'step-btn' + quiet, type: 'button', title: t('Frist verlängern'), 'aria-label': t('Frist verlängern'), onclick: () => time('extend', DEFAULTS.extendMinutes) }, `+${DEFAULTS.extendMinutes}`);
      return h('span', { class: 'step-group' }, pill, plus, left, closeBtn); // ready allein, dann +5, Restzeit, Schloss (Schließen)
    };
    // Ab „Bestellt“: ready erledigt, Schloss + Schließzeit bleiben sichtbar (zurückhaltend), kein +5; Öffnen geht erst nach „Bestellt zurücknehmen“
    const closedStep = () => h('span', { class: 'step-group' }, step('done', `✓ ${t('ready')}`), h('span', { class: 'step-left done', title: t('Geschlossen um') }, lockIcon(), fmtClock(d.expires_at)));
    const flow = d.delivered_at
      ? [opened, closedStep(), step('done', ordTxt), undoable(step('now', `✓ ${t('geliefert')}`, fmtClock(d.delivered_at)), { delivered: false })]
      : d.ordered_at
        ? [opened, closedStep(), undoable(step('now', ordTxt, fmtClock(d.ordered_at)), { ordered: false }), d.viewer.can_manage ? h('span', { class: 'step-group' }, etaField, goStep('delivered', t('geliefert'), t('geliefert melden?'))) : goStep('delivered', t('geliefert'), t('geliefert melden?'))]
        : d.ready.total
          ? [opened, readyStep(), goStep('ordered', t('bestellt'), t('bestellt melden?'), d.locked, t('Erst die Bestellung schließen')), step('todo', t('geliefert'))] // noch nicht alle ready: derselbe Ablauf, ready rot
          : null;
    const where = h('span', { class: 'step-where' }, h('span', null, isToday(d.created_at, Date.now(), DEFAULTS.nightEndHour) ? fmtClock(d.created_at) : fmtDay(d.created_at, beforeThisYear(d.created_at)))); // links: am selben Tag nur die Uhrzeit, sonst das Datum, aus einem früheren Jahr mit Jahr
    if (flow) b.push(h('div', { class: 'status-flow' }, where, h('div', { class: 'flow-steps' }, ...flow.flatMap((x, n) => {
      const chip = after.get(x);
      if (chip) chip.classList.add(x.classList.contains('now') ? 'tucked' : 'flush'); // hinter der Pille hervorkommend bzw. bündig am Text
      return [...(n ? [sep()] : []), chip ? h('span', { class: 'step-pair' }, x, chip) : x]; // Schritt und ↩ bleiben zusammen (kein Umbruch dazwischen)
    }))));
    // Zahlungen: Zeile wie in „Alle Bestellungen“ (Kreis, Kopfband, Personen-Strips); bleibt bei „alle bezahlt“ stehen, dann ganz grün
    const payers = paidFirst(d.payers ?? []);
    const owed = new Map(d.debts.map((x) => [lc(x.user), x.amount_cents]));
    const paidN = payers.filter((p) => p.paid).length;
    const payBlock = d.ordered_at && payers.length
      ? h('div', { class: 'pay-block' },
          payMark(payers),
          h('div', { class: 'card bar', style: `--gk: ${paidN}; --gn: ${payers.length}` },
            h('div', { class: 'bar-top' + (paidN && paidN < payers.length ? ' mixed' : ''), style: `--share: ${(100 * paidN) / payers.length}%` },
              h('div', { class: 'row between' },
                h('span', { class: 'bar-line' }, h('strong', null, d.debts.length ? t('Offene Zahlungen') : t('Zahlungen')), d.debts.length ? h('span', null, eur(d.debts.reduce((a, x) => a + x.amount_cents, 0))) : null),
                h('div', { class: 'bar-right' }, ...(d.debts.length && payRows(d) ? [h('div', { class: 'head-pay' }, ...payRows(d))] : []), h('span', { class: 'badge value' }, eur(d.grand_total_cents))))), // rechts: Bezahllink, ganz rechts der Bestellwert wie in „Alle Bestellungen“
            payStrips(payers, (p) => (p.paid ? `✓ ${p.user}` : payConfirm?.user === p.user ? t('ist bezahlt?') : `${p.user} ${eur(owed.get(lc(p.user)) ?? 0)}`), pickPay)))
      : null;
    debtsHost.replaceChildren(...(payBlock ? [payBlock] : [])); // steht unter dem Bestellkopf
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

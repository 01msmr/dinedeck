// Statusleiste oben: Ablaufzeile, Hinweise, offene Beträge
import { t } from '/i18n.js';
import { TIMING, DEFAULTS, STATUS } from '/config.js';
import { isToday, beforeThisYear } from '/format.js';
import { payMark, payStrips, paidFirst, mergedVars } from '/views/pay-bar.js';
import { eur, fmtDay, fmtClock, fmtRemaining, lockIcon, undoIcon, h, lc, me } from '/util.js';

const quiet = STATUS.quietButtons ? ' quiet' : '';

export function createStatus({ banners, flowHost, debtsHost, toggle, decide, undo, advance, etaField, time, autoClose }) {
  let d = null;
  let confirm = null; // {key, timer}: Rückfrage vor Zurücknehmen/Weitergehen
  // Roter Strip: wer zahlt oder der Besteller setzt „bezahlt“ mit einem Klick
  const pickPay = (p) => (lc(p.user) === lc(me) || d.viewer.is_buyer ? () => toggle('paid', { user: p.user, value: true }) : null);

  function render(data) {
    d = data;
    const b = [];
    const allReady = d.ready.total > 0 && !d.ready.not_ready.length;
    const step = (cls, text, time) => h('span', { class: `step ${cls}` }, text, time ? [' \u00A0\u00A0', h('span', { class: 'step-time' }, time)] : null);
    // Verwalter: ↩ hinter dem letzten Schritt (nimmt ihn zurück), der nächste Schritt ist der Knopf (vor); erster Klick fragt, zweiter führt aus
    const asking = (key) => confirm?.key === key;
    // Rückfrage: der Knopfinhalt bleibt (unsichtbar) im Fluss, damit sich die Leiste nicht verändert; die Frage liegt als Overlay darüber
    const keepAsk = (on, normal, text) => (on ? [h('span', { class: 'ask-keep' }, normal), h('span', { class: 'confirm-label' }, text)] : normal);
    const run = (key, fn) => () => {
      if (asking(key)) { clearTimeout(confirm.timer); confirm = null; fn(); return; }
      clearTimeout(confirm?.timer);
      confirm = { key, timer: setTimeout(() => { confirm = null; render(d); }, TIMING.confirmMs) };
      render(d);
    };
    const after = new Map(); // Schritt -> Knopf direkt dahinter
    const undoable = (el, body) => {
      if (d.viewer.can_manage) after.set(el, h('button', { class: 'step-btn' + quiet + (asking('undo') ? ' confirm' : ''), type: 'button', title: typeof body === 'function' ? t('Wieder öffnen') : t('Schritt zurücknehmen'), 'aria-label': typeof body === 'function' ? t('Wieder öffnen') : t('Schritt zurücknehmen'), onclick: run('undo', () => (typeof body === 'function' ? body() : undo(body))) }, keepAsk(asking('undo'), '↩', t('zurücknehmen?'))));
      return el;
    };
    const etaLeft = () => (d.ordered_at && !d.delivered_at && d.eta_at ? h('span', { class: 'eta-left' }) : null); // Restzeit bis zur Lieferung (Text setzt updateEta in round.js jede Sekunde)
    const goStep = (key, label, ask, can = true, hint = '') =>
      !d.viewer.can_manage
        ? step('todo', label)
        : h('button', { class: 'step todo step-go' + (asking(key) ? ' confirm' : ''), type: 'button', disabled: !can, title: can ? '' : hint, onclick: run(key, () => advance(key)) }, keepAsk(asking(key), label, ask));
    const readyTxt = d.ready.total ? t('ready {done}/{total}', { done: d.ready.done, total: d.ready.total }) : t('ready');
    const opened = step('done', t('eröffnet')); // vorige Ereignisse ohne Haken, nur der aktuelle Stand hat ihn
    const ordTxt = t('bestellt');
    // „ready“: offen = Kästchen „Schließen, wenn alle ready“ in der Pille (Verwalter klicken, andere sehen es grau), davor +5, dahinter Schließen; geschlossen = Pille mit ↩ „Wieder öffnen“
    const readyStep = () => {
      const names = allReady ? '' : t('Noch nicht ready: {names}', { names: d.ready.not_ready.join(', ') });
      if (d.locked) {
        const pill = allReady ? step('now ready', readyTxt) : Object.assign(step('now unready', readyTxt), { title: names });
        const when = h('span', { class: 'step-left', title: t('Geschlossen um') }, lockIcon(), fmtClock(d.expires_at)); // Schloss + Schließzeit statt Restzeit
        if (!d.viewer.can_manage) return h('span', { class: 'step-group' }, pill, when);
        const plus = h('button', { class: 'step-btn' + quiet, type: 'button', disabled: true, title: t('Zum Verlängern erst wieder öffnen'), 'aria-label': t('Zum Verlängern erst wieder öffnen') }, `+${DEFAULTS.extendMinutes}`);
        const reopen = h('button', { class: 'step-btn' + quiet + (asking('undo') ? ' confirm' : ''), type: 'button', title: t('Wieder öffnen'), 'aria-label': t('Wieder öffnen'), onclick: run('undo', () => time('reopen', DEFAULTS.extendMinutes)) }, keepAsk(asking('undo'), undoIcon(), t('öffnen?')));
        return h('span', { class: 'step-group' }, pill, plus, when, reopen); // am selben Platz wie vorher das Schloss
      }
      const hint = t('Schließen, wenn alle ready');
      const cb = h('input', { type: 'checkbox', checked: !!d.close_when_ready, disabled: !d.viewer.can_manage, title: hint, 'aria-label': hint, onchange: () => autoClose(cb.checked) });
      const pill = h('span', { class: `step now ${allReady ? 'ready' : 'unready'}`, title: names }, cb, readyTxt);
      const left = h('span', { class: 'step-left', 'data-until': d.expires_at, title: t('Bestellfrist') }, fmtRemaining(d.expires_at - d.server_now)); // tickt zentral (side.js)
      const closeBtn = h('button', { class: 'step-btn' + (asking('close') ? ' confirm' : ''), type: 'button', title: t('Jetzt schließen'), 'aria-label': t('Jetzt schließen'), onclick: run('close', () => advance('close')) }, keepAsk(asking('close'), lockIcon(), t('schließen?')));
      if (!d.viewer.can_manage) return h('span', { class: 'step-group' }, pill, left);
      const plus = h('button', { class: 'step-btn' + quiet, type: 'button', title: t('Frist verlängern'), 'aria-label': t('Frist verlängern'), onclick: () => time('extend', DEFAULTS.extendMinutes) }, `+${DEFAULTS.extendMinutes}`);
      return h('span', { class: 'step-group' }, pill, plus, left, closeBtn); // ready allein, dann +5, Restzeit, Schloss (Schließen)
    };
    // Ab „Bestellt“: ready erledigt, Schloss + Schließzeit bleiben sichtbar (zurückhaltend), kein +5; Öffnen geht erst nach „Bestellt zurücknehmen“
    const closedStep = () => h('span', { class: 'step-group' }, step('done', t('ready')), h('span', { class: 'step-left done', title: t('Geschlossen um') }, lockIcon(), fmtClock(d.expires_at)));
    const flow = d.delivered_at
      ? [opened, closedStep(), step('done', t('bestellt')), undoable(step('now', t('geliefert'), fmtClock(d.delivered_at)), { delivered: false })]
      : d.ordered_at
        ? [opened, closedStep(), undoable(step('now', ordTxt, fmtClock(d.ordered_at)), { ordered: false }), d.viewer.can_manage ? h('span', { class: 'step-group' }, etaField, etaLeft(), goStep('delivered', t('geliefert'), t('geliefert melden?'))) : goStep('delivered', t('geliefert'), t('geliefert melden?'))]
        : [opened, readyStep(), goStep('ordered', t('bestellt'), t('bestellt melden?'), d.locked && d.ready.total > 0, d.locked ? t('Noch nichts bestellt') : t('Erst die Bestellung schließen')), step('todo', t('geliefert'))]; // auch ohne Bestellung: Wieder öffnen und +5 bleiben erreichbar
    // Lange Pille wie ein Fortschrittsbalken mit Trennlinien: erledigte Abschnitte gefüllt, der aktuelle grün, offene ausgegraut (leerer Kreis);
    // Besteller/Admins haben ihre Bedienelemente in den Abschnitten, passive Nutzer nur Text.
    const reached = d.delivered_at ? 3 : d.ordered_at ? 2 : d.locked ? 2 : 0; // letzter erreichter Abschnitt; geschlossen: ready ist erledigt (dunkel), „bestellt“ der aktuelle Schritt
    const seg = (i, ...kids) => {
      const state = i < reached ? 'done' : i === reached && (i < 2 || d.ordered_at) ? 'now' : 'todo'; // geschlossen ist noch nicht bestellt: „bestellt“ bleibt offen, bis es gemeldet ist
      return h('span', { class: `fp-seg fp-${state}` }, ...(state === 'done' ? [] : [h('span', { class: 'fp-mark', 'aria-hidden': 'true' }, state === 'todo' ? '○' : '✓')]), ...kids);
    };
    const plain = (el) => { for (const e of [el, ...el.querySelectorAll('.step')]) e.classList.remove('now', 'ready', 'unready', 'done', 'todo'); return el; }; // der Abschnitt gibt die Farbe vor
    const readyTime = d.locked
      ? h('span', { class: 'step-left done', title: t('Geschlossen um') }, lockIcon(), fmtClock(d.expires_at))
      : h('span', { class: 'step-left', 'data-until': d.expires_at, title: t('Bestellfrist') }, fmtRemaining(d.expires_at - d.server_now)); // tickt zentral (side.js)
    const passive = (i) => [
      [t('eröffnet')],
      [readyTxt, readyTime],
      [t('bestellt'), d.ordered_at ? h('span', { class: 'fp-when' }, fmtClock(d.ordered_at)) : null],
      [t('geliefert'), etaLeft(), d.delivered_at ? h('span', { class: 'fp-when' }, fmtClock(d.delivered_at)) : null],
    ][i];
    const pill = () => {
      const timeSeg = (el, ...kids) => { // Frist/Schließzeit als eigener Abschnitt mit Trennlinie hinter „ready“
        const t2 = seg(1, ...kids);
        t2.querySelector('.fp-mark')?.remove();
        t2.classList.add('fp-time');
        if (d.locked && !d.ordered_at) t2.classList.add('closed'); // Endzeit schwarz, solange geschlossen der aktuelle Stand ist; ab „bestellt“ erledigt wie die Abschnitte davor
        return [el, t2];
      };
      const segs = [0, 1, 2, 3].flatMap((i) => {
        if (!d.viewer.can_manage) return i === 1 ? timeSeg(seg(1, passive(1)[0]), passive(1)[1]) : [seg(i, ...passive(i))];
        const x = flow[i];
        const chip = after.get(x);
        if (i === 1) { const [first, ...rest] = [...plain(x).children]; return timeSeg(seg(1, first), h('span', { class: 'step-group' }, ...rest)); }
        const el = seg(i, chip ? h('span', { class: 'fp-pair' }, plain(x), chip) : plain(x));
        if (x.matches('.step-go') || x.querySelector('.step-go')) el.classList.add('act'); // nächster Schritt als Knopf
        return [el];
      });
      const phase = d.delivered_at ? 'delivered' : d.ordered_at ? 'ordered' : d.locked ? 'closed' : 'open'; // Handy: bestimmt, welche Abschnitte Text zeigen
      return h('div', { class: 'flow-pill', 'data-phase': phase }, ...segs);
    };
    flowHost.replaceChildren(...(flow ? [h('div', { class: 'status-flow' }, h('div', { class: 'flow-steps' }, pill()))] : [])); // Datum steht jetzt im Restaurant-Kopf
    // Zahlungen: Zeile wie in „Alle Bestellungen“ (Kreis, Kopfband, Personen-Strips); bleibt bei „alle bezahlt“ stehen, dann ganz grün
    const payers = paidFirst((d.payers ?? []).map((p) => ({ ...p, isBuyer: lc(p.user) === lc(d.buyer) })));
    const owed = new Map(d.debts.map((x) => [lc(x.user), x.amount_cents]));
    const paidN = payers.filter((p) => p.paid).length;
    const paidSum = d.users.filter((u) => u.subtotal_cents > 0 && (u.paid || lc(u.user) === lc(d.buyer))).reduce((a, u) => a + u.total_cents, 0); // Besteller gilt als bezahlt: Bezahlt + Offen = Bestellsumme
    const openSum = d.debts.reduce((a, x) => a + x.amount_cents, 0);
    const redLabel = (p) => (p.paid ? '' : `${p.user} ${eur(owed.get(lc(p.user)) ?? 0)}`);
    const payBlock = d.ordered_at && payers.length
      ? h('div', { class: 'pay-block' },
          payMark(payers),
          h('div', { class: 'card bar', style: mergedVars(payers, redLabel, (p) => (p.paid ? '' : p.user)) },
            h('div', { class: 'bar-top' + (paidN === payers.length ? ' done' : paidN ? ' mixed-merged' : ''), style: `--share: ${(100 * paidN) / payers.length}%` },
              h('div', { class: 'row between' },
                h('span', { class: 'bar-line' }, h('strong', null, t('Bezahlt')), h('span', { class: 'badge value', title: t('bezahlt') }, eur(paidSum))), // links im grünen Bereich: Summe der Bezahlten
                h('div', { class: 'bar-right' }, ...(paidN === payers.length ? [h('span', { class: 'bar-done' }, `✓ ${t('alle bezahlt')}`)] : [h('strong', null, t('Offen')), h('span', { class: 'badge value', title: t('unbezahlt') }, eur(openSum))])))), // ganz rechts im roten Bereich: Summe der Unbezahlten
            ...(paidN === payers.length ? [] : [payStrips(payers, (p) => (p.paid ? '' : p.user), pickPay, () => null, (p) => eur(owed.get(lc(p.user)) ?? 0))])))
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

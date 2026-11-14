// Nach dem Anmelden an einem späteren Tag: offene Zahlungen (eigene und die bei einem selbst offenen)
import { t } from '/i18n.js';
import { DEFAULTS } from '/config.js';
import { h, api, eur, me, lc } from '/util.js';
import { owedByMe, owedToMe } from '/format.js';

const box = document.getElementById('pay-notice');
const seenKey = 'bb_pay_notice';

export async function showOpenPayments() {
  box.replaceChildren();
  if (!me) return;
  const rounds = (await api('GET', '/rounds?all=1').catch(() => [])) ?? [];
  const now = Date.now();
  const mine = owedByMe(rounds, me, now, DEFAULTS.nightEndHour);
  const toMe = owedToMe(rounds, me, now, DEFAULTS.nightEndHour);
  const ids = [...new Set([...mine, ...toMe].map((r) => r.id))];
  if (!ids.length) return;
  const details = new Map((await Promise.all(ids.map((id) => api('GET', `/rounds/${id}`).catch(() => null)))).filter(Boolean).map((d) => [d.id, d]));
  const link = (d, ...kids) => h('a', { class: 'pay-notice-row', href: `#/r/${d.id}`, onclick: () => box.replaceChildren() }, ...kids);
  const owe = mine.flatMap((r) => {
    const d = details.get(r.id);
    const debt = d?.debts.find((x) => lc(x.user) === lc(me));
    return debt ? [link(d, h('span', null, `${d.restaurant.name} · ${t('an')} ${d.buyer}`), h('strong', null, eur(debt.amount_cents)))] : [];
  });
  const owed = toMe.flatMap((r) => {
    const d = details.get(r.id);
    return (d?.debts ?? []).map((x) => link(d, h('span', null, `${x.user} ${t('über')} ${eur(x.amount_cents)}`), h('span', { class: 'muted' }, d.restaurant.name)));
  });
  if (!owe.length && !owed.length) return;
  const key = `${lc(me)}:${ids.join(',')}`;
  try { if (sessionStorage.getItem(seenKey) === key) return; } catch {}
  const close = () => { try { sessionStorage.setItem(seenKey, key); } catch {} box.replaceChildren(); };
  box.append(h('div', { class: 'card pay-notice-card' },
    h('div', { class: 'row between' }, h('strong', null, owe.length ? t('Du musst noch bezahlen:') : t('Zahlungen von')), h('button', { class: 'btn small ghost', type: 'button', 'aria-label': t('Schließen'), onclick: close }, '✕')),
    ...(owe.length ? owe : []),
    ...(owe.length && owed.length ? [h('strong', null, t('Zahlungen von'))] : []),
    ...owed,
    ...(owed.length ? [h('span', { class: 'muted' }, t('sind noch offen'))] : [])));
}

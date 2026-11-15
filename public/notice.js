// Nach dem Anmelden an einem späteren Tag: offene Zahlungen (eigene und die bei einem selbst offenen) als Overlay in der Mitte
import { t } from '/i18n.js';
import { DEFAULTS, NOTICE } from '/config.js';
import { h, api, eur, me, lc, fmtDay, fmtClock, closeIcon } from '/util.js';
import { owedByMe, owedToMe } from '/format.js';
import { debtCard } from '/views/round/debt-row.js';

const box = document.getElementById('pay-notice');
const seenKey = 'bb_pay_notice';
let offKey = null; // entfernt den Escape-Handler eines noch offenen Overlays

export async function showOpenPayments() {
  offKey?.();
  box.replaceChildren();
  if (!me) return;
  const rounds = (await api('GET', '/rounds?all=1').catch(() => [])) ?? [];
  const now = Date.now();
  const mine = owedByMe(rounds, me, now, DEFAULTS.nightEndHour);
  const toMe = owedToMe(rounds, me, now, DEFAULTS.nightEndHour);
  const ids = [...new Set([...mine, ...toMe].map((r) => r.id))];
  if (!ids.length) return;
  const details = new Map((await Promise.all(ids.map((id) => api('GET', `/rounds/${id}`).catch(() => null)))).filter(Boolean).map((d) => [d.id, d]));
  // Datum je Bestellung; die Uhrzeit kommt dazu, wenn mehrere der gezeigten Bestellungen am selben Tag liegen
  const dayKey = (ms) => new Date(ms).toDateString();
  const perDay = new Map();
  for (const d of details.values()) perDay.set(dayKey(d.created_at), (perDay.get(dayKey(d.created_at)) ?? 0) + 1);
  const when = (d) => `${fmtDay(d.created_at, false)}${perDay.get(dayKey(d.created_at)) > 1 ? `, ${fmtClock(d.created_at)}` : ''}`;
  const link = (d, left, right) => debtCard(left, right, { tag: 'a', href: `#/r/${d.id}`, foot: when(d), onclick: () => box.replaceChildren() }); // Datum (und ggf. Uhrzeit) unten rechts
  const owe = mine.flatMap((r) => {
    const d = details.get(r.id);
    const debt = d?.debts.find((x) => lc(x.user) === lc(me));
    return debt ? [link(d, h('strong', null, `${d.restaurant.name} · ${t('an')} ${d.buyer}`), h('strong', null, eur(debt.amount_cents)))] : [];
  });
  const owed = toMe.flatMap((r) => {
    const d = details.get(r.id);
    return (d?.debts ?? []).map((x) => link(d, h('strong', null, `${x.user} ${t('über')} ${eur(x.amount_cents)}`), h('strong', null, d.restaurant.name)));
  });
  if (!owe.length && !owed.length) return;
  const key = `${lc(me)}:${ids.join(',')}`;
  try { if (!NOTICE.showEveryLoad && sessionStorage.getItem(seenKey) === key) return; } catch {}
  const opener = document.activeElement;
  const close = () => {
    try { sessionStorage.setItem(seenKey, key); } catch {}
    box.replaceChildren();
    box.onclick = null;
    offKey?.();
    opener?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const closeBtn = h('button', { class: 'btn small ghost chip-btn overlay-close', type: 'button', 'aria-label': t('Schließen'), onclick: close }, closeIcon());
  const title = h('strong', { id: 'pay-notice-title' }, owe.length ? t('Du musst noch bezahlen:') : t('Offene Zahlungen an dich:'));
  const card = h('div', { class: 'card overlay-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pay-notice-title', tabindex: '-1' },
    closeBtn,
    title,
    ...(owe.length ? owe : []),
    ...(owe.length && owed.length ? [h('strong', null, t('Offene Zahlungen an dich:'))] : []),
    ...owed);
  box.append(card);
  box.onclick = (e) => { if (e.target === box) close(); }; // Klick neben die Karte schließt
  document.addEventListener('keydown', onKey);
  offKey = () => { document.removeEventListener('keydown', onKey); offKey = null; };
  card.focus(); // Fokus auf den Dialog (ohne Ring); mit Tab erreicht man den Schließen-Knopf
}

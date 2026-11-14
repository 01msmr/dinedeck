// Alle Bestellungen: Historie nach Monaten (letzte 12), ältere nach Jahren.
import { t } from '/i18n.js';
import { LISTS } from '/config.js';
import { groupHistory, isCurrentRound } from '/group.js';
import { TIMING } from '/config.js';
import { app, h, api, act, fmtDate, lc, me } from '/util.js';
import { debtRowEl } from '/views/round/debt-row.js';
import { roundItem } from '/views/home.js';
import { groupTitle } from '/side.js';

export function allView() {
  const overview = h('div', { class: 'debts-overview' });
  const body = h('div', { class: 'hist' });
  app.replaceChildren(h('h2', null, t('Alle Bestellungen')), overview, body);
  let open = []; // Details der Bestellungen mit offenen Zahlungen
  let ask = null; // { key, timer }: Rückfrage „ist bezahlt?“

  // Offene Zahlungen über alle Bestellungen, wie in der einzelnen Bestellung
  function drawOverview() {
    const n = open.reduce((a, d) => a + d.debts.length, 0);
    if (!n) return overview.replaceChildren();
    overview.replaceChildren(
      h('div', { class: 'banner bad' }, t(n === 1 ? '1 offene Zahlung' : '{n} offene Zahlungen', { n })),
      ...open.flatMap((d) => [
        h('a', { class: 'debt-round', href: `#/r/${d.id}` }, `${d.restaurant.name} · ${fmtDate(d.created_at)} · ${t('bestellt von')} ${d.buyer}`),
        h('div', { class: 'status-debts' }, ...d.debts.map((x) => {
          const key = `${d.id}:${lc(x.user)}`;
          return debtRowEl(x, {
            asking: ask?.key === key,
            onClick: lc(x.user) === lc(me) || d.viewer.is_buyer
              ? async () => {
                  if (ask?.key === key) {
                    clearTimeout(ask.timer);
                    ask = null;
                    await act(() => api('POST', `/rounds/${d.id}/paid`, { user: x.user, value: true }));
                    return view.refresh();
                  }
                  clearTimeout(ask?.timer);
                  ask = { key, timer: setTimeout(() => { ask = null; drawOverview(); }, TIMING.confirmMs) };
                  drawOverview();
                }
              : null,
          });
        })),
      ])
    );
  }

  const view = {
    async refresh() {
      const rounds = await api('GET', '/rounds?all=1').catch(() => null);
      if (!rounds) return;
      open = (await Promise.all(rounds.filter((r) => r.ordered && (r.debts_users ?? []).length).map((r) => api('GET', `/rounds/${r.id}`).catch(() => null)))).filter((d) => d && d.debts.length);
      drawOverview();
      const now = Date.now();
      const today = rounds.filter((r) => isCurrentRound(r, now));
      const rest = rounds.filter((r) => !isCurrentRound(r, now));
      body.replaceChildren(
        ...(today.length ? [h('h3', null, t('Heute')), h('div', { class: 'list' }, ...today.map((r) => roundItem(r, true)))] : []),
        ...(rest.length ? groupHistory(rest, now, LISTS.historyMonths).flatMap((g) => [h('h3', null, groupTitle(g)), h('div', { class: 'list' }, ...g.items.map((r) => roundItem(r)))]) : []),
        ...(rounds.length ? [] : [h('span', { class: 'muted' }, t('Noch nichts abgeschlossen.'))])
      );
    },
    destroy() { clearTimeout(ask?.timer); },
  };
  return view;
}

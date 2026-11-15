// Alle Bestellungen: Historie nach Monaten (letzte 12), ältere nach Jahren.
import { t } from '/i18n.js';
import { LISTS } from '/config.js';
import { groupHistory, isCurrentRound } from '/group.js';
import { app, h, api, fmtDay, recycleIcon, toast } from '/util.js';
import { roundItem } from '/views/home.js';
import { groupTitle } from '/side.js';

export function allView() {
  const overview = h('div', { class: 'debts-overview' });
  const body = h('div', { class: 'hist' });
  const filterKey = 'bb_all_filter';
  let onlyUnpaid = false;
  try { onlyUnpaid = sessionStorage.getItem(filterKey) === 'unpaid'; } catch {}
  let rounds = [];
  const box = h('input', { type: 'checkbox', checked: onlyUnpaid, onchange: (e) => { onlyUnpaid = e.target.checked; try { sessionStorage.setItem(filterKey, onlyUnpaid ? 'unpaid' : 'all'); } catch {} drawList(); } });
  // Aus der gefilterten Liste geöffnet: dieselbe Auswahl im Tab „Alle“ der Bestellung
  body.addEventListener('click', (e) => {
    if (onlyUnpaid && e.target.closest('a.round-link')) { try { sessionStorage.setItem('bb_user_filter', 'unpaid'); } catch {} }
  });
  const trash = h('div', { class: 'trash-bar' });
  app.replaceChildren(h('div', { class: 'all-head' }, h('h2', null, t('Alle Bestellungen')), h('label', { class: 'card filter-bar' }, box, t('Nur Unbezahlte'))), overview, body, trash);
  // Zuletzt gelöschte Bestellungen am unteren Fensterrand; das Symbol holt sie zurück
  function drawTrash(list) {
    trash.classList.toggle('hidden', !list.length);
    trash.replaceChildren(...list.map((x) => h('button', { class: 'trash-item', type: 'button', title: t('Wiederherstellen'), onclick: async () => {
      try { await api('POST', `/rounds/${x.id}/restore`); } catch (e) { toast(e.message); }
      view.refresh();
    } }, recycleIcon(), h('span', null, x.restaurant), h('span', { class: 'trash-when' }, fmtDay(x.created_at, false)))));
  }
  // Nur die Anzahl offener Zahlungen; Namen und Beträge stehen in der Bestellzeile
  function drawOverview(rounds) {
    const n = rounds.filter((r) => r.ordered).reduce((a, r) => a + (r.debts_users ?? []).length, 0);
    overview.replaceChildren(...(n ? [h('div', { class: 'banner bad' }, t(n === 1 ? '1 offene Zahlung' : '{n} offene Zahlungen', { n }))] : []));
  }

  const view = {
    async refresh() {
      const list = await api('GET', '/rounds?all=1').catch(() => null);
      if (!list) return;
      rounds = list;
      drawOverview(rounds);
      drawList();
      drawTrash((await api('GET', '/rounds/deleted').catch(() => [])) ?? []);
    },
    destroy() {},
  };
  function drawList() {
      const shown = onlyUnpaid ? rounds.filter((r) => r.unpaid) : rounds;
      const now = Date.now();
      const today = shown.filter((r) => isCurrentRound(r, now));
      const rest = shown.filter((r) => !isCurrentRound(r, now));
      body.replaceChildren(
        ...(today.length ? [h('h3', null, t('Heute')), h('div', { class: 'list' }, ...today.map((r) => roundItem(r, true)))] : []),
        ...(rest.length ? groupHistory(rest, now, LISTS.historyMonths).flatMap((g) => [h('h3', null, groupTitle(g)), h('div', { class: 'list' }, ...g.items.map((r) => roundItem(r)))]) : []),
        ...(shown.length ? [] : [h('span', { class: 'muted' }, t(rounds.length ? 'Keine passenden Bestellungen.' : 'Noch nichts abgeschlossen.'))])
      );
  }
  return view;
}

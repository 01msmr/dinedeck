// dinedeck – Frontend (Vanilla JS, ES-Module, keine Build-Schritte)
// Einstieg: Name wählen, Router (#/ Start, #/new, #/r/<Nr>, #/all, #/stats), Live-Updates per SSE.
import { t } from '/i18n.js';
import { LIMITS, TIMING } from '/config.js';
import { app, h, me, setMe, nav, api, isGuest, homeName } from '/util.js';
import { startRound } from '/group.js';
import { loadSide } from '/side.js';
import { showOpenPayments } from '/notice.js';
import { homeView } from '/views/home.js';
import { roundView } from '/views/round.js';
import { statsView } from '/views/stats.js';
import { allView } from '/views/all.js';

const whoBtn = document.getElementById('who');
const whoWrap = whoBtn.parentElement;
const settingsSrc = document.getElementById('settings-src'); // Modus, Sprache, Farbe: erscheinen im Nutzer-Popup unter „Einstellungen“

function askName(overlay = false) {
  return new Promise((resolve) => {
    const known = h('datalist', { id: 'known-users' });
    api('GET', '/users').then((n) => known.replaceChildren(...n.map((x) => h('option', { value: x })))).catch(() => {});
    const input = h('input', { placeholder: t('Dein Name'), maxlength: LIMITS.userName, autofocus: true, value: me, list: 'known-users', autocomplete: 'off' });
    const close = () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKey);
      for (const seg of settingsPanel?.querySelectorAll('.seg') ?? []) settingsSrc.append(seg); // Schalter zurück ins Versteck, theme.js findet sie dort
      root.remove();
    };
    const outside = (e) => { if (!whoWrap.contains(e.target)) { close(); resolve(false); } };
    const onKey = (e) => { if (e.key === 'Escape') { close(); resolve(false); } };
    const done = (guest) => {
      if (!input.value.trim()) return input.focus();
      setMe(input.value, { guest });
      if (overlay) close();
      resolve(true);
    };
    const form = h(
      'form',
      {
        class: overlay ? null : 'card',
        onsubmit: (e) => {
          e.preventDefault();
          done(false);
        },
      },
      h('h2', null, t('Wie heißt du?')),
      h('p', { class: 'muted' }, t('Gleicher Name = gleiche Person.')),
      h('div', { class: 'grow' }, input, known),
      h('p', { class: 'guest-link' }, h('button', { class: 'link-quiet', type: 'button', title: t('Bestelle für jemand anderen'), onclick: () => done(true) }, t('Als Gast'))), // Gast: Nebensache, nur ein leiser Textlink
      h(
        'div',
        { class: 'form-actions mt-4 gap-3 wrap' },
        isGuest && homeName()
          ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { setMe(homeName()); if (overlay) close(); resolve(true); } }, `${t('Zurück zu')} ${homeName()}`)
          : null,
        h('button', { class: 'btn', type: 'submit' }, t('Los'))
      )
    );
    // Im Popup: zwei Reiter, „Name“ und „Einstellungen“ (Modus, Sprache, Farbe)
    const settingsPanel = overlay
      ? h('div', { class: 'pop-settings', hidden: true }, ...[...settingsSrc.querySelectorAll('.seg')].map((seg) => h('div', { class: 'pop-row' }, h('span', null, t(seg.dataset.i18nTitle)), seg)))
      : null;
    const tabName = h('button', { class: 'pop-tab', type: 'button', role: 'tab', 'aria-selected': 'true', onclick: () => showTab(true) }, t('Name'));
    const tabSet = h('button', { class: 'pop-tab', type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => showTab(false) }, t('Einstellungen'));
    const showTab = (name) => {
      tabName.setAttribute('aria-selected', String(name));
      tabSet.setAttribute('aria-selected', String(!name));
      form.hidden = !name;
      settingsPanel.hidden = name;
    };
    const root = overlay ? h('div', { class: 'card name-pop' }, h('span', { class: 'name-pop-arrow', 'aria-hidden': 'true' }), h('div', { class: 'pop-tabs', role: 'tablist' }, tabName, tabSet), form, settingsPanel) : form;
    if (overlay) {
      whoWrap.append(root);
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', onKey);
    } else app.replaceChildren(form);
    input.focus();
  });
}

whoBtn.addEventListener('click', async () => {
  if (whoWrap.querySelector('.name-pop')) return;
  if (await askName(true)) { route(); showOpenPayments(); }
});

// ---------- Router ----------

let refreshTimer;

// Start: die aktuelle Bestellung öffnen; gibt es keine, „Alle Bestellungen“; ganz ohne Bestellungen das Formular für eine neue.
function startView() {
  let view = null;
  return {
    async refresh() {
      if (view) return view.refresh();
      const rounds = (await api('GET', '/rounds').catch(() => [])) ?? [];
      if ((location.hash || '#/') !== '#/') return;
      const pick = startRound(rounds, Date.now()); // neueste offene, sonst neueste von heute, sonst insgesamt neueste
      if (pick) return location.replace(`#/r/${pick.id}`);
      view = homeView();
      return view.refresh();
    },
    destroy() {
      view?.destroy?.();
    },
  };
}

function route() {
  nav.current?.destroy?.();
  nav.current = null;
  app.classList.remove('wide');
  if (!me) {
    askName().then(route);
    return;
  }
  const hash = location.hash || '#/';
  let m;
  if ((m = hash.match(/^#\/r\/(\d+)$/))) nav.current = roundView(Number(m[1]));
  else if (hash === '#/stats') nav.current = statsView();
  else if (hash === '#/all') nav.current = allView();
  else if (hash === '#/new') nav.current = homeView();
  else nav.current = startView();
  loadSide();
  nav.current.refresh();
}
window.addEventListener('hashchange', route);

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    nav.current?.refresh?.();
    loadSide();
  }, TIMING.refreshDebounceMs);
}
const es = new EventSource('/api/events');
es.onmessage = scheduleRefresh;
es.onopen = scheduleRefresh;
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleRefresh();
});

// ---------- Handy-Menü (Sidebar als Drawer) ----------
const menuBtn = document.getElementById('menu');
const setNav = (open) => {
  document.body.classList.toggle('nav-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
};
menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
document.getElementById('scrim').addEventListener('click', () => setNav(false));
document.getElementById('side').addEventListener('click', (e) => e.target.closest('a') && setNav(false));
window.addEventListener('hashchange', () => setNav(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && setNav(false));

// ---------- Start ----------
setMe(me, { guest: isGuest });
route();
showOpenPayments();

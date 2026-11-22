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
    // Gast fertig: zurück zum persönlichen Namen (Knopf im Reiter „Name“ und im Reiter „Gastbestellung“)
    const goHomeBtn = () => isGuest && homeName()
      ? h('button', { class: 'btn ghost', type: 'button', title: `${t('Zurück zu')} ${homeName()}`, onclick: () => { setMe(homeName()); if (overlay) close(); resolve(true); } }, t('Gastbestellung abgeschlossen'))
      : null;
    const goHome = goHomeBtn();
    const go = h('button', { class: 'btn', type: 'submit' }, t('Los'));
    // Popup: knapp, Name und „Los“ in einer Zeile; die erste Seite (ohne Popup) behält Titel und Gast-Link
    const form = h(
      'form',
      {
        class: overlay ? null : 'card',
        onsubmit: (e) => {
          e.preventDefault();
          done(false);
        },
      },
      overlay ? null : h('h2', null, t('Wie heißt du?')),
      h('div', { class: overlay ? 'pop-inline' : 'grow' }, input, known, overlay ? go : null),
      overlay ? null : h('p', { class: 'guest-link' }, h('button', { class: 'link-quiet', type: 'button', title: t('Bestelle für jemand anderen'), onclick: () => done(true) }, t('Als Gast'))),
      overlay ? (goHome ? h('div', { class: 'mt-2' }, goHome) : null) : h('div', { class: 'form-actions mt-4 gap-3 wrap' }, goHome, go)
    );
    // Im Popup drei Reiter: „Name“, „Einstellungen“ (Modus, Sprache, Farbe) und „Gastbestellung“
    const settingsPanel = overlay
      ? h('div', { class: 'pop-settings', hidden: true }, ...[...settingsSrc.querySelectorAll('.seg')].map((seg) => h('div', { class: 'pop-row' }, h('span', null, t(seg.dataset.i18nTitle)), seg)))
      : null;
    const guestInput = h('input', { placeholder: t('Name des Gasts'), maxlength: LIMITS.userName, autocomplete: 'off' });
    const goHome2 = goHomeBtn();
    const guestPanel = overlay
      ? h('form', { hidden: true, onsubmit: (e) => { e.preventDefault(); if (!guestInput.value.trim()) return guestInput.focus(); setMe(guestInput.value, { guest: true }); close(); resolve(true); } },
        h('p', { class: 'muted pop-hint' }, t('Bestelle für jemand anderen')),
        h('div', { class: 'pop-inline' }, guestInput, h('button', { class: 'btn', type: 'submit' }, t('Los'))),
        goHome2 ? h('div', { class: 'mt-2' }, goHome2) : null)
      : null;
    const tab = (label, which) => h('button', { class: 'pop-tab', type: 'button', role: 'tab', 'aria-selected': String(which === 0), onclick: () => showTab(which) }, label);
    const tabs = [tab(t('Name'), 0), tab(t('Einstellungen'), 1), tab(t('Gastbestellung'), 2)];
    const showTab = (which) => {
      [form, settingsPanel, guestPanel].forEach((el, i) => { el.hidden = i !== which; tabs[i].setAttribute('aria-selected', String(i === which)); });
      (which === 0 ? input : which === 2 ? guestInput : null)?.focus();
    };
    const root = overlay ? h('div', { class: 'card name-pop' }, h('span', { class: 'name-pop-arrow', 'aria-hidden': 'true' }), h('div', { class: 'pop-tabs', role: 'tablist' }, ...tabs), form, settingsPanel, guestPanel) : form;
    if (overlay) {
      whoWrap.append(root);
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', onKey);
    } else app.replaceChildren(form);
    input.focus();
  });
}

whoBtn.addEventListener('click', async () => {
  if (whoWrap.querySelector('.name-pop')) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return; } // zweiter Klick schließt das Menü
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
const wide = matchMedia('(min-width: 80em)'); // breit: schmale Leiste am Rand, ein Klick hinein öffnet sie, ein Klick außerhalb schließt sie
const sideEl = document.getElementById('side');
const placeMenu = () => (wide.matches ? sideEl : document.querySelector('header.top')).prepend(menuBtn); // breit: Hamburger in der Leiste, schmal: im Kopf
placeMenu();
wide.addEventListener('change', placeMenu);
menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
document.getElementById('scrim').addEventListener('click', () => setNav(false));
sideEl.addEventListener('click', (e) => {
  if (wide.matches) { if (!document.body.classList.contains('nav-open') && !e.target.closest('.side-new, .rail-no, .side-link, #menu')) setNav(true); } else if (e.target.closest('a')) setNav(false); // „+“, Nummern, Alle und Statistik führen nur zur Seite, die Leiste bleibt zu
});
document.addEventListener('click', (e) => {
  if (wide.matches && document.body.classList.contains('nav-open') && !sideEl.contains(e.target) && !menuBtn.contains(e.target)) setNav(false);
});
window.addEventListener('hashchange', () => { if (!wide.matches) setNav(false); });
document.addEventListener('keydown', (e) => e.key === 'Escape' && setNav(false));

// ---------- Start ----------
setMe(me, { guest: isGuest });
route();
showOpenPayments();

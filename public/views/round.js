// Bestellseite: Frist, Banner, Bezahlen, Tabs (Nach Usern / Meine / Bestellen), offene Beträge.
import { t, lang } from '/i18n.js';
import { LIMITS, DEFAULTS, LISTS, TIMING } from '/config.js';
import { orderContent, orderActions } from '/views/round/order.js';
import { createStatus } from '/views/round/status.js';
import { confirmDialog } from '/dialog.js';
import { nbspUnits, payHref, isToday, beforeThisYear, usableEta } from '/format.js';
import { flagBadge as flagBadgeOf, renderUsers as renderUsersList } from '/views/round/users.js';
import { checkPill } from '/views/check-pill.js';
import { payRows } from '/views/round/pay.js';
import { app, eur, fmtDate, fmtDay, fmtClock, lc, h, toast, api, act, me, contactLinks, fmtRemaining, fold, parseMoney, flashButton, money, nav } from '/util.js';

// Ausklapp-Chevron wie im Finder: dünner Winkel mit runden Enden, dreht sich beim Öffnen nach unten
// Pfeil als Schriftzeichen: skaliert mit der Schrift des Namens

export function roundView(id) {
  let d = null;
  let skew = 0;
  let expiredRefreshed = false;
  let catalogLoaded = false;
  let tab = sessionStorage.getItem('bb_tab') || 'mine';

  const head = h('section', { class: 'card' });
  const timerNum = h('div', { class: 'timer' }, '--:--');
  const timerLabel = h('div', { class: 'muted' });
  const timerCard = h('section', { class: 'card fold-item' }, h('div', null, timerLabel, timerNum));
  // Status-Zeilen (nicht ready, unbezahlt, Freigaben) als markante Leiste unter dem Kopf
  const banners = h('div', { class: 'status-lines' });
  const debtsHost = h('div', { class: 'debts-host' });
  // Ablaufleiste: breit im Kopf neben dem Logo, schmal als eigene Zeile unter dem Kopf
  const flowHost = h('div', { class: 'flow-host' });
  const wideQ = matchMedia('(min-width: 80em)');
  const placeFlow = () => {
    document.getElementById('flow-slot').replaceChildren(...(wideQ.matches ? [flowHost] : []));
    document.getElementById('statusbar').replaceChildren(...(wideQ.matches ? [] : [flowHost]), banners);
  };
  placeFlow();
  wideQ.addEventListener('change', placeFlow);
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const usersPane = h('div', { class: 'users-pane' });
  const minePane = h('div', { class: 'stack-4 mine-pane' });
  const payCard = h('section', { class: 'card band-card pay-card hidden' }); // „Bezahlen“: Bezahl-Link, QR-Code und Kopieren als letztes Element im eigenen Tab
  const orderPane = h('div', { class: 'card order-pane' });
  const inEta = h('input', { type: 'number', min: 1, max: LIMITS.etaMaxMinutes, value: DEFAULTS.etaMinutes, inputmode: 'numeric', class: 'w-eta' });
  const etaText = h('div', { class: 'semibold' });
  const orderCard = h('section', { class: 'card order-card hidden' });
  let wasOrdered = null;
  let etaPrefilled = false;

  // Persistente Eingabezeile (wird bei Live-Updates nicht neu gebaut)
  const inArticle = h('input', { 'aria-label': t('Artikel'), placeholder: t('Artikel'), maxlength: LIMITS.article, required: true, autocomplete: 'off' });
  const inVariant = h('input', { 'aria-label': t('Variante (optional)'), placeholder: t('z. B. 26 cm, Fladenbrot, scharf'), maxlength: LIMITS.variant, autocomplete: 'off' });
  const inPrice = h('input', { 'aria-label': t('Preis'), placeholder: '0,00', inputmode: 'decimal', required: true });
  const inQty = h('input', { 'aria-label': t('Menge'), type: 'number', min: LIMITS.qtyMin, max: LIMITS.qtyMax, value: 1 });
  const addBtn = h('button', { class: 'btn', type: 'submit' }, t('Hinzufügen'));
  const sugBox = h('div', { class: 'assist' });
  let catalog = []; // gelernte Namen dieses Restaurants (nur Vorschläge, nichts wird automatisch gesetzt)

  const loadCatalog = async () => {
    catalog = (await api('GET', `/rounds/${id}/catalog`).catch(() => null)) ?? catalog;
    updateAssist();
  };
  const knownEntry = () => catalog.find((e) => fold(e.article) === fold(inArticle.value));
  const knownVariant = (e) => e?.variants.find((v) => fold(v.variant) === fold(inVariant.value));

  function updateAssist() {
    const q = fold(inArticle.value);
    const e = knownEntry();
    const parts = [];
    if (e) {
      for (const v of e.variants.filter((v) => v.variant).slice(0, LISTS.suggestMax)) {
        parts.push(h('button', { type: 'button', class: 'pill', onclick: () => { inVariant.value = v.variant; updateAssist(); } }, v.variant));
      }
      const kv = knownVariant(e);
      // Preis wird NIE vorausgefüllt – nur als Hinweis angeboten, damit er bewusst geprüft wird.
      if (kv?.last_price_cents != null) {
        parts.push(h('button', { type: 'button', class: 'pill price', onclick: () => { inPrice.value = money(kv.last_price_cents); inPrice.focus(); } }, t('zuletzt {p} (ungeprüft) – übernehmen', { p: eur(kv.last_price_cents) })));
      }
    }
    sugBox.replaceChildren(...parts);
  }
  // Dropdown unter dem Artikelfeld: leeres Feld (Klick) zeigt alle bekannten Artikel des Restaurants, beim Tippen gefiltert
  const artMenu = h('div', { class: 'art-menu', role: 'listbox', hidden: true });
  let artActive = -1;
  const artItems = () => [...artMenu.children];
  const hideArtMenu = () => { artMenu.hidden = true; artActive = -1; };
  const pickArt = (name) => { inArticle.value = name; hideArtMenu(); updateAssist(); inVariant.focus(); };
  const markActive = (n) => { artActive = n; artItems().forEach((el, i) => { el.classList.toggle('active', i === n); if (i === n) el.scrollIntoView({ block: 'nearest' }); }); };
  function showArtMenu() {
    const q = fold(inArticle.value);
    const list = catalog.filter((c) => !q || fold(c.article).includes(q)).filter((c) => fold(c.article) !== q);
    artMenu.replaceChildren(...list.map((c) => h('button', { type: 'button', role: 'option', class: 'art-opt', tabindex: -1, onmousedown: (ev) => { ev.preventDefault(); pickArt(c.article); } }, c.article)));
    artMenu.hidden = !list.length;
    artActive = -1;
  }
  inArticle.addEventListener('click', showArtMenu);
  inArticle.addEventListener('blur', hideArtMenu);
  inArticle.addEventListener('keydown', (ev) => {
    if (artMenu.hidden) { if (ev.key === 'ArrowDown') { ev.preventDefault(); showArtMenu(); } return; } // per Tastatur öffnet ↓ die Liste
    const n = artItems().length;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); markActive((artActive + 1) % n); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); markActive((artActive - 1 + n) % n); }
    else if (ev.key === 'Enter' && artActive >= 0) { ev.preventDefault(); pickArt(artItems()[artActive].textContent); }
    else if (ev.key === 'Escape') hideArtMenu();
  });
  inArticle.addEventListener('input', () => { updateAssist(); showArtMenu(); });
  inVariant.addEventListener('input', updateAssist);

  const col = (cls, ...kids) => h('div', { class: 'c-' + cls }, ...kids);
  const addForm = h(
    'form',
    {
      class: 'card band-card item-card add-card',
      onsubmit: async (e) => {
        e.preventDefault();
        const price = parseMoney(inPrice.value);
        const kv = knownVariant(knownEntry());
        const ok = await act(() => api('POST', `/rounds/${id}/items`, { article: inArticle.value, variant: inVariant.value, price, qty: Number(inQty.value) || 1 }));
        if (ok) {
          if (kv?.last_price_cents != null && Math.round(price * 100) !== kv.last_price_cents) toast(t('Preis weicht ab – zuletzt {p}', { p: eur(kv.last_price_cents) }));
          inArticle.value = '';
          inVariant.value = '';
          inPrice.value = '';
          inQty.value = 1;
          hideArtMenu();
          inArticle.focus(); // Liste öffnet erst beim Klick ins Feld
          updateAssist();
          loadCatalog();
          nav.current.refresh();
        }
      },
    },
    h('div', { class: 'card-head' }, h('strong', null, t('Artikel hinzufügen'))), // abgetönte Kopfzeile wie bei den Nutzerkarten
    h('div', { class: 'item-row item-labels muted' }, col('qty', t('Menge')), col('art', t('Artikel')), col('var', t('Variante (optional)')), col('price', t('Preis')), col('act')),
    h('div', { class: 'item-row' }, col('qty', inQty), col('art', inArticle, artMenu), col('var', inVariant), col('price', h('div', { class: 'price-in' }, inPrice, h('span', { class: 'eur-box' }, '€'))), col('act', addBtn)),
    sugBox,
    h('div', { class: 'price-hint' }, t('Vorgeschlagene Preise stammen aus früheren Bestellungen und können veraltet sein.'))
  );
  const mineList = h('div', { class: 'card band-card item-card mine-card' });
  mineList.addEventListener('focusout', () => { if (mineDeferred) setTimeout(renderMine, 0); });
  minePane.append(addForm, mineList, payCard);

  const panes = { users: usersPane, mine: minePane, order: orderPane };
  const tabDefs = [
    ['mine', me],
    ['users', t('Alle')],
    ['order', t('Bestellliste')],
  ];
  function showTab(t) {
    tab = t;
    sessionStorage.setItem('bb_tab', t);
    roundMain.dataset.tab = t;
    for (const [k, p] of Object.entries(panes)) p.classList.toggle('hidden', k !== t);
    for (const b of tabsEl.children) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  }
  const readySlot = h('span', { class: 'tab-ready' }); // ready-Pille im Reiter des eigenen Namens
  for (const [k, label] of tabDefs) tabsEl.append(h('button', { 'data-tab': k, role: 'tab', onclick: () => showTab(k) }, ...(k === 'mine' ? [readySlot] : []), h('span', { class: 'tab-label' }, k === 'order' ? [h('span', { class: 'tl-long' }, label), h('span', { class: 'tl-short' }, t('Bestellen'))] : label)));

  // Mobil untereinander; ab Desktop-Breite: links Tabs, rechts Frist/Banner/Bezahlen (siehe style.css)
  app.classList.add('wide', 'round'); // Rahmen steht fest, nur der Inhalt darunter scrollt
  head.classList.add('round-head', 'folded'); // der Kopf bleibt immer schmal, es gibt kein Aufklappen
  const roundMain = h('div', { class: 'round-main' }, tabsEl, usersPane, minePane, orderPane);
  const roundScroll = h('div', { class: 'round-scroll' }, debtsHost, roundMain);
  const roundGrid = h('div', { class: 'round-grid' }, head, roundScroll);
  // Rad und Wischen über Kopf, Bestellkopf, Streifen und Seitenrändern scrollen die Fläche: breit die sichtbare Fläche, schmal den ganzen Inhalt
  const scrollTarget = () => {
    const pane = Object.values(panes).find((p) => !p.classList.contains('hidden'));
    return pane && getComputedStyle(pane).overflowY === 'auto' ? pane : roundScroll;
  };
  const page = document.querySelector('.page');
  const outside = (e) => !scrollTarget().contains(e.target); // was nicht ohnehin selbst scrollt
  const onWheel = (e) => { if (outside(e) && !e.target.closest('.name-pop, .overlay')) scrollTarget().scrollTop += e.deltaY; };
  let touchY = null;
  const onTouchStart = (e) => { touchY = outside(e) && !e.target.closest('input, textarea, select, .name-pop, .overlay') ? e.touches[0].clientY : null; };
  const onTouchMove = (e) => { if (touchY === null) return; const y = e.touches[0].clientY; scrollTarget().scrollTop += touchY - y; touchY = y; };
  page.addEventListener('wheel', onWheel, { passive: true });
  page.addEventListener('touchstart', onTouchStart, { passive: true });
  page.addEventListener('touchmove', onTouchMove, { passive: true });
  app.replaceChildren(roundGrid);
  showTab(tab);

  const toggle = async (path, body) => {
    await act(() => api('POST', `/rounds/${id}/${path}`, body));
    nav.current.refresh();
  };
  const patchRound = async (body) => { // Schritt vor/zurück oder Lieferzeit setzen
    await act(() => api('PATCH', `/rounds/${id}`, body));
    nav.current.refresh();
  };
  const advance = (key) => { // nächster Schritt: schließen, bestellt (mit vorbelegter Lieferzeit) bzw. geliefert
    if (key === 'close') return timeAction('lock');
    const eta = inEta.value === '' ? {} : { eta_minutes: Number(inEta.value) };
    return patchRound(key === 'ordered' ? { ordered: true, ...eta } : { delivered: true });
  };
  // Lieferzeit: erst nach „Bestellt“ in der Ablaufzeile vor „geliefert“; Eingabe wird sofort übernommen
  const etaField = h('label', { class: 'step-eta' }, h('span', { class: 'eta-lbl' }, t('Lieferung')), inEta, t('min.'));
  inEta.addEventListener('change', () => { if (d?.ordered_at && !d.delivered_at && inEta.value !== '') patchRound({ eta_minutes: Number(inEta.value) }); });
  inEta.addEventListener('keydown', (e) => { if (e.key === 'Enter') inEta.blur(); });
  const status = createStatus({ banners, flowHost, debtsHost, toggle, decide, undo: patchRound, advance, etaField, time: timeAction, autoClose: (v) => patchRound({ close_when_ready: v }) });

  const flagBadge = (u, flag) => flagBadgeOf(d, toggle, u, flag);

  // Dauerhaftes Formular (Besteller, PayPal, Lieferkosten): wird bei Live-Updates nicht neu gebaut; ungespeicherte Eingaben bleiben
  const eBuyer = h('input', { maxlength: LIMITS.userName, list: 'buyer-round', autocomplete: 'off' });
  const buyerList = h('datalist', { id: 'buyer-round' }); // Vorschläge: die Teilnehmer dieser Bestellung
  const ePaypal = h('input', { maxlength: LIMITS.paypal });
  const eFee = h('input', { inputmode: 'decimal' });
  const eService = h('input', { inputmode: 'decimal' });
  const editInputs = [eBuyer, ePaypal, eFee, eService];
  const saveBtn = h('button', { class: 'btn small', type: 'submit', disabled: true }, t('Speichern'));
  const editFill = h('i');
  const editBar = h('div', { class: 'edit-bar hidden' }, h('span', null, t('Nicht gespeichert – wird zurückgenommen')), h('div', { class: 'edit-track' }, editFill));
  let saved = ['', '', '', ''];
  let deadline = 0;
  let editTick = null;
  const stopEdit = () => {
    clearInterval(editTick);
    editTick = null;
    editBar.classList.add('hidden');
  };
  // Speichern nur bei Änderung; ohne Bestätigung nach editRevertMs wird zurückgesetzt (Balken in den letzten editWarnMs)
  function tickEdit() {
    const left = deadline - Date.now();
    if (left <= 0) {
      editInputs.forEach((i, n) => (i.value = saved[n]));
      syncEdit(false);
      toast(t('Änderung zurückgenommen'));
      return;
    }
    editBar.classList.toggle('hidden', left > TIMING.editWarnMs);
    editFill.style.width = `${Math.min(100, (left / TIMING.editWarnMs) * 100)}%`;
  }
  function syncEdit(restart) {
    editInputs.forEach((i, n) => (i.dataset.dirty = i.value !== saved[n] ? '1' : ''));
    const dirty = editInputs.some((i) => i.dataset.dirty);
    saveBtn.disabled = !dirty;
    if (!dirty) return stopEdit();
    if (restart) deadline = Date.now() + TIMING.editRevertMs;
    editTick ??= setInterval(tickEdit, TIMING.barTickMs);
    tickEdit();
  }
  for (const i of editInputs) i.addEventListener('input', () => syncEdit(true));
  const headBand = h('div', { class: 'head-band' });
  const delSlot = h('span', { class: 'del-slot' });
  const headForm = h(
    'form',
    {
      id: 'head-form',
      class: 'head-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const ok = await act(() => api('PATCH', `/rounds/${id}`, { buyer: eBuyer.value, paypal: ePaypal.value, delivery_fee: parseMoney(eFee.value), service_fee: parseMoney(eService.value) }));
        if (ok) {
          saved = editInputs.map((i) => i.value);
          syncEdit(false);
        }
        nav.current.refresh();
      },
    },
    h('label', null, t('Bestellt von'), eBuyer, buyerList),
    h('label', null, 'PayPal', ePaypal),
    h('span', { class: 'form-break' }), // Liefer- und Servicekosten beginnen eine neue Zeile
    delSlot, // Löschen links neben den Kosten
    h('label', null, t('Lieferkosten (€)'), eFee),
    h('label', null, t('Servicekosten (€)'), eService),
    saveBtn,
    editBar
  );
  // Hinweis im Löschen-Dialog: Archivzeit, dazu Link nach „Alle Bestellungen“ (der Dialog schließt beim Klick)
  const archiveHint = () => {
    const [before, after] = t('sie lassen sich in {link} wiederherstellen.').split('{link}');
    return [t('Die gelöschten Bestellungen der letzten {weeks} Wochen werden archiviert,', { weeks: LISTS.deletedKeepDays / 7 }), h('br'), before, h('a', { href: '#/all' }, h('strong', null, t('Alle Bestellungen'))), after];
  };
  // Löschen: nur Ersteller oder Admin, mit Sicherheitsabfrage
  const deleteBtn = h('button', {
    class: 'btn small danger', type: 'button',
    onclick: async () => {
      const ok = await confirmDialog({
        title: t('Bestellung löschen?'),
        text: [t('„{name}“ vom {date} wird gelöscht.', { name: d.restaurant.name, date: fmtDate(d.created_at) }), archiveHint()],
        confirm: t('Löschen'),
      });
      if (!ok) return;
      await act(() => api('DELETE', `/rounds/${id}`));
      toast(t('Bestellung gelöscht'));
      location.hash = '#/';
    },
  }, t('Bestellung löschen'));
  head.append(headBand, h('div', { class: 'head-side' }, timerCard, orderCard));

  // Klick auf die Bestellnummer: Link zu dieser Bestellung in die Zwischenablage
  async function copyOrderUrl(e) {
    const btn = e.currentTarget; // nach dem await ist currentTarget leer
    try {
      await navigator.clipboard.writeText(`${location.origin}/#/r/${d.id}`);
      flashButton(btn, `✓ ${t('Kopiert')}`);
    } catch {
      flashButton(btn, `✕ ${t('Kopieren nicht möglich')}`, 2500);
    }
  }

  function renderHead() {
    const manage = d.viewer.can_manage;
    const locked = !!d.ordered_at; // ab „Bestellt“ nicht mehr änderbar: Formular entfällt, das spart eine Zeile
    const editable = manage && !locked;
    const payHref0 = d.paypal_visible && d.paypal && !d.viewer.is_buyer ? payHref(d.paypal, 0) : null; // allgemeiner Bezahllink ohne Betrag, für alle außer dem Besteller
    const payLink = payHref0 ? [h('a', { class: 'head-paylink', href: payHref0, target: '_blank', rel: 'noopener noreferrer', title: t('Bezahlen') }, payHref0.replace(/^https?:\/\//, ''))] : [];
    const sub = [...(d.restaurant.address ? [h('span', { class: 'head-address muted' }, d.restaurant.address)] : []), ...payLink, ...(editable ? [headForm] : [])];
    delSlot.replaceChildren(...(editable && d.viewer.can_delete ? [deleteBtn] : []));
    headBand.replaceChildren(
      h('h2', { class: 'round-title' }, h('span', { class: 'round-date' + (isToday(d.created_at, Date.now(), DEFAULTS.nightEndHour) ? ' round-time' : '') }, isToday(d.created_at, Date.now(), DEFAULTS.nightEndHour) ? fmtClock(d.created_at) : fmtDay(d.created_at, beforeThisYear(d.created_at))), h('span', { class: 'round-name' }, d.restaurant.name), h('button', { class: 'round-no', type: 'button', title: t('Link zur Bestellung kopieren'), onclick: copyOrderUrl }, `#${d.id}`), h('span', { class: 'round-buyer' }, h('strong', null, d.buyer), ` ${t('bestellt')}`)),
      h('div', { class: 'head-fold' }, h('div', { class: 'head-fold-in' }, // Handy: klappt beim Scrollen zu, die erste Zeile mit Besteller bleibt
        h('div', { class: 'head-contact' }, h('div', { class: 'row' }, ...orderActions(d), contactLinks(d.restaurant, { linkPill: true }), ...(d.viewer.can_delete && !editable ? [deleteBtn] : []))), // Kontakt zum Bestellen für alle; Löschen nur Ersteller/Admin
        ...(sub.length ? [h('div', { class: 'head-sub' }, ...sub)] : []) // 2. Zeile: Adresse links, dahinter (Besteller, Ersteller, Admins) das schmale Formular
      ))
    );
    buyerList.replaceChildren(...d.users.map((u) => h('option', { value: u.user })));
    const vals = [d.buyer, d.paypal, money(d.delivery_fee_cents), money(d.service_fee_cents)];
    saved = vals;
    editInputs.forEach((i, n) => {
      if (!i.dataset.dirty) i.value = vals[n];
    });
    syncEdit(false);
    for (const i of editInputs) i.disabled = locked;
    saveBtn.classList.toggle('hidden', locked);
    editBar.classList.toggle('hidden', locked || editBar.classList.contains('hidden'));
  }

  // Bestellt-Meldung und geschätzte Lieferzeit (Ersteller/Besteller/Admins setzen, alle sehen live)
  function renderOrderStatus() {
    const manage = d.viewer.can_manage;
    const ordered = !!d.ordered_at;
    if (!etaPrefilled) {
      etaPrefilled = true;
      const eta = usableEta(d.restaurant.delivery_minutes, LIMITS.etaMaxMinutes);
      if (eta !== null) inEta.value = eta;
    }
    if (d.eta_minutes && document.activeElement !== inEta) inEta.value = d.eta_minutes; // gespeicherte Lieferzeit anzeigen (auch nach Neuladen)
    orderCard.classList.toggle('hidden', !ordered && !manage);
    orderCard.classList.toggle('fold-item', !!d.delivered_at); // nach „geliefert“ bleibt nichts zu tun: eingeklappt
    inEta.title = d.restaurant.delivery_count ? t('Ø {n} min bei diesem Restaurant', { n: d.restaurant.delivery_minutes }) : '';
    const kids = [];
    if (ordered && !d.delivered_at) kids.push(etaText);
    orderCard.replaceChildren(...kids.filter(Boolean));
    if (wasOrdered === false && ordered) toast(d.eta_at ? t('✓ Bestellt – Lieferung ca. {time}', { time: fmtClock(d.eta_at) }) : t('✓ Bestellt'));
    wasOrdered = ordered;
    updateEta();
  }
  function updateEta() {
    if (!d?.eta_at) {
      etaText.textContent = '';
      return;
    }
    const left = d.eta_at - (Date.now() + skew);
    etaText.textContent = `${t('Lieferung ca. {time}', { time: fmtClock(d.eta_at) })} · ${left > 0 ? `${t('noch')} ${fmtRemaining(left)}` : t('sollte da sein')}`;
  }

  function renderTimerControls() {
    timerLabel.textContent = d.locked ? t('Bestellfrist abgelaufen – Bestellung geschlossen') : t('Bestellfrist');
  }
  async function timeAction(action, minutes) {
    await act(() => api('POST', `/rounds/${id}/time`, { action, minutes }));
    expiredRefreshed = false;
    nav.current.refresh();
  }

  const renderBanners = () => status.render(d);
  async function decide(body) {
    await act(() => api('PATCH', `/rounds/${id}`, body));
    nav.current.refresh();
  }

  const renderUsers = () => renderUsersList(d, toggle, usersPane);

  let undo = null;
  function showUndo(item, at) {
    clearTimeout(undo?.timer);
    undo = { item, at, start: Date.now(), timer: setTimeout(() => { undo = null; renderMine(); }, TIMING.undoMs) };
  }
  async function doUndo() {
    const { item } = undo;
    clearTimeout(undo.timer);
    undo = null;
    await act(() => api('POST', `/rounds/${id}/items`, { article: item.article, variant: item.variant, price: item.price_cents / 100, qty: item.qty }));
    nav.current.refresh();
  }
  let mineDeferred = false;
  function renderMine() {
    if (mineList.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') { mineDeferred = true; return; }
    mineDeferred = false;
    const locked = d.locked;
    for (const el of [inArticle, inVariant, inPrice, inQty, addBtn]) el.disabled = locked;
    const mineU = d.users.find((u) => lc(u.user) === lc(me));
    if (!mineU) {
      readySlot.replaceChildren();
      mineList.replaceChildren(h('div', { class: 'card-head' }, h('strong', null, t('Meine Artikel'))), h('div', { class: 'muted' }, locked ? t('Bestellung ist geschlossen.') : t('Noch nichts eingetragen.')));
      return;
    }
    const stepper = (i, delta) =>
      h(
        'button',
        {
          class: 'btn small ghost',
          'aria-label': delta > 0 ? t('Menge erhöhen') : t('Menge verringern'),
          disabled: locked || mineU.done || i.qty + delta < LIMITS.qtyMin || i.qty + delta > LIMITS.qtyMax,
          onclick: async () => {
            await act(() => api('PATCH', `/items/${i.id}`, { qty: i.qty + delta }));
            nav.current.refresh();
          },
        },
        delta > 0 ? '+' : '−'
      );
    const closed = locked || mineU.done;
    const priceCell = (c) => h('div', { class: 'price-in' }, h('span', { class: 'num-box' }, money(c)), h('span', { class: 'eur-box' }, '€'));
    const sumRow = (label, cents, cls = '') => h('div', { class: `sum-row ${cls}` }, h('div', { class: 'c-lbl' }, label), h('div', { class: 'c-amt' }, priceCell(cents)));
    const counted = d.users.filter((u) => u.subtotal_cents > 0).length;
    // Gelöschter Artikel bleibt an seiner Stelle (durchgestrichen) mit „Rückgängig“; der Knopf leert sich in TIMING.undoMs von links nach rechts
    const undoRow = () => {
      const i = undo.item;
      const btn = h('button', { class: 'btn small undo-btn', type: 'button', style: `--undo-ms: ${TIMING.undoMs}ms`, onclick: doUndo }, h('span', { class: 'undo-fill', style: `animation-delay: -${Date.now() - undo.start}ms`, 'aria-hidden': 'true' }), h('span', { class: 'undo-label' }, t('Rückgängig')));
      return h('div', { class: 'item-row item-line undo-line' }, col('qty', h('span', { class: 'muted gone' }, `${i.qty}×`)), col('art', h('span', { class: 'muted gone' }, i.article)), col('var', h('span', { class: 'muted gone' }, nbspUnits(i.variant))), col('price', h('span', { class: 'muted gone' }, `${money(i.price_cents)} €`)), col('act', btn));
    };
    const withUndoRow = (rows) => (undo ? rows.toSpliced(Math.min(undo.at, rows.length), 0, undoRow()) : rows);
    const itemRow = (i) => {
      const qtyCol = col('qty', h('div', { class: 'row nowrap gap-1' }, stepper(i, -1), h('strong', null, String(i.qty)), stepper(i, 1)));
      const del = h('button', { class: 'btn small danger', disabled: closed, title: t('Entfernen'), onclick: async () => { const at = mineU.items.indexOf(i); if ((await act(() => api('DELETE', `/items/${i.id}`))) !== null) showUndo(i, at); nav.current.refresh(); } }, '✕');
      if (closed) return h('div', { class: 'item-row item-line' }, qtyCol, col('art', i.article), col('var', h('span', { class: 'muted' }, nbspUnits(i.variant))), col('price', priceCell(i.price_cents)));
      const field = (key, value, max, extra) => h('input', { value, maxlength: max, autocomplete: 'off', ...extra, onchange: async (e) => { await act(() => api('PATCH', `/items/${i.id}`, { [key]: e.target.value })); nav.current.refresh(); } });
      return h('div', { class: 'item-row item-line' }, qtyCol, col('art', field('article', i.article, LIMITS.article, { required: true, 'aria-label': t('Artikel') })), col('var', field('variant', i.variant || '', LIMITS.variant, { 'aria-label': t('Variante (optional)') })), col('price', h('div', { class: 'price-in' }, field('price', money(i.price_cents), 12, { inputmode: 'decimal', 'aria-label': t('Preis') }), h('span', { class: 'eur-box' }, '€'))), col('act', del));
    };
    const readyPill = checkPill(t('ready'), {
      on: mineU.done,
      dim: mineU.paid || !!d.delivered_at, // nach „bezahlt“ und ab „geliefert“ blasser (dann nicht mehr änderbar)
      title: mineU.done ? null : t('Klicken: als ready bestätigen'),
      nested: true,
      onclick: mineU.paid || d.delivered_at || (mineU.done && locked) ? null : () => toggle('done', { user: mineU.user, value: !mineU.done }),
    });
    readySlot.replaceChildren(readyPill);
    mineList.replaceChildren(
      ...(mineU.done ? [] : [h('div', { class: 'ready-strip flow unready' }, t('unready – Artikel zählen noch nicht'))]), // Hinweis nur solange nicht ready
      h('div', { class: 'row between card-head' }, h('strong', null, t('Meine Artikel')), lc(mineU.user) === lc(d.buyer) ? null : h('div', { class: 'row' }, flagBadge(mineU, 'paid'))),
      mineU.items.length || undo
        ? h(
            'div',
            { class: 'item-list' },
            withUndoRow(mineU.items.map(itemRow))
          )
        : h('div', { class: 'muted' }, t('Noch nichts eingetragen.')),
      h('div', { class: 'mt-4 stack-1' },
        sumRow(t('Summe Artikel'), mineU.excluded ? mineU.preview_cents : mineU.subtotal_cents), // nicht ready: Vorschau, zählt noch nicht
        mineU.fee_cents ? sumRow(`${t('Liefer- und Serviceanteil')} (${t('{fee} / {n} Besteller', { fee: eur(d.delivery_fee_cents + d.service_fee_cents), n: counted })})`, mineU.fee_cents) : null,
        sumRow(t('Summe'), mineU.excluded ? mineU.preview_cents : mineU.total_cents, 'total'))
    );
  }

  function renderPay() {
    const rows = d.ordered_at ? payRows(d) : null; // bezahlt wird erst ab „Bestellt“
    payCard.classList.toggle('hidden', !rows);
    if (rows) payCard.replaceChildren(h('div', { class: 'card-head' }, h('strong', null, t('Bezahlen'))), ...rows);
  }

  function renderOrder() {
    orderPane.replaceChildren(...orderContent(d).filter(Boolean));
  }

  function updateTimer() {
    if (!d) return;
    updateEta();
    const left = d.expires_at - (Date.now() + skew);
    if (left <= 0) {
      timerNum.textContent = t('GESCHLOSSEN');
      timerNum.className = 'timer done';
      if (!d.locked && !expiredRefreshed) {
        expiredRefreshed = true;
        nav.current.refresh();
      }
    } else {
      timerNum.textContent = fmtRemaining(left);
      timerNum.className = 'timer' + (left < TIMING.lowTimeMs ? ' low' : '');
    }
  }
  const tick = setInterval(updateTimer, TIMING.tickMs);

  return {
    async refresh() {
      try {
        d = await api('GET', `/rounds/${id}`);
      } catch (e) {
        app.replaceChildren(h('div', { class: 'card' }, h('p', null, e.message), h('a', { href: '#/' }, t('← Zurück'))));
        clearInterval(tick);
        return;
      }
      skew = d.server_now - Date.now();
      if (!catalogLoaded) {
        catalogLoaded = true;
        loadCatalog();
      }
      renderHead();
      renderTimerControls();
      renderOrderStatus();
      renderBanners();
      renderUsers();
      renderMine();
      renderPay();
      renderOrder();
      updateTimer();
    },
    destroy() {
      clearInterval(tick);
      stopEdit();
      wideQ.removeEventListener('change', placeFlow);
      page.removeEventListener('wheel', onWheel);
      page.removeEventListener('touchstart', onTouchStart);
      page.removeEventListener('touchmove', onTouchMove);
      document.getElementById('statusbar').replaceChildren();
      document.getElementById('flow-slot').replaceChildren();
    },
  };
}


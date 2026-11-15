// Bestellseite: Frist, Banner, Bezahlen, Tabs (Nach Usern / Meine / Bestellen), offene Beträge.
import { t, lang } from '/i18n.js';
import { LIMITS, DEFAULTS, LISTS, TIMING } from '/config.js';
import { isCurrentRound } from '/group.js';
import { orderContent, orderActions } from '/views/round/order.js';
import { createStatus } from '/views/round/status.js';
import { confirmDialog } from '/dialog.js';
import { nbspUnits } from '/format.js';
import { flagBadge as flagBadgeOf, renderUsers as renderUsersList } from '/views/round/users.js';
import { app, eur, fmtWhen, fmtDate, fmtClock, lc, h, toast, api, act, me, contactLinks, fmtRemaining, fold, parseMoney, money, nav } from '/util.js';

// Ausklapp-Chevron wie im Finder: dünner Winkel mit runden Enden, dreht sich beim Öffnen nach unten
// Pfeil als Schriftzeichen: skaliert mit der Schrift des Namens
const disclosureTriangle = () => h('span', { class: 'tri', 'aria-hidden': 'true' }, '›');

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
  document.getElementById('statusbar').replaceChildren(banners);
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const usersPane = h('div', { class: 'users-pane' });
  const minePane = h('div', { class: 'stack-4 mine-pane' });
  const orderPane = h('div', { class: 'card order-pane' });
  const inEta = h('input', { type: 'number', min: 1, max: LIMITS.etaMaxMinutes, value: DEFAULTS.etaMinutes, inputmode: 'numeric', class: 'w-eta' });
  const etaText = h('div', { class: 'semibold' });
  const orderCard = h('section', { class: 'card order-card hidden' });
  let wasOrdered = null;
  const foldKey = `bb_fold_${id}`;
  let foldOpen = false; // Details sind standardmäßig zugeklappt; die Wahl gilt je Bestellung für die Sitzung
  try { foldOpen = sessionStorage.getItem(foldKey) === 'open'; } catch {}
  const setFold = (open) => { foldOpen = open; try { sessionStorage.setItem(foldKey, open ? 'open' : 'closed'); } catch {} renderHead(); };
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
    if (q && !e) {
      for (const c of catalog.filter((c) => fold(c.article).includes(q)).slice(0, LISTS.suggestMax)) {
        parts.push(h('button', { type: 'button', class: 'pill', onmousedown: (ev) => ev.preventDefault(), onclick: () => { inArticle.value = c.article; updateAssist(); inVariant.focus(); } }, c.article));
      }
    }
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
  inArticle.addEventListener('input', updateAssist);
  inVariant.addEventListener('input', updateAssist);

  const col = (cls, ...kids) => h('div', { class: 'c-' + cls }, ...kids);
  const addForm = h(
    'form',
    {
      class: 'card item-card add-card',
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
          inArticle.focus();
          updateAssist();
          loadCatalog();
          nav.current.refresh();
        }
      },
    },
    h('h3', { class: 'add-title' }, t('Artikel hinzufügen')),
    h('div', { class: 'item-row item-labels muted' }, col('qty', t('Menge')), col('art', t('Artikel')), col('var', t('Variante (optional)')), col('price', t('Preis')), col('act')),
    h('div', { class: 'item-row' }, col('qty', inQty), col('art', inArticle), col('var', inVariant), col('price', h('div', { class: 'price-in' }, inPrice, h('span', { class: 'eur-box' }, '€'))), col('act', addBtn)),
    sugBox,
    h('div', { class: 'price-hint' }, h('strong', null, t('Preise selbst prüfen. ')), t('Vorgeschlagene Preise stammen aus früheren Bestellungen und können veraltet sein.'))
  );
  const mineList = h('div', { class: 'card item-card mine-card' });
  mineList.addEventListener('focusout', () => { if (mineDeferred) setTimeout(renderMine, 0); });
  minePane.append(addForm, mineList);

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
  for (const [k, label] of tabDefs) tabsEl.append(h('button', { 'data-tab': k, role: 'tab', onclick: () => showTab(k) }, label));

  // Mobil untereinander; ab Desktop-Breite: links Tabs, rechts Frist/Banner/Bezahlen (siehe style.css)
  app.classList.add('wide');
  head.classList.add('round-head');
  const roundMain = h('div', { class: 'round-main' }, tabsEl, usersPane, minePane, orderPane);
  const roundGrid = h('div', { class: 'round-grid' }, head, debtsHost, roundMain);
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
  const etaField = h('label', { class: 'step-eta' }, t('Lieferzeit (min)'), inEta);
  inEta.addEventListener('change', () => { if (d?.ordered_at && !d.delivered_at && inEta.value !== '') patchRound({ eta_minutes: Number(inEta.value) }); });
  inEta.addEventListener('keydown', (e) => { if (e.key === 'Enter') inEta.blur(); });
  const status = createStatus({ banners, debtsHost, toggle, decide, undo: patchRound, advance, etaField, time: timeAction, autoClose: (v) => patchRound({ close_when_ready: v }) });

  const flagBadge = (u, flag) => flagBadgeOf(d, toggle, u, flag);

  // Dauerhaftes Formular (Besteller, PayPal, Lieferkosten): wird bei Live-Updates nicht neu gebaut; ungespeicherte Eingaben bleiben
  const eBuyer = h('input', { maxlength: LIMITS.userName });
  const ePaypal = h('input', { maxlength: LIMITS.paypal });
  const eFee = h('input', { inputmode: 'decimal', form: 'head-form' }); // steht oben neben der Adresse, gehört zum Formular
  const editInputs = [eBuyer, ePaypal, eFee];
  const saveBtn = h('button', { class: 'btn small', type: 'submit', disabled: true }, t('Speichern'));
  const editFill = h('i');
  const editBar = h('div', { class: 'edit-bar hidden' }, h('span', null, t('Nicht gespeichert – wird zurückgenommen')), h('div', { class: 'edit-track' }, editFill));
  let saved = ['', '', ''];
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
  const headPick = h('nav', { class: 'head-pick' });
  const addrEl = h('div', { class: 'muted fold-item' });
  const feeLabel = h('label', { class: 'fee-field fold-item' }, t('Lieferkosten (€)'), eFee);
  const headTop = h('div', { class: 'head-top' }, addrEl, feeLabel); // Adresse links, Lieferkosten rechts
  const headBand = h('div', { class: 'head-band' });
  const foldBtn = h('button', { class: 'fold-toggle', type: 'button', 'aria-label': t('Details ein-/ausklappen'), onclick: () => setFold(!foldOpen) }, disclosureTriangle()); // bleibt bestehen, damit sich der Pfeil animiert drehen kann
  headBand.append(foldBtn);
  headBand.addEventListener('click', (e) => {
    if (!d || !e.target.closest('.round-name')) return; // nur Chevron (eigener Knopf) und Restaurantname klappen auf und zu
    setFold(!foldOpen);
  });
  const headMeta = h('div', { class: 'muted mt-2 fold-item' });
  const headForm = h(
    'form',
    {
      id: 'head-form',
      class: 'grid2 mt-4 fold-item',
      onsubmit: async (e) => {
        e.preventDefault();
        const ok = await act(() => api('PATCH', `/rounds/${id}`, { buyer: eBuyer.value, paypal: ePaypal.value, delivery_fee: parseMoney(eFee.value) }));
        if (ok) {
          saved = editInputs.map((i) => i.value);
          syncEdit(false);
        }
        nav.current.refresh();
      },
    },
    h('label', null, t('Bestellt von'), eBuyer),
    h('label', null, 'PayPal', ePaypal),
    h('div', { class: 'form-actions inline' }, saveBtn), // Speichern am Ende der Zeile Besteller/PayPal
    editBar
  );
  // Löschen: nur Ersteller oder Admin, nur im aufgeklappten Kopf, mit Sicherheitsabfrage
  const deleteBtn = h('button', {
    class: 'btn small danger', type: 'button',
    onclick: async () => {
      const ok = await confirmDialog({
        title: t('Bestellung löschen?'),
        text: t('„{name}“ vom {date} wird mit allen Artikeln und Zahlungsständen endgültig gelöscht. Das lässt sich nicht rückgängig machen.', { name: d.restaurant.name, date: fmtDate(d.created_at) }),
        confirm: t('Endgültig löschen'),
      });
      if (!ok) return;
      await act(() => api('DELETE', `/rounds/${id}`));
      toast(t('Bestellung gelöscht'));
      location.hash = '#/';
    },
  }, t('Bestellung löschen'));
  const deleteRow = h('div', { class: 'row end fold-item' }, deleteBtn);
  head.append(headBand, headPick, h('div', { class: 'head-main' }, headTop, headMeta, h('div', { class: 'head-formrow' }, headForm, deleteRow)), h('div', { class: 'head-side' }, timerCard, orderCard));

  // Wechsel zwischen den heutigen/offenen Bestellungen (nur sichtbar, wenn es mehrere gibt)
  function renderPick(list) {
    const cur = (list ?? []).filter((x) => isCurrentRound(x, Date.now()));
    // Stack nur bei mehreren Bestellungen heute (bei einer steht sie direkt in der Sidebar)
    const show = cur.length > 1;
    head.classList.toggle('has-pick', show);
    headPick.replaceChildren(
      ...(show
        ? cur.map((x) => h('a', { class: 'pick-item' + (x.id === id ? ' active' : ''), href: `#/r/${x.id}` }, h('strong', null, x.restaurant), h('span', { class: 'muted' }, `${fmtWhen(x.created_at)} · ${x.creator}`)))
        : [])
    );
  }

  function renderHead() {
    headBand.classList.add('foldable');
    foldBtn.setAttribute('aria-expanded', String(foldOpen));
    for (const el of [...headBand.children]) if (el !== foldBtn) el.remove(); // foldBtn bleibt eingehängt, sonst gibt es keine Drehanimation
    headBand.append(
      h('h2', { class: 'round-title' }, h('span', { class: 'round-name' }, d.restaurant.name), h('span', { class: 'round-buyer' }, h('strong', null, d.buyer), ` ${t('bestellt')}`)),
      h('div', { class: 'head-contact' }, h('div', { class: 'row' }, ...orderActions(d), contactLinks(d.restaurant, { linkPill: true }))) // Kontakt zum Bestellen: immer sichtbar, für alle
    );
    addrEl.textContent = d.restaurant.address || '';
    head.classList.toggle('folded', !foldOpen);
    const manage = d.viewer.can_manage;
    headMeta.replaceChildren(...(manage || !d.delivery_fee_cents ? [] : [t('Lieferkosten: {fee}', { fee: eur(d.delivery_fee_cents) })]));
    headForm.classList.toggle('hidden', !manage);
    deleteRow.classList.toggle('hidden', !d.viewer.can_delete);
    feeLabel.classList.toggle('hidden', !manage);
    const vals = [d.buyer, d.paypal, money(d.delivery_fee_cents)];
    saved = vals;
    editInputs.forEach((i, n) => {
      if (!i.dataset.dirty) i.value = vals[n];
    });
    syncEdit(false);
    const locked = !!d.ordered_at; // ab „Bestellt“ nicht mehr änderbar
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
      if (d.restaurant.delivery_minutes >= 1) inEta.value = d.restaurant.delivery_minutes;
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
  function showUndo(item) {
    clearTimeout(undo?.timer);
    undo = { item, timer: setTimeout(() => { undo = null; renderMine(); }, TIMING.undoMs) };
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
      mineList.replaceChildren(h('h3', null, t('Meine Artikel')), h('div', { class: 'muted' }, locked ? t('Bestellung ist geschlossen.') : t('Noch nichts eingetragen.')));
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
    // persönlicher Ablauf: ready › bezahlt (Besteller: statt bezahlt der Hinweis); der zuletzt erreichte Schritt als grüne Pille
    const isBuyer = lc(mineU.user) === lc(d.buyer);
    const stp = (cls, txt) => h('span', { class: `step ${cls}` }, txt);
    const roleNote = h('span', { class: 'step role', title: t('Der Besteller zahlt bei der Bestellung und bekommt das Geld von den anderen.') }, `✓ (${t('ist Besteller')})`);
    const fade = d.ordered_at ? ' faded' : ''; // ab „Bestellt“ ist ready nur noch blass markiert
    const myFlow = mineU.done
      ? isBuyer
        ? [stp(`now ready${fade}`, t('✓ ready')), roleNote]
        : [stp(mineU.paid ? 'done' : `now ready${fade}`, t('✓ ready')), h('span', { class: 'step-sep' }, '›'), mineU.paid ? stp('now', `✓ ${t('bezahlt')}`) : stp('todo', t('bezahlt'))]
      : [t('unready – Artikel zählen nicht'), ...(isBuyer ? [roleNote] : [])];
    const priceCell = (c) => h('div', { class: 'price-in' }, h('span', { class: 'num-box' }, money(c)), h('span', { class: 'eur-box' }, '€'));
    const sumRow = (label, cents, cls = '') => h('div', { class: `sum-row ${cls}` }, h('div', { class: 'c-lbl' }, label), h('div', { class: 'c-amt' }, priceCell(cents)));
    const counted = d.users.filter((u) => u.subtotal_cents > 0).length;
    const itemRow = (i) => {
      const qtyCol = col('qty', h('div', { class: 'row nowrap gap-1' }, stepper(i, -1), h('strong', null, String(i.qty)), stepper(i, 1)));
      const del = h('button', { class: 'btn small danger', disabled: closed, title: t('Entfernen'), onclick: async () => { if ((await act(() => api('DELETE', `/items/${i.id}`))) !== null) showUndo(i); nav.current.refresh(); } }, '✕');
      if (closed) return h('div', { class: 'item-row item-line' }, qtyCol, col('art', i.article), col('var', h('span', { class: 'muted' }, nbspUnits(i.variant))), col('price', priceCell(i.price_cents)));
      const field = (key, value, max, extra) => h('input', { value, maxlength: max, autocomplete: 'off', ...extra, onchange: async (e) => { await act(() => api('PATCH', `/items/${i.id}`, { [key]: e.target.value })); nav.current.refresh(); } });
      return h('div', { class: 'item-row item-line' }, qtyCol, col('art', field('article', i.article, LIMITS.article, { required: true, 'aria-label': t('Artikel') })), col('var', field('variant', i.variant || '', LIMITS.variant, { 'aria-label': t('Variante (optional)') })), col('price', h('div', { class: 'price-in' }, field('price', money(i.price_cents), 12, { inputmode: 'decimal', 'aria-label': t('Preis') }), h('span', { class: 'eur-box' }, '€'))), col('act', del));
    };
    mineList.replaceChildren(
      h('div', { class: 'ready-strip flow' + (mineU.done ? '' : ' unready') }, ...myFlow),
      h('div', { class: 'row between' }, h('h3', { class: 'flush' }, t('Meine Artikel')), h('div', { class: 'row' }, lc(mineU.user) === lc(d.buyer) ? null : flagBadge(mineU, 'paid'))),
      ...(undo ? [h('div', { class: 'row between undo-row' }, h('span', { class: 'muted' }, t('Gelöscht: {name}', { name: undo.item.article })), h('button', { class: 'btn small', type: 'button', onclick: doUndo }, t('Rückgängig')))] : []),
      mineU.items.length
        ? h(
            'div',
            { class: 'item-list' },
            mineU.items.map(itemRow)
          )
        : h('div', { class: 'muted' }, t('Noch nichts eingetragen.')),
      h('div', { class: 'mt-4 stack-1' },
        sumRow(t('Summe Artikel'), mineU.excluded ? mineU.preview_cents : mineU.subtotal_cents), // nicht ready: Vorschau, zählt noch nicht
        mineU.fee_cents ? sumRow(`${t('Lieferanteil')} (${t('{fee} / {n} Besteller', { fee: eur(d.delivery_fee_cents), n: counted })})`, mineU.fee_cents) : null,
        sumRow(t('Summe'), mineU.excluded ? mineU.preview_cents : mineU.total_cents, 'total')),
      h('div', { class: 'row mt-3' }, h('span', { class: 'muted' }, t('Ready = deine Bestellung ist komplett. Bezahlt = du hast dem Besteller dein Geld gegeben.'))),
      h(
        'div',
        { class: 'ready-bar' + (mineU.done ? ' is-done' : '') },
        mineU.done ? h('span', null, t('✓ Ready')) : null,
        mineU.done && locked ? null : h('button', { class: 'btn ready', type: 'button', title: mineU.done ? null : t('Klicken: als ready bestätigen'), onclick: () => toggle('done', { user: mineU.user, value: !mineU.done }) }, mineU.done ? t('Artikel ändern') : t('○ unready'))
      )
    );
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
      api('GET', '/rounds').then(renderPick).catch(() => {});
      renderHead();
      renderTimerControls();
      renderOrderStatus();
      renderBanners();
      renderUsers();
      renderMine();
      renderOrder();
      updateTimer();
    },
    destroy() {
      clearInterval(tick);
      stopEdit();
      document.getElementById('statusbar').replaceChildren();
    },
  };
}


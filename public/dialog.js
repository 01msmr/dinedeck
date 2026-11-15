// Sicherheitsabfrage als Overlay (gleiches Muster wie die Zahlungs-Benachrichtigung); liefert true bei Bestätigung
import { t } from '/i18n.js';
import { h, closeIcon } from '/util.js';

const box = document.getElementById('dialog');

export function confirmDialog({ title, text, confirm, danger = true }) {
  return new Promise((resolve) => {
    const opener = document.activeElement;
    const done = (value) => {
      box.replaceChildren();
      box.onclick = null;
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    const card = h('div', { class: 'card overlay-card', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-title', 'aria-describedby': 'dialog-text', tabindex: '-1' },
      h('button', { class: 'btn small ghost chip-btn overlay-close', type: 'button', 'aria-label': t('Abbrechen'), onclick: () => done(false) }, closeIcon()),
      h('strong', { id: 'dialog-title' }, title),
      h('p', { id: 'dialog-text', class: 'flush' }, text),
      h('div', { class: 'row end gap-3' },
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => done(false) }, t('Abbrechen')),
        h('button', { class: `btn small ${danger ? 'danger solid' : ''}`, type: 'button', onclick: () => done(true) }, confirm)));
    box.append(card);
    box.onclick = (e) => { if (e.target === box) done(false); };
    document.addEventListener('keydown', onKey);
    card.focus();
  });
}

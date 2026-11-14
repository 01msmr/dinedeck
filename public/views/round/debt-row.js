// Zeile „Name – Betrag – als bezahlt markieren“ (zweistufig: erst Rückfrage „ist bezahlt?“)
import { t } from '/i18n.js';
import { eur, h } from '/util.js';

export function debtRowEl(x, { asking, onClick }) {
  return h('div', { class: 'debt-row' },
    h('span', null, x.user),
    h('span', { class: 'row' },
      h('strong', null, eur(x.amount_cents)),
      onClick ? h('button', { class: asking ? 'btn small' : 'btn small ghost', onclick: onClick }, asking ? t('ist bezahlt?') : t('als bezahlt markieren')) : null));
}

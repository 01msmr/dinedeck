// Pille mit führender Checkbox (ready, bezahlt): aus = weiß mit schwarzem Rand, an = grün; `dim` = blasser und nicht änderbar
import { h } from '/util.js';

export function checkPill(label, { on = false, dim = false, confirm = false, title = null, onclick = null, nested = false, cls = '' } = {}) {
  const el = h(onclick && !nested ? 'button' : 'span', { // nested: liegt in einem Button (Tab), daher Span mit Tastaturbedienung
    class: 'check-pill' + (on ? ' on' : '') + (dim ? ' dim' : '') + (confirm ? ' confirm' : '') + (onclick ? ' act' : '') + (cls ? ` ${cls}` : ''),
    type: onclick && !nested ? 'button' : null,
    tabindex: onclick && nested ? 0 : null,
    onkeydown: onclick && nested ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onclick(e); } } : null,
    role: 'checkbox',
    'aria-checked': String(on),
    'aria-disabled': onclick ? null : 'true',
    title,
    onclick: onclick && nested ? (e) => { e.stopPropagation(); onclick(e); } : onclick,
  }, h('span', { class: 'cp-box', 'aria-hidden': 'true' }, on ? '✓' : ''), h('span', { class: 'cp-label' }, label));
  return el;
}

/** Filter-Pille: schaltet sich selbst um und meldet den neuen Zustand; an = schwarz. */
export function filterPill(label, { on = false, onchange }) {
  const el = checkPill(label, {
    on,
    cls: 'filter',
    onclick: () => {
      on = !on;
      el.classList.toggle('on', on);
      el.setAttribute('aria-checked', String(on));
      el.querySelector('.cp-box').textContent = on ? '✓' : '';
      onchange(on);
    },
  });
  return el;
}

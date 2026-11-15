// Alle Symbole aus einer Vorlage: gleiche Zeichenfläche (24 × 24), Strichfarbe = Textfarbe, runde Enden, Größe = Schriftgröße
const NS = 'http://www.w3.org/2000/svg';

function svgIcon(shapes, { cls = '', stroke = 2.2, viewBox = '0 0 24 24' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  const attrs = { viewBox, width: '1em', height: '1em', fill: 'none', stroke: 'currentColor', 'stroke-width': String(stroke), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', ...(cls ? { class: cls } : {}) };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const [tag, a] of shapes) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}

export const userIcon = () => svgIcon([['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7' }]], { cls: 'user-icon' });
export const extArrow = () => svgIcon([['path', { d: 'M6 18L18 6M8 6h10v10' }]], { cls: 'ext-arrow', stroke: 2.4 }); // öffnet extern
export const lockIcon = () => svgIcon([['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]], { cls: 'lock-icon' });
export const undoIcon = () => svgIcon([['path', { d: 'M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3' }]], { cls: 'lock-icon' });
export const closeIcon = () => svgIcon([['path', { d: 'M6 6l12 12M18 6L6 18' }]], { cls: 'close-icon' });
export const copyIcon = () => svgIcon([['path', { d: 'M5 15V5a2 2 0 0 1 2-2h10' }], ['rect', { x: 9, y: 7, width: 12, height: 14, rx: 2 }]], { cls: 'copy-icon', viewBox: '1 0 24 24' }); // Zeichnung liegt bei x 5–21: Ausschnitt verschoben, damit sie mittig sitzt

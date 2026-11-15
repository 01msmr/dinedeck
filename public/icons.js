// Alle Symbole aus einer Vorlage: gleiche Zeichenfläche (24 × 24), Strichfarbe = Textfarbe, runde Enden, Größe = Schriftgröße
const NS = 'http://www.w3.org/2000/svg';

function svgIcon(shapes, { cls = '', stroke = 2.2, viewBox = '0 0 24 24', fill = 'none' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  const attrs = { viewBox, width: '1em', height: '1em', fill, stroke: 'currentColor', 'stroke-width': String(stroke), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', ...(cls ? { class: cls } : {}) };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const [tag, a] of shapes) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}

export const userIcon = () => svgIcon([['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7' }]], { cls: 'user-icon' });
export const phoneIcon = () => svgIcon([['path', { d: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z' }]], { cls: 'phone-icon', stroke: 1.5, fill: 'currentColor' }); // Telefonhörer
export const extArrow = () => svgIcon([['path', { d: 'M6 18L18 6M8 6h10v10' }]], { cls: 'ext-arrow', stroke: 2.4 }); // öffnet extern
export const lockIcon = () => svgIcon([['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }], ['path', { d: 'M8 11V8a4 4 0 0 1 8 0v3' }]], { cls: 'lock-icon' });
export const undoIcon = () => svgIcon([['path', { d: 'M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3' }]], { cls: 'lock-icon' });
export const closeIcon = () => svgIcon([['path', { d: 'M6 6l12 12M18 6L6 18' }]], { cls: 'close-icon' });
export const copyIcon = () => svgIcon([['path', { d: 'M5 15V5a2 2 0 0 1 2-2h10' }], ['rect', { x: 9, y: 7, width: 12, height: 14, rx: 2 }]], { cls: 'copy-icon', viewBox: '1 0 24 24' }); // Zeichnung liegt bei x 5–21: Ausschnitt verschoben, damit sie mittig sitzt
export const recycleIcon = () => svgIcon([
  ['path', { d: 'M7 19H4.8a1.8 1.8 0 0 1-1.6-.9 1.8 1.8 0 0 1 0-1.8L7.2 9.5' }],
  ['path', { d: 'M11 19h8.2a1.8 1.8 0 0 0 1.6-.9 1.8 1.8 0 0 0 0-1.8l-1.2-2.1' }],
  ['path', { d: 'm14 16-3 3 3 3' }],
  ['path', { d: 'M8.3 13.6 7.2 9.5 3.1 10.6' }],
  ['path', { d: 'm9.3 5.8 1.1-1.9A1.8 1.8 0 0 1 12 3a1.8 1.8 0 0 1 1.5.9l3.9 6.8' }],
  ['path', { d: 'm13.4 9.6 4.1 1.1 1.1-4.1' }],
], { cls: 'recycle-icon', stroke: 2 }); // wiederherstellen

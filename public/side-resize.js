// Seitenleiste: Breite durch Ziehen an der Trennlinie (Cursor zeigt es beim Überfahren)
import { SIDE } from '/config.js';
import { clampSideWidth } from '/format.js';

const root = document.documentElement;
const line = document.getElementById('side-resize');
const remPx = () => parseFloat(getComputedStyle(root).fontSize);
const apply = (rem) => root.style.setProperty('--side-w', `${rem}rem`);

try {
  const saved = Number(localStorage.getItem(SIDE.storageKey));
  if (saved >= SIDE.minRem && saved <= SIDE.maxRem) apply(saved);
} catch {}

let rem = 0;
line.addEventListener('pointerdown', (e) => {
  line.setPointerCapture(e.pointerId);
  document.body.classList.add('side-resizing');
});
line.addEventListener('pointermove', (e) => {
  if (!line.hasPointerCapture(e.pointerId)) return;
  rem = clampSideWidth(e.clientX, remPx(), SIDE.minRem, SIDE.maxRem);
  apply(rem);
});
line.addEventListener('pointerup', () => {
  document.body.classList.remove('side-resizing');
  if (!rem) return;
  try { localStorage.setItem(SIDE.storageKey, String(rem)); } catch {}
});

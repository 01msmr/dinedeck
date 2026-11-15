// Telefonklingeln: spielt die Aufnahme (SOUND.file) per Web Audio; ohne Datei bleibt es still
import { SOUND } from '/config.js';

let ctx = null;
let buffer = null;

const audio = () => (ctx ??= new (window.AudioContext || window.webkitAudioContext)());

// Aufnahme im Hintergrund laden und dekodieren
try {
  fetch(SOUND.file)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('fehlt'))))
    .then((data) => audio().decodeAudioData(data))
    .then((b) => { buffer = b; })
    .catch(() => {});
} catch {}

/** Klingelt einmal; false, wenn noch kein Ton möglich ist (Browser erlaubt Audio erst nach einer Eingabe, oder die Datei fehlt/lädt noch). */
export function ringPhone() {
  try {
    if (!buffer) return false;
    const c = audio();
    if (c.state === 'suspended') c.resume();
    if (c.state !== 'running') return false;
    const t0 = c.currentTime;
    const end = Math.min(SOUND.ringSeconds, buffer.duration - SOUND.fileStartSec);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.setValueAtTime(SOUND.volume, t0);
    g.gain.setValueAtTime(SOUND.volume, t0 + end - SOUND.fadeSec);
    g.gain.linearRampToValueAtTime(0, t0 + end);
    src.connect(g).connect(c.destination);
    src.start(t0, SOUND.fileStartSec, end);
    return true;
  } catch {
    return false;
  }
}

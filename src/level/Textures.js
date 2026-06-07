import * as THREE from 'three';

// Textures procédurales (aucun fichier externe) générées sur <canvas>.
// Elles sont en niveaux de gris clairs : utilisées comme `map`, elles
// MULTIPLIENT la couleur du matériau → chaque pièce garde sa teinte tout en
// gagnant un motif (parquet / carrelage / plâtre) et du relief (bumpMap).
//
// Le canvas de base est généré une seule fois puis cloné par surface afin de
// régler indépendamment la répétition (repeat) selon la taille de la pièce.

const ANISOTROPY = 8;
let _wood = null;
let _tile = null;
let _plaster = null;
let _metal = null;

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Clone configuré prêt à l'emploi (map couleur en sRGB).
function configured(base, rx, ry) {
  const t = base.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISOTROPY;
  return t;
}

// --- Parquet (planches horizontales + veinage) ---
function baseWood() {
  if (_wood) return _wood;
  const c = makeCanvas(256);
  const x = c.getContext('2d');
  x.fillStyle = '#d2d2d2';
  x.fillRect(0, 0, 256, 256);

  const plankH = 64;
  for (let py = 0; py < 256; py += plankH) {
    const b = 198 + Math.floor(Math.random() * 36); // teinte de planche
    x.fillStyle = `rgb(${b},${b},${b})`;
    x.fillRect(0, py, 256, plankH);

    // Veines du bois (lignes ondulées).
    for (let i = 0; i < 22; i++) {
      const gy = py + Math.random() * plankH;
      x.strokeStyle = `rgba(120,110,95,${0.04 + Math.random() * 0.08})`;
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(0, gy);
      for (let gx = 0; gx <= 256; gx += 16) x.lineTo(gx, gy + Math.sin(gx * 0.06 + py) * 1.6);
      x.stroke();
    }
    // Joint entre planches.
    x.strokeStyle = 'rgba(70,60,50,0.55)';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, py); x.lineTo(256, py); x.stroke();
  }
  _wood = new THREE.CanvasTexture(c);
  return _wood;
}

// --- Carrelage (grille de carreaux + joints) ---
function baseTile() {
  if (_tile) return _tile;
  const c = makeCanvas(256);
  const x = c.getContext('2d');
  const n = 4;            // carreaux par côté
  const s = 256 / n;
  x.fillStyle = '#7c7c7c'; // couleur des joints
  x.fillRect(0, 0, 256, 256);
  const grout = 4;
  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const b = 205 + Math.floor(Math.random() * 30);
      x.fillStyle = `rgb(${b},${b},${b})`;
      x.fillRect(ix * s + grout, iy * s + grout, s - grout * 2, s - grout * 2);
      // Léger reflet en haut à gauche du carreau.
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.fillRect(ix * s + grout, iy * s + grout, s - grout * 2, 3);
    }
  }
  _tile = new THREE.CanvasTexture(c);
  return _tile;
}

// --- Plâtre / mur (bruit doux quasi uniforme) ---
function basePlaster() {
  if (_plaster) return _plaster;
  const c = makeCanvas(256);
  const x = c.getContext('2d');
  x.fillStyle = '#ededed';
  x.fillRect(0, 0, 256, 256);
  // Mouchetures basse fréquence pour casser l'aplat.
  for (let i = 0; i < 1400; i++) {
    const r = 200 + Math.floor(Math.random() * 45);
    x.fillStyle = `rgba(${r},${r},${r},0.10)`;
    const px = Math.random() * 256, py = Math.random() * 256;
    const rad = 2 + Math.random() * 5;
    x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
  }
  _plaster = new THREE.CanvasTexture(c);
  return _plaster;
}

// --- Métal brossé (sol/industriel usine) ---
function baseMetal() {
  if (_metal) return _metal;
  const c = makeCanvas(256);
  const x = c.getContext('2d');
  x.fillStyle = '#c4c4c4';
  x.fillRect(0, 0, 256, 256);
  // Stries horizontales de brossage.
  for (let i = 0; i < 600; i++) {
    const y = Math.random() * 256;
    const a = 0.03 + Math.random() * 0.06;
    x.strokeStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${a})` : `rgba(90,90,90,${a})`;
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke();
  }
  _metal = new THREE.CanvasTexture(c);
  return _metal;
}

export function woodFloor(rx, ry) { return configured(baseWood(), rx, ry); }
export function tileFloor(rx, ry) { return configured(baseTile(), rx, ry); }
export function plasterWall(rx, ry) { return configured(basePlaster(), rx, ry); }
export function metalFloor(rx, ry) { return configured(baseMetal(), rx, ry); }

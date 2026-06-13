import * as THREE from 'three';

// Textures procédurales (aucun fichier externe) générées sur <canvas>.
//
// Chaque matériau fournit un trio PBR :
//   • map          → albédo en niveaux de gris clairs (MULTIPLIE la couleur du
//                    matériau, donc chaque pièce garde sa teinte).
//   • normalMap    → relief réaliste, calculé depuis un height-field (Sobel).
//                    Donne du grain/des joints en creux sous l'IBL.
//   • roughnessMap → rugosité variable (carreaux brillants vs joints mats,
//                    métal brossé anisotrope…).
//
// Les canvas de base (coûteux : le calcul de normales fait ~262k pixels) sont
// générés UNE seule fois puis réutilisés ; seules les textures GPU sont
// (re)créées par surface pour régler la répétition (repeat) selon la pièce.

const RES = 512;        // résolution des textures (puissance de 2 → mipmaps)
const ANISOTROPY = 16;  // filtrage max (clampé au matériel) → pas de scintillement aux angles rasants

let _wood = null;
let _tile = null;
let _plaster = null;
let _metal = null;
let _wallpaper = null;
let _subway = null;
let _brick = null;
let _concrete = null;
let _ceilPlaster = null;
let _ceilTile = null;
let _woodCeil = null;

function makeCanvas(size = RES) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Convertit un height-field (canvas en niveaux de gris) en normal map tangente.
// `strength` amplifie le relief perçu.
function heightToNormal(heightCanvas, strength) {
  const size = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const out = makeCanvas(size);
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  const o = img.data;
  // Échantillonnage avec enroulement (texture tileable).
  const H = (x, y) => {
    x = (x + size) % size; y = (y + size) % size;
    return src[(y * size + x) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1) || 1;
      const i = (y * size + x) * 4;
      o[i]     = ((dx / len) * 0.5 + 0.5) * 255;
      o[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      o[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      o[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// Crée une texture GPU configurée à partir d'un canvas de base.
// `srgb` = true pour l'albédo, false (linéaire) pour normal/roughness.
function configTex(canvas, rx, ry, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = ANISOTROPY;
  // Mipmaps + filtrage trilinéaire : indispensables pour éviter le moiré /
  // clignotement des détails fins quand la surface s'éloigne ou s'incline.
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// Empaquète le trio PBR d'un matériau de base avec une répétition donnée.
function pack(base, rx, ry) {
  return {
    map: configTex(base.color, rx, ry, true),
    normalMap: configTex(base.normal, rx, ry, false),
    roughnessMap: configTex(base.rough, rx, ry, false),
  };
}

// =====================================================================
//  PARQUET — planches horizontales, veinage, joints en creux
// =====================================================================
function woodBase() {
  if (_wood) return _wood;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  cc.fillStyle = '#d0d0d0'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#a6a6a6'; hc.fillRect(0, 0, RES, RES); // hauteur médiane
  rc.fillStyle = '#bcbcbc'; rc.fillRect(0, 0, RES, RES); // bois semi-mat

  const planks = 8;
  const ph = RES / planks;
  // Décalage de joints en bout de planche (motif "à l'anglaise").
  for (let p = 0; p < planks; p++) {
    const py = p * ph;
    const tone = 196 + Math.floor(Math.random() * 44);
    cc.fillStyle = `rgb(${tone},${tone},${tone})`;
    cc.fillRect(0, py + 2, RES, ph - 4);
    const hv = 150 + Math.floor(Math.random() * 55);
    hc.fillStyle = `rgb(${hv},${hv},${hv})`;
    hc.fillRect(0, py + 2, RES, ph - 4);

    // Veines du bois (lignes ondulées) — couleur, relief léger, rugosité.
    for (let i = 0; i < 46; i++) {
      const gy = py + Math.random() * ph;
      const a = 0.04 + Math.random() * 0.10;
      cc.strokeStyle = `rgba(96,86,72,${a})`;
      hc.strokeStyle = `rgba(70,70,70,${a * 0.8})`;
      rc.strokeStyle = `rgba(255,255,255,${a * 0.5})`; // veines plus mates
      cc.lineWidth = hc.lineWidth = rc.lineWidth = 1;
      const draw = (ctx) => {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        for (let gx = 0; gx <= RES; gx += 16)
          ctx.lineTo(gx, gy + Math.sin(gx * 0.05 + py) * 2.2);
        ctx.stroke();
      };
      draw(cc); draw(hc); draw(rc);
    }

    // Quelques nœuds occasionnels.
    if (Math.random() > 0.6) {
      const kx = Math.random() * RES, ky = py + ph * (0.3 + Math.random() * 0.4);
      const kr = 5 + Math.random() * 8;
      const g = cc.createRadialGradient(kx, ky, 1, kx, ky, kr);
      g.addColorStop(0, 'rgba(70,55,40,0.55)');
      g.addColorStop(1, 'rgba(70,55,40,0)');
      cc.fillStyle = g; cc.beginPath(); cc.arc(kx, ky, kr, 0, Math.PI * 2); cc.fill();
      const gh = hc.createRadialGradient(kx, ky, 1, kx, ky, kr);
      gh.addColorStop(0, 'rgba(40,40,40,0.6)');
      gh.addColorStop(1, 'rgba(40,40,40,0)');
      hc.fillStyle = gh; hc.beginPath(); hc.arc(kx, ky, kr, 0, Math.PI * 2); hc.fill();
    }

    // Joint entre planches : sombre, en creux, plus mat.
    const drawJoint = (ctx, style, w) => {
      ctx.strokeStyle = style; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(RES, py); ctx.stroke();
    };
    drawJoint(cc, 'rgba(55,45,35,0.7)', 3);
    drawJoint(hc, 'rgba(20,20,20,1)', 4);   // creux marqué pour la normal map
    drawJoint(rc, 'rgba(255,255,255,0.4)', 3);
  }

  _wood = { color, normal: heightToNormal(height, 3.0), rough };
  return _wood;
}

// =====================================================================
//  CARRELAGE — carreaux brillants, joints en creux mats
// =====================================================================
function tileBase() {
  if (_tile) return _tile;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  const n = 4;                 // carreaux par côté
  const s = RES / n;
  const grout = 8;
  // Fond = joints : sombre (albédo), creux (height), très mat (rough).
  cc.fillStyle = '#6f6f6f'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#3a3a3a'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#e6e6e6'; rc.fillRect(0, 0, RES, RES);

  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const x = ix * s + grout, y = iy * s + grout, w = s - grout * 2;
      const b = 206 + Math.floor(Math.random() * 30);
      cc.fillStyle = `rgb(${b},${b},${b})`;
      cc.fillRect(x, y, w, w);
      hc.fillStyle = '#dcdcdc';            // carreau en relief
      hc.fillRect(x, y, w, w);
      rc.fillStyle = '#585858';            // verni mais pas miroir (anti-scintillement)
      rc.fillRect(x, y, w, w);

      // Léger reflet en haut/gauche du carreau (albédo).
      cc.fillStyle = 'rgba(255,255,255,0.14)';
      cc.fillRect(x, y, w, 4);
      cc.fillRect(x, y, 4, w);
      // Mouchetures fines internes (variété).
      for (let k = 0; k < 30; k++) {
        const sx = x + Math.random() * w, sy = y + Math.random() * w;
        cc.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
        cc.fillRect(sx, sy, 1, 1);
      }
      // Chanfrein doux des bords (height) pour adoucir l'arête.
      hc.strokeStyle = 'rgba(150,150,150,0.6)'; hc.lineWidth = 3;
      hc.strokeRect(x + 1.5, y + 1.5, w - 3, w - 3);
    }
  }

  _tile = { color, normal: heightToNormal(height, 4.0), rough };
  return _tile;
}

// =====================================================================
//  PLÂTRE / MUR — aplat clair, mouchetures basse fréquence, relief doux
// =====================================================================
function plasterBase() {
  if (_plaster) return _plaster;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  cc.fillStyle = '#ededed'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#808080'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#f0f0f0'; rc.fillRect(0, 0, RES, RES); // plâtre très mat

  // Bosses basse fréquence (taloché).
  for (let i = 0; i < 220; i++) {
    const px = Math.random() * RES, py = Math.random() * RES;
    const rad = 14 + Math.random() * 40;
    const up = Math.random() > 0.5;
    const g = hc.createRadialGradient(px, py, 1, px, py, rad);
    const v = up ? 150 : 30;
    g.addColorStop(0, `rgba(${v},${v},${v},0.25)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    hc.fillStyle = g; hc.beginPath(); hc.arc(px, py, rad, 0, Math.PI * 2); hc.fill();
  }
  // Mouchetures fines (albédo + micro-rugosité).
  for (let i = 0; i < 4000; i++) {
    const r = 200 + Math.floor(Math.random() * 45);
    cc.fillStyle = `rgba(${r},${r},${r},0.10)`;
    const px = Math.random() * RES, py = Math.random() * RES;
    const rad = 1.5 + Math.random() * 4;
    cc.beginPath(); cc.arc(px, py, rad, 0, Math.PI * 2); cc.fill();
    rc.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
    rc.fillRect(px, py, 1, 1);
  }

  _plaster = { color, normal: heightToNormal(height, 1.4), rough };
  return _plaster;
}

// =====================================================================
//  MÉTAL BROSSÉ — sol industriel, stries horizontales anisotropes
// =====================================================================
function metalBase() {
  if (_metal) return _metal;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  cc.fillStyle = '#c2c2c2'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#808080'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#7a7a7a'; rc.fillRect(0, 0, RES, RES); // métal assez lisse

  // Stries de brossage horizontales (couleur + micro-relief + rugosité).
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * RES;
    const a = 0.03 + Math.random() * 0.07;
    const light = Math.random() > 0.5;
    cc.strokeStyle = light ? `rgba(255,255,255,${a})` : `rgba(80,80,80,${a})`;
    hc.strokeStyle = light ? `rgba(170,170,170,${a})` : `rgba(60,60,60,${a})`;
    rc.strokeStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    cc.lineWidth = hc.lineWidth = rc.lineWidth = 1;
    const draw = (ctx) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(RES, y); ctx.stroke(); };
    draw(cc); draw(hc); draw(rc);
  }

  // Grille de plaque industrielle : rivets + lignes de tôle.
  const cells = 4, cs = RES / cells;
  for (let gy = 0; gy <= cells; gy++) {
    cc.strokeStyle = 'rgba(60,60,60,0.5)'; cc.lineWidth = 2;
    cc.beginPath(); cc.moveTo(0, gy * cs); cc.lineTo(RES, gy * cs); cc.stroke();
    hc.strokeStyle = 'rgba(20,20,20,1)'; hc.lineWidth = 3;
    hc.beginPath(); hc.moveTo(0, gy * cs); hc.lineTo(RES, gy * cs); hc.stroke();
  }
  for (let gx = 0; gx <= cells; gx++) {
    cc.strokeStyle = 'rgba(60,60,60,0.5)'; cc.lineWidth = 2;
    cc.beginPath(); cc.moveTo(gx * cs, 0); cc.lineTo(gx * cs, RES); cc.stroke();
    hc.strokeStyle = 'rgba(20,20,20,1)'; hc.lineWidth = 3;
    hc.beginPath(); hc.moveTo(gx * cs, 0); hc.lineTo(gx * cs, RES); hc.stroke();
  }
  // Rivets aux intersections (bosses rondes).
  for (let gy = 0; gy <= cells; gy++) {
    for (let gx = 0; gx <= cells; gx++) {
      const rx = gx * cs, ry = gy * cs, rr = 4;
      const g = hc.createRadialGradient(rx, ry, 1, rx, ry, rr);
      g.addColorStop(0, 'rgba(220,220,220,0.9)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      hc.fillStyle = g; hc.beginPath(); hc.arc(rx, ry, rr, 0, Math.PI * 2); hc.fill();
      cc.fillStyle = 'rgba(255,255,255,0.25)';
      cc.beginPath(); cc.arc(rx, ry, rr, 0, Math.PI * 2); cc.fill();
    }
  }

  _metal = { color, normal: heightToNormal(height, 2.4), rough };
  return _metal;
}

// =====================================================================
//  PAPIER PEINT — rayures verticales + motif damassé embossé
//  (albédo neutre → teinté par pièce via la couleur du matériau)
// =====================================================================
function wallpaperBase() {
  if (_wallpaper) return _wallpaper;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  cc.fillStyle = '#ececec'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#808080'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#eaeaea'; rc.fillRect(0, 0, RES, RES); // satiné mat

  // Rayures verticales tonales subtiles.
  const stripes = 8, sw = RES / stripes;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) {
      cc.fillStyle = 'rgba(0,0,0,0.045)';
      cc.fillRect(i * sw, 0, sw, RES);
      rc.fillStyle = 'rgba(255,255,255,0.05)';
      rc.fillRect(i * sw, 0, sw, RES);
    }
  }

  // Motif damassé répété (rangées décalées d'une demi-cellule).
  const motif = (ctx, x, y, sc, stroke, fill) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = stroke; ctx.fillStyle = fill; ctx.lineWidth = 2;
    // Losange central.
    ctx.beginPath();
    ctx.moveTo(0, -10 * sc); ctx.lineTo(7 * sc, 0);
    ctx.lineTo(0, 10 * sc); ctx.lineTo(-7 * sc, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Quatre pétales (ellipses) en croix.
    for (let a = 0; a < 4; a++) {
      ctx.save(); ctx.rotate(a * Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, -16 * sc, 4 * sc, 9 * sc, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  };
  const g = 4, cell = RES / g;
  for (let iy = 0; iy <= g; iy++) {
    for (let ix = 0; ix <= g; ix++) {
      const ox = ix * cell + (iy % 2 ? cell / 2 : 0);
      const oy = iy * cell;
      motif(cc, ox, oy, 1.1, 'rgba(110,100,85,0.16)', 'rgba(120,110,95,0.10)');
      motif(hc, ox, oy, 1.1, 'rgba(170,170,170,0.7)', 'rgba(150,150,150,0.5)'); // embossé
    }
  }

  _wallpaper = { color, normal: heightToNormal(height, 1.1), rough };
  return _wallpaper;
}

// =====================================================================
//  FAÏENCE MÉTRO — carreaux rectangulaires brillants posés en quinconce
//  (albédo coloré blanc céramique → couleur matériau = blanc)
// =====================================================================
function subwayBase() {
  if (_subway) return _subway;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  const rows = 6, th = RES / rows, tw = RES / 3, grout = 6;
  cc.fillStyle = '#d6d2c8'; cc.fillRect(0, 0, RES, RES); // joints
  hc.fillStyle = '#3a3a3a'; hc.fillRect(0, 0, RES, RES); // joints en creux
  rc.fillStyle = '#e4e4e4'; rc.fillRect(0, 0, RES, RES); // joints mats

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) ? -tw / 2 : 0;           // quinconce
    for (let cIx = -1; cIx <= 3; cIx++) {
      const x = cIx * tw + off + grout, y = r * th + grout;
      const w = tw - grout * 2, h = th - grout * 2;
      const b = 244 + Math.floor(Math.random() * 11);
      cc.fillStyle = `rgb(${b},${b},${b - 4})`;
      cc.fillRect(x, y, w, h);
      hc.fillStyle = '#dcdcdc'; hc.fillRect(x, y, w, h);     // carreau saillant
      rc.fillStyle = '#5c5c5c'; rc.fillRect(x, y, w, h);     // émail satiné (anti-scintillement)
      // Reflet haut + biseau.
      const gl = cc.createLinearGradient(0, y, 0, y + h);
      gl.addColorStop(0, 'rgba(255,255,255,0.35)');
      gl.addColorStop(0.25, 'rgba(255,255,255,0)');
      cc.fillStyle = gl; cc.fillRect(x, y, w, h);
      hc.strokeStyle = 'rgba(150,150,150,0.6)'; hc.lineWidth = 3;
      hc.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    }
  }

  _subway = { color, normal: heightToNormal(height, 4.2), rough };
  return _subway;
}

// =====================================================================
//  MUR DE BRIQUES — rangées décalées, mortier en creux (albédo coloré)
// =====================================================================
function brickBase() {
  if (_brick) return _brick;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  const rows = 8, bh = RES / rows, bw = RES / 4, mortar = 5;
  cc.fillStyle = '#b3a89a'; cc.fillRect(0, 0, RES, RES); // mortier
  hc.fillStyle = '#2e2e2e'; hc.fillRect(0, 0, RES, RES); // mortier en creux
  rc.fillStyle = '#f0f0f0'; rc.fillRect(0, 0, RES, RES); // mortier mat

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) ? -bw / 2 : 0;
    for (let cIx = -1; cIx <= 4; cIx++) {
      const x = cIx * bw + off + mortar, y = r * bh + mortar;
      const w = bw - mortar * 2, h = bh - mortar * 2;
      // Teinte de brique variée (terre cuite).
      const rr = 150 + Math.floor(Math.random() * 45);
      const gg = 70 + Math.floor(Math.random() * 30);
      const bb = 52 + Math.floor(Math.random() * 22);
      cc.fillStyle = `rgb(${rr},${gg},${bb})`;
      cc.fillRect(x, y, w, h);
      hc.fillStyle = '#cfcfcf'; hc.fillRect(x, y, w, h);     // brique saillante
      rc.fillStyle = `rgb(${190 + Math.floor(Math.random() * 40)},190,190)`;
      rc.fillRect(x, y, w, h);
      // Grain/usure de la brique (mouchetures + bords assombris).
      for (let k = 0; k < 60; k++) {
        const sx = x + Math.random() * w, sy = y + Math.random() * h;
        cc.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`;
        cc.fillRect(sx, sy, 1, 1);
        hc.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},255,255,${Math.random() * 0.15})`;
        hc.fillRect(sx, sy, 1, 1);
      }
      cc.strokeStyle = 'rgba(0,0,0,0.22)'; cc.lineWidth = 2;
      cc.strokeRect(x, y, w, h);
    }
  }

  _brick = { color, normal: heightToNormal(height, 3.6), rough };
  return _brick;
}

// =====================================================================
//  BÉTON INDUSTRIEL — taches, coulures, joints de banchage, fissures
//  (albédo gris neutre → teinté par pièce)
// =====================================================================
function concreteBase() {
  if (_concrete) return _concrete;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  cc.fillStyle = '#cccccc'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#808080'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#ededed'; rc.fillRect(0, 0, RES, RES); // béton mat

  // Grandes taches douces (humidité / vieillissement).
  for (let i = 0; i < 60; i++) {
    const px = Math.random() * RES, py = Math.random() * RES;
    const rad = 30 + Math.random() * 90;
    const dark = Math.random() > 0.5;
    const g = cc.createRadialGradient(px, py, 1, px, py, rad);
    const v = dark ? 70 : 235;
    g.addColorStop(0, `rgba(${v},${v},${v},0.07)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    cc.fillStyle = g; cc.beginPath(); cc.arc(px, py, rad, 0, Math.PI * 2); cc.fill();
  }
  // Coulures verticales discrètes.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * RES;
    cc.strokeStyle = `rgba(60,60,60,${0.03 + Math.random() * 0.05})`;
    cc.lineWidth = 1 + Math.random() * 2;
    cc.beginPath(); cc.moveTo(x, 0);
    cc.lineTo(x + (Math.random() - 0.5) * 8, RES); cc.stroke();
  }
  // Joints de banchage (panneaux) + trous de tiges.
  const panel = 3, ps = RES / panel;
  for (let p = 0; p <= panel; p++) {
    cc.strokeStyle = 'rgba(80,80,80,0.4)'; cc.lineWidth = 2;
    cc.beginPath(); cc.moveTo(p * ps, 0); cc.lineTo(p * ps, RES); cc.stroke();
    hc.strokeStyle = 'rgba(40,40,40,1)'; hc.lineWidth = 3;
    hc.beginPath(); hc.moveTo(p * ps, 0); hc.lineTo(p * ps, RES); hc.stroke();
  }
  cc.strokeStyle = 'rgba(80,80,80,0.4)'; cc.lineWidth = 2;
  cc.beginPath(); cc.moveTo(0, RES / 2); cc.lineTo(RES, RES / 2); cc.stroke();
  hc.strokeStyle = 'rgba(40,40,40,1)'; hc.lineWidth = 3;
  hc.beginPath(); hc.moveTo(0, RES / 2); hc.lineTo(RES, RES / 2); hc.stroke();
  for (let py = 0; py <= panel; py++) {
    for (let px = 0; px <= panel; px++) {
      const x = px * ps, y = py * ps + ps / 2;
      hc.fillStyle = 'rgba(20,20,20,1)';
      hc.beginPath(); hc.arc(x, y, 3, 0, Math.PI * 2); hc.fill();
      cc.fillStyle = 'rgba(50,50,50,0.5)';
      cc.beginPath(); cc.arc(x, y, 3, 0, Math.PI * 2); cc.fill();
    }
  }
  // Quelques fissures fines en zigzag.
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * RES, y = Math.random() * RES;
    cc.strokeStyle = 'rgba(40,40,40,0.5)'; cc.lineWidth = 1;
    hc.strokeStyle = 'rgba(0,0,0,0.8)'; hc.lineWidth = 1.5;
    cc.beginPath(); cc.moveTo(x, y); hc.beginPath(); hc.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.3) * 30;
      cc.lineTo(x, y); hc.lineTo(x, y);
    }
    cc.stroke(); hc.stroke();
  }

  _concrete = { color, normal: heightToNormal(height, 2.0), rough };
  return _concrete;
}

// =====================================================================
//  PLAFOND À CAISSONS — moulure encadrant un panneau, rosace centrale
// =====================================================================
function ceilPlasterBase() {
  if (_ceilPlaster) return _ceilPlaster;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  cc.fillStyle = '#f4f4f4'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#9a9a9a'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#f4f4f4'; rc.fillRect(0, 0, RES, RES);

  // Moulure en gradins (caisson) : cadres concentriques sur le height-field.
  const steps = [
    { inset: 10, v: 210 }, { inset: 26, v: 150 },
    { inset: 34, v: 120 }, { inset: 250, v: 175 },
  ];
  for (const s of steps) {
    hc.strokeStyle = `rgb(${s.v},${s.v},${s.v})`;
    hc.lineWidth = 6;
    hc.strokeRect(s.inset, s.inset, RES - s.inset * 2, RES - s.inset * 2);
  }
  cc.strokeStyle = 'rgba(0,0,0,0.05)'; cc.lineWidth = 4;
  cc.strokeRect(26, 26, RES - 52, RES - 52);

  // Rosace centrale (cercles concentriques + rayons).
  const cx = RES / 2, cy = RES / 2;
  for (let r = 16; r <= 64; r += 16) {
    hc.strokeStyle = r % 32 === 0 ? 'rgba(190,190,190,0.9)' : 'rgba(120,120,120,0.9)';
    hc.lineWidth = 4;
    hc.beginPath(); hc.arc(cx, cy, r, 0, Math.PI * 2); hc.stroke();
  }
  for (let a = 0; a < 12; a++) {
    const ang = a * Math.PI / 6;
    hc.strokeStyle = 'rgba(150,150,150,0.7)'; hc.lineWidth = 3;
    hc.beginPath();
    hc.moveTo(cx + Math.cos(ang) * 16, cy + Math.sin(ang) * 16);
    hc.lineTo(cx + Math.cos(ang) * 64, cy + Math.sin(ang) * 64);
    hc.stroke();
  }
  cc.fillStyle = 'rgba(0,0,0,0.04)';
  cc.beginPath(); cc.arc(cx, cy, 66, 0, Math.PI * 2); cc.fill();

  _ceilPlaster = { color, normal: heightToNormal(height, 1.6), rough };
  return _ceilPlaster;
}

// =====================================================================
//  DALLES SUSPENDUES — faux-plafond acoustique (grille + perforations)
// =====================================================================
function ceilTileBase() {
  if (_ceilTile) return _ceilTile;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  const n = 2, s = RES / n, rail = 10;
  cc.fillStyle = '#b8bcc0'; cc.fillRect(0, 0, RES, RES); // ossature métal
  hc.fillStyle = '#cfcfcf'; hc.fillRect(0, 0, RES, RES); // rails saillants
  rc.fillStyle = '#9a9a9a'; rc.fillRect(0, 0, RES, RES);

  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const x = ix * s + rail, y = iy * s + rail, w = s - rail * 2;
      cc.fillStyle = '#eef0ee'; cc.fillRect(x, y, w, w);  // dalle blanche
      hc.fillStyle = '#9a9a9a'; hc.fillRect(x, y, w, w);  // dalle en retrait
      rc.fillStyle = '#f4f4f4'; rc.fillRect(x, y, w, w);  // dalle mate
      // Perforations acoustiques (petits points).
      for (let py = y + 14; py < y + w - 8; py += 13) {
        for (let px = x + 14; px < x + w - 8; px += 13) {
          cc.fillStyle = 'rgba(0,0,0,0.10)';
          cc.beginPath(); cc.arc(px, py, 1.6, 0, Math.PI * 2); cc.fill();
          hc.fillStyle = 'rgba(0,0,0,0.5)';
          hc.beginPath(); hc.arc(px, py, 1.6, 0, Math.PI * 2); hc.fill();
        }
      }
    }
  }

  _ceilTile = { color, normal: heightToNormal(height, 2.6), rough };
  return _ceilTile;
}

// =====================================================================
//  PLAFOND BOIS — lambris + poutres (grenier) — albédo coloré
// =====================================================================
function woodCeilBase() {
  if (_woodCeil) return _woodCeil;
  const color = makeCanvas(), height = makeCanvas(), rough = makeCanvas();
  const cc = color.getContext('2d');
  const hc = height.getContext('2d');
  const rc = rough.getContext('2d');

  // Lambris (planches verticales).
  const planks = 6, pw = RES / planks;
  cc.fillStyle = '#8a6240'; cc.fillRect(0, 0, RES, RES);
  hc.fillStyle = '#9a9a9a'; hc.fillRect(0, 0, RES, RES);
  rc.fillStyle = '#bcbcbc'; rc.fillRect(0, 0, RES, RES);
  for (let p = 0; p < planks; p++) {
    const x = p * pw;
    const t = 110 + Math.floor(Math.random() * 40);
    cc.fillStyle = `rgb(${t + 30},${t},${t - 40})`;
    cc.fillRect(x + 1, 0, pw - 2, RES);
    // Veines verticales.
    for (let i = 0; i < 30; i++) {
      const gx = x + Math.random() * pw;
      cc.strokeStyle = `rgba(50,30,15,${0.05 + Math.random() * 0.10})`;
      cc.lineWidth = 1; cc.beginPath();
      cc.moveTo(gx, 0);
      for (let gy = 0; gy <= RES; gy += 16)
        cc.lineTo(gx + Math.sin(gy * 0.05 + p) * 2, gy);
      cc.stroke();
    }
    // Joint entre lambris (creux).
    hc.strokeStyle = 'rgba(20,20,20,1)'; hc.lineWidth = 4;
    hc.beginPath(); hc.moveTo(x, 0); hc.lineTo(x, RES); hc.stroke();
    cc.strokeStyle = 'rgba(30,18,8,0.6)'; cc.lineWidth = 2;
    cc.beginPath(); cc.moveTo(x, 0); cc.lineTo(x, RES); cc.stroke();
  }
  // Deux grosses poutres horizontales (saillantes, plus sombres).
  for (const by of [RES * 0.28, RES * 0.72]) {
    cc.fillStyle = '#5a3d22'; cc.fillRect(0, by - 16, RES, 32);
    hc.fillStyle = '#f0f0f0'; hc.fillRect(0, by - 16, RES, 32); // saillie forte
    cc.strokeStyle = 'rgba(0,0,0,0.4)'; cc.lineWidth = 2;
    cc.strokeRect(0, by - 16, RES, 32);
  }

  _woodCeil = { color, normal: heightToNormal(height, 3.0), rough };
  return _woodCeil;
}

export function woodFloor(rx, ry)     { return pack(woodBase(), rx, ry); }
export function tileFloor(rx, ry)     { return pack(tileBase(), rx, ry); }
export function plasterWall(rx, ry)   { return pack(plasterBase(), rx, ry); }
export function metalFloor(rx, ry)    { return pack(metalBase(), rx, ry); }
export function wallpaper(rx, ry)     { return pack(wallpaperBase(), rx, ry); }
export function subwayTile(rx, ry)    { return pack(subwayBase(), rx, ry); }
export function brickWall(rx, ry)     { return pack(brickBase(), rx, ry); }
export function concreteWall(rx, ry)  { return pack(concreteBase(), rx, ry); }
export function ceilingPlaster(rx, ry){ return pack(ceilPlasterBase(), rx, ry); }
export function ceilingTile(rx, ry)   { return pack(ceilTileBase(), rx, ry); }
export function woodCeiling(rx, ry)   { return pack(woodCeilBase(), rx, ry); }

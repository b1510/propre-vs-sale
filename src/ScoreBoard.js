import * as THREE from 'three';

// Grand panneau 3D des scores affiché dans la jungle finale : top 10 du
// classement en ligne + le score de la partie qui vient de se terminer.
// Dessiné dans un canvas (texture) ; redessiné via setData().

const W = 1800;
const H = 540;
const PANEL_W = 9;     // dimensions monde
const PANEL_H = 2.6;

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default class ScoreBoard {
  // pos : { x, z } du centre du panneau (plaqué sur un mur orienté vers +Z).
  constructor(scene, pos) {
    this.scene = scene;
    this.group = new THREE.Group();

    // Cadre en bois.
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(PANEL_W + 0.4, PANEL_H + 0.3, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.85 })
    );
    frame.position.set(pos.x, 1.5, pos.z - 0.06);
    this.group.add(frame);

    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      new THREE.MeshBasicMaterial({ map: this.tex })
    );
    this.panel.position.set(pos.x, 1.5, pos.z + 0.005);
    this.group.add(this.panel);

    this.position = new THREE.Vector3(pos.x, 1.5, pos.z);
    scene.add(this.group);
    this.setData({ status: 'loading' });
  }

  // data : { status:'loading'|'ok'|'offline', rows:[{name,score}], mine:{...stats, name},
  //          rank, submitted }
  setData(data) {
    const g = this.canvas.getContext('2d');

    // Fond « ardoise » + liseré.
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#12301f');
    bg.addColorStop(1, '#0a1c13');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ffd54a';
    g.lineWidth = 10;
    g.strokeRect(10, 10, W - 20, H - 20);

    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#ffd54a';
    g.font = 'bold 66px sans-serif';
    g.fillText('🏆  CLASSEMENT  🏆', W / 2, 68);

    if (data.status === 'loading') {
      g.fillStyle = '#b0bec5';
      g.font = '46px sans-serif';
      g.fillText('Chargement des scores…', W / 2, H / 2 + 10);
    } else {
      this._drawRows(g, data);
    }

    // Pied : le score de la partie.
    const mine = data.mine;
    if (mine) {
      g.fillStyle = 'rgba(255,213,74,0.16)';
      g.fillRect(40, H - 112, W - 80, 74);
      g.fillStyle = '#fff';
      g.font = 'bold 40px sans-serif';
      const who = mine.name ? mine.name : 'Toi';
      let line = `${who} · ${mine.score} pts · 🪙 ${mine.coins} · propreté ${mine.clean_pct}% · ${fmtTime(mine.time_sec)}`;
      if (mine.cheated) line = `${who} · ${mine.score} pts · partie hors classement (code secret)`;
      g.fillText(line, W / 2, H - 75);
    }

    this.tex.needsUpdate = true;
  }

  _drawRows(g, data) {
    let rows = (data.rows || []).map((r) => ({ name: r.name, score: r.score, me: false }));

    // Insère virtuellement notre score tant qu'il n'est pas enregistré.
    const mine = data.mine;
    if (mine && !mine.cheated && !data.submitted && data.status === 'ok') {
      const idx = rows.findIndex((r) => r.score < mine.score);
      const entry = { name: (mine.name || 'TOI') + ' (non enregistré)', score: mine.score, me: true };
      if (idx === -1) rows.push(entry);
      else rows.splice(idx, 0, entry);
    } else if (mine && data.submitted) {
      // Surligne la première ligne portant notre pseudo et notre score.
      const hit = rows.find((r) => r.name === mine.name && r.score === mine.score);
      if (hit) hit.me = true;
    }
    rows = rows.slice(0, 10);

    if (data.status === 'offline' || rows.length === 0) {
      g.fillStyle = '#b0bec5';
      g.font = '42px sans-serif';
      g.fillText(
        data.status === 'offline'
          ? 'Classement en ligne indisponible — voici ton score !'
          : 'Aucun score pour l\'instant — sois le premier !',
        W / 2, H / 2 - 20
      );
      return;
    }

    const colX = [70, 960];
    const rowH = 62;
    rows.forEach((r, i) => {
      const col = i < 5 ? 0 : 1;
      const y = 160 + (i % 5) * rowH;
      const x = colX[col];
      if (r.me) {
        g.fillStyle = 'rgba(255,213,74,0.28)';
        g.fillRect(x - 20, y - 28, 860, 56);
      }
      g.textAlign = 'left';
      g.fillStyle = i === 0 ? '#ffd54a' : i === 1 ? '#e0e0e0' : i === 2 ? '#d7a56b' : '#90caf9';
      g.font = 'bold 44px sans-serif';
      g.fillText(`${i + 1}`, x, y);
      g.fillStyle = r.me ? '#fff59d' : '#fff';
      g.font = '42px sans-serif';
      let name = String(r.name);
      while (g.measureText(name).width > 480 && name.length > 3) name = name.slice(0, -2) + '…';
      g.fillText(name, x + 70, y);
      g.textAlign = 'right';
      g.fillStyle = '#a5d6a7';
      g.font = 'bold 44px sans-serif';
      g.fillText(String(r.score), x + 820, y);
    });
    g.textAlign = 'center';
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    });
  }
}

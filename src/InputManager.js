// Clavier (AZERTY/QWERTY via e.key) + souris (PointerLock) + manette Xbox (Gamepad API).
//
// Ordre d'appel par frame (depuis Game._loop) :
//   1. input.poll()       → lit l'état manette, détecte fronts montants
//   2. player.update()    → lit les touches / consomme les events
//   3. input.endFrame()   → réinitialise les fronts non consommés

export default class InputManager {
  constructor(domElement) {
    this.dom = domElement;

    // Codes physiques (e.code) → Space, ShiftLeft…
    this.codes = {};
    // Caractères imprimés (e.key) → layout-aware, ex: 'z','q','s','d' sur AZERTY
    this.chars = {};

    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked  = false;

    this.leftDown        = false;
    this.leftJustPressed = false; // front montant clic gauche ou bouton attaque manette

    // État manette (mis à jour dans poll())
    this.gpMove   = { x: 0, y: 0 };
    this.gpLook   = { x: 0, y: 0 };
    this.gpJump   = false;  // front montant bouton A
    this.gpSprint = false;  // bouton B enfoncé

    this._prevGpJump   = false;
    this._prevGpAttack = false;
    this._connectedGp  = null; // référence directe à la manette connectée

    window.addEventListener('gamepadconnected', (e) => {
      this._connectedGp = e.gamepad;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this._connectedGp = null;
    });

    // Clavier
    window.addEventListener('keydown', (e) => {
      this.codes[e.code] = true;
      if (e.key.length === 1) this.chars[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.codes[e.code] = false;
      if (e.key.length === 1) this.chars[e.key.toLowerCase()] = false;
    });

    // Souris
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!this.leftDown) this.leftJustPressed = true;
        this.leftDown = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.leftDown = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
  }

  // PointerLock
  requestLock() { this.dom.requestPointerLock?.(); }
  exitLock()    { document.exitPointerLock?.(); }

  // Code physique (Space, ShiftLeft, …)
  isDown(code) { return !!this.codes[code]; }

  // Caractère imprimé — layout-aware (AZERTY: isKey('z'), isKey('q'), …)
  isKey(char)  { return !!this.chars[char.toLowerCase()]; }

  consumeMouseDelta() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  // Retourne et efface le front montant attaque (clic ou bouton manette).
  consumeLeftClick() {
    const v = this.leftJustPressed;
    this.leftJustPressed = false;
    return v;
  }

  // Appeler en DÉBUT de frame pour lire l'état manette et détecter les fronts.
  poll() {
    // getGamepads() retourne l'état instantané (pas d'events) — doit être appelé chaque frame.
    let gp = null;
    try {
      const gamepads = navigator.getGamepads?.() ?? [];
      for (const g of gamepads) { if (g?.axes?.length >= 4) { gp = g; break; } }
    } catch (_) { /* sécurité navigateurs anciens */ }

    if (!gp) {
      this.gpMove   = { x: 0, y: 0 };
      this.gpLook   = { x: 0, y: 0 };
      this.gpJump   = false;
      this.gpSprint = false;
      return;
    }

    const dead = 0.15;
    const ax = (v) => Math.abs(v) > dead ? v : 0;

    this.gpMove = { x: ax(gp.axes[0]), y: ax(gp.axes[1]) };
    this.gpLook = { x: ax(gp.axes[2]), y: ax(gp.axes[3]) };

    // A (0) → saut, front montant
    const btnJump = gp.buttons[0]?.pressed ?? false;
    this.gpJump = btnJump && !this._prevGpJump;
    this._prevGpJump = btnJump;

    // B (1) → sprint (maintenu)
    this.gpSprint = gp.buttons[1]?.pressed ?? false;

    // X (2) ou RB (5) → attaque, front montant → injecte dans leftJustPressed
    const btnAtk = (gp.buttons[2]?.pressed || gp.buttons[5]?.pressed) ?? false;
    if (btnAtk && !this._prevGpAttack) this.leftJustPressed = true;
    this._prevGpAttack = btnAtk;
  }

  // Appeler en FIN de frame pour effacer les fronts non consommés.
  endFrame() {
    this.leftJustPressed = false;
  }
}

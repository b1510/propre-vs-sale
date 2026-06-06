// Contrôles tactiles pour mobile : joystick de déplacement (gauche),
// zone de regard (droite), boutons attaque / saut / soin / boost.
// N'est actif que sur écran tactile ; alimente l'InputManager et appelle
// les callbacks pour les consommables.

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export default class TouchControls {
  constructor(input, callbacks = {}) {
    this.input = input;
    this.callbacks = callbacks; // { onHeal, onBoost }
    this.enabled = IS_TOUCH;
    if (!this.enabled) return;

    document.body.classList.add('touch');
    this._build();
  }

  get supported() { return this.enabled; }

  setActive(active) {
    if (!this.enabled) return;
    this.root.classList.toggle('active', active);
    if (!active) {
      // Relâche tout état tactile résiduel.
      this.input.touchMove.x = 0;
      this.input.touchMove.y = 0;
      this.input.touchJump = false;
      this._resetKnob();
      this._joyId = null;
      this._lookId = null;
    }
  }

  _build() {
    this.root = document.createElement('div');
    this.root.id = 'touchControls';

    // Zone de regard (moitié droite).
    this.lookZone = document.createElement('div');
    this.lookZone.id = 'touchLook';
    this.root.appendChild(this.lookZone);

    // Joystick (bas gauche).
    this.joy = document.createElement('div');
    this.joy.id = 'joystick';
    this.knob = document.createElement('div');
    this.knob.id = 'joystickKnob';
    this.joy.appendChild(this.knob);
    this.root.appendChild(this.joy);

    // Boutons d'action.
    this.btnAttack = this._makeButton('btnAttack', 'touch-btn', '🧹');
    this.btnJump = this._makeButton('btnJump', 'touch-btn', '⤒');
    this.btnHeal = this._makeButton('btnHeal', 'touch-btn', '❤');
    this.btnBoost = this._makeButton('btnBoost', 'touch-btn', '⚡');

    document.body.appendChild(this.root);

    this._joyId = null;  // identifiant de touche du joystick
    this._lookId = null; // identifiant de touche du regard
    this._lookX = 0;
    this._lookY = 0;

    this._bindJoystick();
    this._bindLook();
    this._bindButtons();
  }

  _makeButton(id, cls, label) {
    const b = document.createElement('div');
    b.id = id;
    b.className = cls;
    b.textContent = label;
    this.root.appendChild(b);
    return b;
  }

  _resetKnob() {
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
  }

  _bindJoystick() {
    const radius = 55; // rayon utile du joystick (px)

    const start = (t) => {
      this._joyId = t.identifier;
      this._joyCx = this.joy.getBoundingClientRect().left + this.joy.offsetWidth / 2;
      this._joyCy = this.joy.getBoundingClientRect().top + this.joy.offsetHeight / 2;
      move(t);
    };
    const move = (t) => {
      let dx = t.clientX - this._joyCx;
      let dy = t.clientY - this._joyCy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      this.input.touchMove.x = dx / radius;
      this.input.touchMove.y = dy / radius; // bas = positif (avant = négatif côté joueur)
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    const end = () => {
      this._joyId = null;
      this.input.touchMove.x = 0;
      this.input.touchMove.y = 0;
      this._resetKnob();
    };

    this.joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._joyId === null) start(e.changedTouches[0]);
    }, { passive: false });
    this.joy.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this._joyId) move(t);
    }, { passive: false });
    const onEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this._joyId) end();
    };
    this.joy.addEventListener('touchend', onEnd);
    this.joy.addEventListener('touchcancel', onEnd);
  }

  _bindLook() {
    this.lookZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._lookId === null) {
        const t = e.changedTouches[0];
        this._lookId = t.identifier;
        this._lookX = t.clientX;
        this._lookY = t.clientY;
      }
    }, { passive: false });

    this.lookZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this._lookId) continue;
        this.input.touchLookDX += t.clientX - this._lookX;
        this.input.touchLookDY += t.clientY - this._lookY;
        this._lookX = t.clientX;
        this._lookY = t.clientY;
      }
    }, { passive: false });

    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._lookId) this._lookId = null;
      }
    };
    this.lookZone.addEventListener('touchend', onEnd);
    this.lookZone.addEventListener('touchcancel', onEnd);
  }

  _bindButtons() {
    // Attaque : front montant à chaque appui.
    this.btnAttack.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.triggerAttack();
    }, { passive: false });

    // Saut : maintenu tant que le doigt est posé.
    this.btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.touchJump = true;
    }, { passive: false });
    const jumpEnd = (e) => { e.preventDefault(); this.input.touchJump = false; };
    this.btnJump.addEventListener('touchend', jumpEnd, { passive: false });
    this.btnJump.addEventListener('touchcancel', jumpEnd, { passive: false });

    // Consommables.
    this.btnHeal.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.callbacks.onHeal?.();
    }, { passive: false });
    this.btnBoost.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.callbacks.onBoost?.();
    }, { passive: false });
  }
}

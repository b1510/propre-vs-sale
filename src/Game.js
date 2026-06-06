import * as THREE from 'three';
import SoundManager from './SoundManager.js';
import InputManager from './InputManager.js';
import Level from './level/Level.js';
import Player from './Player.js';
import Projectile from './Projectile.js';
import Caca from './enemies/Caca.js';
import Poussiere from './enemies/Poussiere.js';
import TacosBoss from './enemies/TacosBoss.js';
import BurgerBoss from './enemies/BurgerBoss.js';
import UI from './ui/UI.js';
import Menu from './ui/Menu.js';
import Shop, { SHOP_ITEMS } from './ui/Shop.js';
import TouchControls from './TouchControls.js';
import { LEVELS } from './level/LevelData.js';

// Constantes des consommables/améliorations.
const HEAL_AMOUNT = 60;
const BOOST_DURATION = 20; // secondes
const BOOST_MULT = 1.5;
const MAXHP_STEP = 20;

// Orchestration : scène, boucle, ennemis, projectiles, pièces, clé, boutique,
// états (menu / jeu / boutique / game over / victoire).

export default class Game {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 200
    );

    this.input = new InputManager(this.renderer.domElement);
    this.ui = new UI();
    this.menu = new Menu();
    this.shop = new Shop();
    this.sound = new SoundManager();

    this.state = 'menu'; // menu | playing | shop | gameover | victory
    this.levelIndex = 0;
    this.clock = new THREE.Clock();

    // Progression d'une partie (réinitialisée à chaque nouvelle partie).
    this.inventory = { heal: 0, damage: 0 };
    this.upgrades = { bonusMaxHp: 0 };
    this._prevDigit1 = false;
    this._prevDigit2 = false;

    this.touch = new TouchControls(this.input, {
      onHeal: () => { if (this.state === 'playing') this.useHeal(); },
      onBoost: () => { if (this.state === 'playing') this.useBoost(); },
    });

    this.menu.onPlay = () => this.startGame();
    this.menu.onRestart = () => this.startGame();

    window.addEventListener('resize', () => this._onResize());

    this._initScene();
    this.menu.showMenu();
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1d24);
    this.scene.fog = new THREE.Fog(0x1a1d24, 30, 70);
    this.scene.add(this.camera);
  }

  _buildWorld(keepCoins = false) {
    // Nettoyage si rejoue / change de niveau.
    if (this.level) {
      this.scene.remove(this.level.group);
    }
    // Reconstruit une scène propre.
    this._initScene();

    const config = LEVELS[this.levelIndex];
    this.config = config;
    if (config.background !== undefined) {
      this.scene.background = new THREE.Color(config.background);
      this.scene.fog = new THREE.Fog(config.background, 30, 70);
    }

    this.level = new Level(this.scene, config);

    // Retire l'arme de l'ancien joueur encore attachée à la caméra partagée.
    if (this.player && this.player.weapon) {
      this.camera.remove(this.player.weapon);
    }

    this.player = new Player(this.camera, this.input, this.level);
    this.player.setWeapon(config.weapon);
    this.player.maxHp = 100 + this.upgrades.bonusMaxHp; // bonus permanents
    this.player.reset(config.playerStart.x, config.playerStart.z);

    if (!keepCoins) this.coins = 0;
    this.visitedRooms = new Set();
    this.projectiles = [];
    this.enemies = [];
    this.boss = null;
    this.keyCollected = false;
    this._currentRoom = null;

    // Spawn des ennemis.
    for (const s of config.enemySpawns) {
      let e;
      if (s.type === 'caca') e = new Caca(s.x, s.z);
      else if (s.type === 'poussiere') e = new Poussiere(s.x, s.z);
      else if (s.type === 'boss') {
        e = config.bossType === 'burger'
          ? new BurgerBoss(s.x, s.z)
          : new TacosBoss(s.x, s.z);
        this.boss = e;
      }
      if (e) {
        e.coinDrop += config.coinBonus || 0;
        this.enemies.push(e);
        this.scene.add(e.group);
      }
    }

    this.ui.setLevel(config);
    this.ui.setHealth(this.player.hp, this.player.maxHp);
    this.ui.setCoins(this.coins);
    this.ui.setBossVisible(false);
    this.ui.setInventory(this.inventory);
    this.ui.setBoost(0);

    // Pièce de départ.
    this._enterRoom(this.level.getRoomAt(this.player.position.x, this.player.position.z));
  }

  startGame() {
    this.sound.resume(); // débloque l'audio (geste utilisateur)
    this.levelIndex = 0;
    this.coins = 0;
    this.inventory = { heal: 0, damage: 0 };
    this.upgrades = { bonusMaxHp: 0 };
    this._buildWorld();
    this.menu.hideAll();
    this.state = 'playing';
    this.clock.getDelta(); // reset delta
    this.input.requestLock();
  }

  _nextLevel() {
    this.levelIndex++;
    this._buildWorld(true); // conserve les pièces
    const config = LEVELS[this.levelIndex];
    this.ui.showMessage(`Niveau ${config.id} : ${config.name}`, 3.5);
    this.clock.getDelta(); // évite un gros delta après reconstruction
  }

  // --- Boutique (entre les niveaux) ---
  _openShop() {
    this.state = 'shop';
    this.input.exitLock();
    this.shop.open({
      getCoins: () => this.coins,
      getOwned: (id) => this._ownedCount(id),
      buy: (id) => this._buyItem(id),
      onContinue: () => {
        this.shop.hide();
        this._nextLevel();
        this.state = 'playing';
        this.input.requestLock();
      },
    });
  }

  _ownedCount(id) {
    if (id === 'heal') return this.inventory.heal;
    if (id === 'damage') return this.inventory.damage;
    if (id === 'maxhp') return this.upgrades.bonusMaxHp / MAXHP_STEP;
    return 0;
  }

  _buyItem(id) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item || this.coins < item.price) return false;
    this.coins -= item.price;
    if (id === 'heal') this.inventory.heal++;
    else if (id === 'damage') this.inventory.damage++;
    else if (id === 'maxhp') this.upgrades.bonusMaxHp += MAXHP_STEP;
    this.ui.setCoins(this.coins);
    this.sound.play('coin');
    return true;
  }

  // --- Consommables (touches 1 et 2 en jeu) ---
  _handleConsumables() {
    const d1 = this.input.isDown('Digit1');
    const d2 = this.input.isDown('Digit2');
    if (d1 && !this._prevDigit1) this._useHeal();
    if (d2 && !this._prevDigit2) this._useBoost();
    this._prevDigit1 = d1;
    this._prevDigit2 = d2;
  }

  _useHeal() {
    if (this.inventory.heal <= 0) return;
    if (this.player.hp >= this.player.maxHp) {
      this.ui.showMessage('Vie déjà au maximum', 1.2);
      return;
    }
    this.inventory.heal--;
    this.player.heal(HEAL_AMOUNT);
    this.ui.setHealth(this.player.hp, this.player.maxHp);
    this.ui.setInventory(this.inventory);
    this.sound.play('pickup');
    this.ui.showMessage(`+${HEAL_AMOUNT} PV`, 1.2);
  }

  _useBoost() {
    if (this.inventory.damage <= 0) return;
    this.inventory.damage--;
    this.player.applyDamageBoost(BOOST_DURATION, BOOST_MULT);
    this.ui.setInventory(this.inventory);
    this.sound.play('pickup');
    this.ui.showMessage('⚡ Boost de dégâts activé !', 1.5);
  }

  // Déclencheurs publics pour les commandes tactiles (mobile).
  useHeal() { this._useHeal(); }
  useBoost() { this._useBoost(); }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _enterRoom(name) {
    if (!name || name === this._currentRoom) return;
    this._currentRoom = name;
    const def = this.level.rooms[name].def;
    this.ui.showRoomName(def.label);

    if (!this.visitedRooms.has(name)) {
      this.visitedRooms.add(name);
      this.coins += 5;
      this.ui.setCoins(this.coins);
      this.ui.showMessage(`${def.label} découvert ! +5 🪙`, 2);
      this.sound.play('coin');
    }
  }

  _spawnProjectile(type, origin, target) {
    const p = new Projectile(type, origin, target);
    this.projectiles.push(p);
    this.scene.add(p.mesh);
  }

  _handleEnemyActions(enemy, actions) {
    for (const a of actions) {
      if (a.type === 'shoot') {
        this._spawnProjectile(a.projType, a.origin, a.target);
        this.sound.play('shoot');
      } else if (a.type === 'melee') {
        this.player.takeDamage(a.damage);
        this.ui.flashDamage();
        this.ui.setHealth(this.player.hp, this.player.maxHp);
        this.sound.play('hurt');
      }
    }
  }

  _doMeleeAttack() {
    this.sound.play('swing');
    const forward = this.player.getForward();
    const origin = this.player.position;
    let hit = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = new THREE.Vector3(
        e.position.x - origin.x, 0, e.position.z - origin.z
      );
      const dist = to.length();
      if (dist > this.player.meleeRange + (e.radius || 0.5)) continue;
      to.normalize();
      const dot = to.dot(forward);
      if (dot > 0.45) {
        e.takeDamage(this.player.meleeDamage);
        hit = true;
        if (e.dead) this._onEnemyKilled(e);
        else this.sound.play('hit');
      }
    }
  }

  _onEnemyKilled(e) {
    this.coins += e.coinDrop;
    this.ui.setCoins(this.coins);
    if (e.isBoss) {
      this.ui.setBossVisible(false);
      this.boss = null;
      if (this.levelIndex < LEVELS.length - 1) {
        // Boutique entre les niveaux, puis on enchaîne.
        this.sound.play('unlock');
        this._openShop();
      } else {
        this.sound.play('victory');
        this.state = 'victory';
        this.input.exitLock();
        this.menu.showVictory(this.coins);
      }
    } else {
      this.sound.play('enemyDeath');
      this.sound.play('coin');
    }
  }

  _updateEnemies(delta) {
    const playerPos = this.player.position;
    for (const e of this.enemies) {
      if (e.dead) {
        if (e.group.parent) {
          // Effet de disparition : rétrécit puis retire.
          e.group.scale.multiplyScalar(0.82);
          if (e.group.scale.x < 0.05) {
            this.scene.remove(e.group);
            e.dispose();
          }
        }
        continue;
      }
      const actions = e.update(delta, playerPos, this.level);
      this._handleEnemyActions(e, actions);
    }

    // Barre de vie boss si en vue / combat.
    if (this.boss && !this.boss.dead) {
      const d = this.boss.position.distanceTo(playerPos);
      const inFight = d < this.boss.sightRange;
      this.ui.setBossVisible(inFight);
      if (inFight) this.ui.setBossHealth(this.boss.hp, this.boss.maxHp);
    } else {
      this.ui.setBossVisible(false);
    }
  }

  _updateProjectiles(delta) {
    const playerPos = this.player.position;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const prevX = p.mesh.position.x;
      const prevZ = p.mesh.position.z;
      p.update(delta);

      let remove = false;
      if (p.hits(playerPos)) {
        this.player.takeDamage(p.damage);
        this.ui.flashDamage();
        this.ui.setHealth(this.player.hp, this.player.maxHp);
        this.sound.play('hurt');
        remove = true;
      } else if (!p.alive) {
        remove = true;
      } else if (this.level.didCrossWall(prevX, prevZ, p.mesh.position.x, p.mesh.position.z)) {
        remove = true;
      }

      if (remove) {
        this.scene.remove(p.mesh);
        p.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  _checkKey() {
    if (this.keyCollected || !this.level.keyMesh) return;
    const kp = this.config.keyPosition;
    const dx = this.player.position.x - kp.x;
    const dz = this.player.position.z - kp.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      this.keyCollected = true;
      this.level.collectKey();
      this.level.unlockDoor(this.config.lockedDoorId);
      this.sound.play('pickup');
      this.sound.play('unlock');
      const bossLabel = this.level.rooms[this.config.bossRoom].def.label;
      this.ui.showMessage(`🔑 Clé récupérée ! ${bossLabel} déverrouillée.`, 3);
    }
  }

  _loop() {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.input.poll();
      this.player.update(delta);
      this._handleConsumables();

      if (this.player.wantsMeleeHit) {
        this._doMeleeAttack();
      }

      this.level.update(delta);
      this._updateEnemies(delta);
      this._updateProjectiles(delta);
      this._checkKey();

      // Détection de pièce courante.
      const room = this.level.getRoomAt(
        this.player.position.x, this.player.position.z
      );
      if (room) this._enterRoom(room);

      // Game over ?
      if (this.player.isDead) {
        this.sound.play('gameover');
        this.state = 'gameover';
        this.input.exitLock();
        this.menu.showGameOver(this.coins);
      }

      this.ui.setHealth(this.player.hp, this.player.maxHp);
      this.ui.setBoost(this.player.boostRemaining);
      this.ui.update(delta);
      this.ui.drawMinimap(
        this.player.position, this.visitedRooms, this.keyCollected
      );

      this.input.endFrame();
    }

    this.touch.setActive(this.state === 'playing');
    this.renderer.render(this.scene, this.camera);
  }
}

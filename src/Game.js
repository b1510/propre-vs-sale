import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
import Particles from './Particles.js';
import Stains from './Stains.js';
import Leaderboard from './Leaderboard.js';
import Lobby from './ui/Lobby.js';
import RemotePlayer from './net/RemotePlayer.js';
import { mulberry32 } from './net/rng.js';
import { MSG, MODE } from './net/protocol.js';
import { LEVELS, PLAYER_EYE } from './level/LevelData.js';

// Fréquences réseau.
const STATE_HZ = 20; // envoi du transform joueur
const WORLD_HZ = 12; // snapshot monde (host)
const RESPAWN_DELAY = 3; // secondes avant réapparition en PvP

// Couleurs de particules par type d'ennemi.
const ENEMY_COLORS = { caca: 0x8B4513, poussiere: 0xAAAAAA, tacos: 0xD2691E, burger: 0xC8842A };

// Couleurs des projectiles distants (rendu côté non-host).
const PROJ_COLORS = { caca: 0x6B3A2A, poussiere: 0x888888, viande: 0x8B0000, boule_de_feu: 0xff5500 };

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
    // Rendu plus réaliste : tone mapping filmique (ACES) + exposition.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false; // pas d'ombres dynamiques (perf)
    container.appendChild(this.renderer.domElement);

    // Reverrouille la souris au clic si on joue sans pointer lock (utile pour le
    // non-host, dont la partie démarre via un message réseau sans geste utilisateur).
    this.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.requestLock();
    });

    // Éclairage par image (IBL) : calculé une seule fois, réutilisé à chaque
    // (re)construction de scène. Donne un ombrage doux et des reflets aux
    // MeshStandardMaterial, à coût quasi nul à l'exécution.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 200
    );

    this.input = new InputManager(this.renderer.domElement);
    this.ui = new UI();
    this.leaderboard = new Leaderboard();
    this.menu = new Menu(this.leaderboard);
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
    this.menu.onMultiplayer = () => this._openLobby();

    // --- Multijoueur ---
    this.lobby = new Lobby();
    this.lobby.onStart = (ctx) => this._startNetworkGame(ctx);
    this.lobby.onBack = () => this.menu.showMenu();

    this.multiplayer = false;
    this.mode = null;
    this.net = null;
    this.isHost = false;
    this.selfId = null;
    this.remotePlayers = new Map(); // id -> RemotePlayer
    this.playerInfo = new Map();    // id -> { name, color }
    this.frags = {};                // id -> nombre de frags (PvP)
    this._lastWorldSent = 0;
    this._remoteProj = new Map();   // id -> mesh (projectiles distants, non-host)
    this._respawnTimer = 0;

    window.addEventListener('resize', () => this._onResize());

    this._initScene();
    this.particles = new Particles(this.scene);
    this.stains = null;
    this.menu.showMenu();
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1d24);
    this.scene.fog = new THREE.Fog(0x1a1d24, 30, 70);
    if (this.envMap) this.scene.environment = this.envMap; // IBL
    this.scene.add(this.camera);
  }

  _buildWorld(keepCoins = false) {
    // Nettoyage si rejoue / change de niveau.
    if (this.level) {
      this.scene.remove(this.level.group);
      this.level.dispose();
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

    // Particules + taches (mécanique de nettoyage) sur la nouvelle scène.
    this.particles.setScene(this.scene);
    if (this.stains) this.stains.dispose();
    this.stains = new Stains(this.scene);
    // En multijoueur : RNG seedé partagé → disposition identique chez tous.
    const stainRng = this.multiplayer
      ? mulberry32(((this._stainSeed >>> 0) + this.levelIndex * 7919) >>> 0)
      : Math.random;
    this.stains.build(config, 5, stainRng);

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
    this._projSeq = 1;

    // Spawn des ennemis. En PvP, aucun ennemi (joueurs contre joueurs).
    const spawnEnemies = !(this.multiplayer && this.mode === MODE.PVP);
    for (const s of (spawnEnemies ? config.enemySpawns : [])) {
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
        e.particleColor = ENEMY_COLORS[s.type === 'boss' ? config.bossType : s.type] || 0xffffff;
        this.enemies.push(e);
        this.scene.add(e.group);
      }
    }

    this.sound.startMusic(config.id); // (re)lance la musique adaptée au niveau

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
    if (this.multiplayer) this._teardownMultiplayer(); // repart en solo proprement
    this.levelIndex = 0;
    this.coins = 0;
    this.runStartTime = performance.now(); // pour le bonus de rapidité du score
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

  // --- Score & classement ---

  // Pourcentage global de taches nettoyées (toutes pièces du niveau courant).
  _cleanlinessPct() {
    if (!this.stains) return 0;
    let total = 0;
    let cleaned = 0;
    for (const room in this.stains.roomTotals) {
      total += this.stains.roomTotals[room] || 0;
      cleaned += this.stains.roomCleaned[room] || 0;
    }
    return total > 0 ? (cleaned / total) * 100 : 0;
  }

  // Construit l'objet score envoyé au classement. Valeurs ajustables.
  _buildScore(won) {
    const timeSec = (performance.now() - (this.runStartTime || performance.now())) / 1000;
    const cleanPct = this._cleanlinessPct();
    const levelNum = this.levelIndex + 1;
    // Bonus de rapidité : récompense les victoires rapides uniquement.
    const timeBonus = won ? Math.max(0, 4000 - Math.round(timeSec * 4)) : 0;
    const score =
      this.coins * 10 +
      Math.round(cleanPct) * 8 +
      levelNum * 600 +
      (won ? 2000 : 0) +
      timeBonus;
    return {
      score,
      coins: this.coins,
      level: levelNum,
      time_sec: Math.round(timeSec),
      clean_pct: Math.round(cleanPct),
      won,
    };
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

  _updateCleanlinessHud(room) {
    if (!this.stains || !room) { this.ui.setCleanliness(0, 0); return; }
    this.ui.setCleanliness(this.stains.roomCleaned[room] || 0, this.stains.roomTotals[room] || 0);
  }

  _enterRoom(name) {
    if (!name || name === this._currentRoom) return;
    this._currentRoom = name;
    const def = this.level.rooms[name].def;
    this.ui.showRoomName(def.label);
    this._updateCleanlinessHud(name);

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
    p.netId = this._projSeq++;
    this.projectiles.push(p);
    this.scene.add(p.mesh);
  }

  _handleEnemyActions(enemy, actions, targetId) {
    for (const a of actions) {
      if (a.type === 'shoot') {
        this._spawnProjectile(a.projType, a.origin, a.target);
        this.sound.play('shoot');
      } else if (a.type === 'melee') {
        this._damagePlayer(targetId, a.damage, 0.5);
      }
    }
  }

  // Applique des dégâts au joueur `targetId` : localement si c'est nous, sinon
  // on délègue au client concerné via un message réseau.
  _damagePlayer(targetId, dmg, shake = 0.4) {
    if (!this.multiplayer || targetId === this.selfId || targetId === 'self') {
      if (this._localDead) return;
      this.player.takeDamage(dmg);
      this.player.addShake(shake);
      this.ui.flashDamage();
      this.ui.setHealth(this.player.hp, this.player.maxHp);
      this.sound.play('hurt');
    } else {
      this.net.send({ type: MSG.HIT, targetId, dmg });
    }
  }

  _doMeleeAttack() {
    if (this._localDead) return;
    this.sound.play('swing');
    if (this.multiplayer) this.net.send({ type: MSG.SWING });
    const forward = this.player.getForward();
    const origin = this.player.position;
    const crit = this.player.boostRemaining > 0;
    const dmg = this.player.meleeDamage;

    if (this.multiplayer && this.mode === MODE.PVP) {
      this._meleePvp(forward, origin, dmg, crit);
    } else {
      this._meleeEnemies(forward, origin, dmg, crit);
    }

    this._cleanStains(forward, origin);
  }

  _meleeEnemies(forward, origin, dmg, crit) {
    const authoritative = !this.multiplayer || this.isHost;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = new THREE.Vector3(
        e.position.x - origin.x, 0, e.position.z - origin.z
      );
      const dist = to.length();
      if (dist > this.player.meleeRange + (e.radius || 0.5)) continue;
      to.normalize();
      if (to.dot(forward) > 0.45) {
        const head = new THREE.Vector3(e.position.x, e.position.y + 0.7, e.position.z);
        this.ui.showDamageNumber(head, dmg, this.camera, crit);
        this.ui.flashCrosshair();
        this.particles.burst(e.position, e.particleColor || 0xffffff, 6,
          { speed: 2, up: 1.5, life: 0.4 });
        if (authoritative) {
          e.takeDamage(dmg);
          if (e.dead) this._onEnemyKilled(e, this.selfId);
          else this.sound.play('hit');
        } else {
          // Coop non-host : les dégâts aux ennemis sont appliqués par le host.
          this.net.send({ type: MSG.ENEMY_HIT, i: this.enemies.indexOf(e), dmg });
          this.sound.play('hit');
        }
      }
    }
  }

  _meleePvp(forward, origin, dmg, crit) {
    for (const rp of this.remotePlayers.values()) {
      if (rp.dead) continue;
      const pos = rp.aimPos();
      const to = new THREE.Vector3(pos.x - origin.x, 0, pos.z - origin.z);
      const dist = to.length();
      if (dist > this.player.meleeRange + 0.6) continue;
      to.normalize();
      if (to.dot(forward) > 0.45) {
        this.ui.showDamageNumber(
          new THREE.Vector3(pos.x, pos.y + 0.2, pos.z), dmg, this.camera, crit);
        this.ui.flashCrosshair();
        this.sound.play('hit');
        this.net.send({ type: MSG.PVP_HIT, targetId: rp.id, dmg });
      }
    }
  }

  // Nettoie les taches devant le joueur (mécanique « Propre vs Sale »).
  _cleanStains(forward, origin) {
    if (!this.stains) return;
    const res = this.stains.cleanNear(origin, forward, this.player.meleeRange + 0.8, 0.5);
    if (!res.worked) return;
    this.sound.play('clean');
    if (this.multiplayer && res.removed.length) {
      this.net.send({ type: MSG.CLEAN, ids: res.removed.map((r) => r.id) });
    }
    for (const r of res.removed) {
      this.coins += 1;
      this.particles.burst(r.position, 0x9fd8ff, 8,
        { speed: 2, up: 2, life: 0.5, gravity: 4 });
      if (r.completedRoom) {
        this.coins += 10;
        this.sound.play('pickup');
        this.player.addShake(0.2);
        this.ui.showMessage(
          `✨ ${this.level.rooms[r.completedRoom].def.label} nettoyée ! +10 🪙`, 2.2);
      }
    }
    this.ui.setCoins(this.coins);
    this._updateCleanlinessHud(this._currentRoom);
  }

  _onEnemyKilled(e, by = this.selfId) {
    // Crédit des pièces au tueur (`by`). En multijoueur, si ce n'est pas nous,
    // on prévient le client concerné qui ajoutera les pièces de son côté.
    if (!this.multiplayer || by === this.selfId) {
      this.coins += e.coinDrop;
      this.ui.setCoins(this.coins);
    } else {
      this.net.send({ type: MSG.ENEMY_KILLED, i: this.enemies.indexOf(e), by, coin: e.coinDrop });
    }

    // Explosion de particules + secousse caméra à la mort.
    this.particles.burst(e.position, e.particleColor || 0xffffff, e.isBoss ? 28 : 12,
      e.isBoss ? { speed: 5, up: 4, life: 1.0, size: 1.6 } : { speed: 3, up: 2.5, life: 0.6 });
    this.player.addShake(e.isBoss ? 0.9 : 0.25);

    if (e.isBoss) {
      this.ui.setBossVisible(false);
      this.boss = null;
      if (this.multiplayer) {
        this._hostHandleBossDeath();
      } else if (this.levelIndex < LEVELS.length - 1) {
        // Boutique entre les niveaux, puis on enchaîne.
        this.sound.play('unlock');
        this._openShop();
      } else {
        this.sound.play('victory');
        this.sound.stopMusic();
        this.state = 'victory';
        this.input.exitLock();
        this.menu.showVictory(this._buildScore(true));
      }
    } else {
      this.sound.play('enemyDeath');
      this.sound.play('coin');
    }
  }

  _updateEnemies(delta) {
    const players = this._mpPlayers();
    for (const e of this.enemies) {
      if (e.dead) { this._fadeDeadEnemy(e); continue; }
      const tgt = this._nearestPlayer(players, e.position);
      const actions = e.update(delta, tgt.pos, this.level);
      this._handleEnemyActions(e, actions, tgt.id);
    }
    this._updateBossBar();
  }

  // Effet de disparition d'un ennemi mort (rétrécit puis retire).
  _fadeDeadEnemy(e) {
    if (!e.group.parent) return;
    e.group.scale.multiplyScalar(0.82);
    if (e.group.scale.x < 0.05) {
      this.scene.remove(e.group);
      e.dispose();
    }
  }

  // Barre de vie boss si le boss est en vue du joueur local.
  _updateBossBar() {
    const playerPos = this.player.position;
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
    const players = this._mpPlayers();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const prevX = p.mesh.position.x;
      const prevZ = p.mesh.position.z;
      p.update(delta);

      let remove = false;
      let hitPlayer = null;
      for (const pl of players) {
        if (p.hits(pl.pos)) { hitPlayer = pl; break; }
      }
      if (hitPlayer) {
        this._damagePlayer(hitPlayer.id, p.damage, 0.4);
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
      if (this.player.wantsStep) this.sound.play('step');

      if (this.player.wantsMeleeHit) {
        this._doMeleeAttack();
      }

      this.level.update(delta);

      if (this.multiplayer) {
        this._netUpdate(delta); // interpolation avatars + envoi du transform local
      }

      // Ennemis/projectiles : simulés en solo et chez le host ; le non-host
      // (coop) applique les snapshots reçus.
      if (!this.multiplayer || this.isHost) {
        this._updateEnemies(delta);
        this._updateProjectiles(delta);
      } else if (this.mode === MODE.COOP) {
        this._updateRemoteEnemies(delta);
        this._syncRemoteProjectiles();
      }

      this.particles.update(delta);
      this._checkKey();

      // Détection de pièce courante.
      const room = this.level.getRoomAt(
        this.player.position.x, this.player.position.z
      );
      if (room) this._enterRoom(room);

      // Mort / réapparition.
      if (this.multiplayer) {
        if (this.player.isDead && !this._localDead) this._localPlayerDied(null);
        if (this._respawnTimer > 0) {
          this._respawnTimer -= delta;
          if (this._respawnTimer <= 0) this._respawnLocal();
        }
        if (this.isHost) this._maybeBroadcastWorld();
        this._updateScoreboard();
      } else if (this.player.isDead) {
        this.sound.play('gameover');
        this.sound.stopMusic();
        this.state = 'gameover';
        this.input.exitLock();
        this.menu.showGameOver(this._buildScore(false));
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

  // =====================================================================
  // MULTIJOUEUR
  // =====================================================================

  _openLobby() {
    this.menu.hideAll();
    this.lobby.open();
  }

  // Démarrage d'une partie en réseau (appelé par le Lobby au message `start`).
  _startNetworkGame(ctx) {
    this.sound.resume();
    this.multiplayer = true;
    this.net = ctx.net;
    this.mode = ctx.mode;
    this.isHost = ctx.isHost;
    this.selfId = ctx.selfId;
    this.name = ctx.name;
    this.color = ctx.color;
    this._stainSeed = ctx.seed >>> 0;
    this._localDead = false;
    this._respawnTimer = 0;
    this.frags = {};
    this.playerInfo = new Map();
    for (const p of ctx.players) {
      this.playerInfo.set(p.id, { name: p.name, color: p.color });
      this.frags[p.id] = 0;
    }

    this._bindGameNet();

    this.levelIndex = 0;
    this.coins = 0;
    this.runStartTime = performance.now();
    this.inventory = { heal: 0, damage: 0 };
    this.upgrades = { bonusMaxHp: 0 };
    this._buildWorld();

    // Avatars distants.
    for (const rp of this.remotePlayers.values()) rp.dispose();
    this.remotePlayers.clear();
    for (const p of ctx.players) {
      if (p.id === this.selfId) continue;
      const rp = new RemotePlayer({ id: p.id, name: p.name, color: p.color });
      rp.target.set(this.config.playerStart.x, 0, this.config.playerStart.z);
      rp.group.position.copy(rp.target);
      this.remotePlayers.set(p.id, rp);
      this.scene.add(rp.group);
    }

    this.menu.hideAll();
    this.state = 'playing';
    this.clock.getDelta();
    this.ui.setScoreboardVisible(true);
    this.ui.showMessage(
      this.mode === MODE.PVP ? '⚔️ Combat — chacun pour soi !' : '🤝 Coopération — nettoyez ensemble !', 3);
    this.input.requestLock();
  }

  // Liste des joueurs (local + distants vivants) pour le ciblage IA / collisions.
  _mpPlayers() {
    const arr = [{ id: this.selfId || 'self', pos: this.player.position, local: true }];
    if (this.multiplayer) {
      for (const rp of this.remotePlayers.values()) {
        if (rp.dead) continue;
        arr.push({ id: rp.id, pos: rp.aimPos(), local: false });
      }
    }
    return arr;
  }

  _nearestPlayer(players, from) {
    let best = players[0];
    let bd = Infinity;
    for (const p of players) {
      const dx = p.pos.x - from.x;
      const dz = p.pos.z - from.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // Interpolation des avatars + envoi du transform local (throttlé).
  _netUpdate(delta) {
    for (const rp of this.remotePlayers.values()) rp.update(delta);
    this.net.sendThrottled({
      type: MSG.STATE,
      x: +this.player.position.x.toFixed(3),
      z: +this.player.position.z.toFixed(3),
      yaw: +this.player.yaw.toFixed(3),
      hp: Math.round(this.player.hp),
      coins: this.coins,
      dead: this._localDead,
    }, STATE_HZ);
  }

  // Host : diffusion périodique de l'état du monde.
  _maybeBroadcastWorld() {
    const now = performance.now();
    if (now - this._lastWorldSent < 1000 / WORLD_HZ) return;
    this._lastWorldSent = now;
    const enemies = this.enemies.map((e, i) => ({
      i, x: +e.position.x.toFixed(2), z: +e.position.z.toFixed(2),
      hp: Math.round(e.hp), dead: e.dead,
    }));
    const proj = this.projectiles.map((p) => ({
      id: p.netId, t: p.type,
      x: +p.mesh.position.x.toFixed(2), y: +p.mesh.position.y.toFixed(2), z: +p.mesh.position.z.toFixed(2),
    }));
    this.net.send({ type: MSG.WORLD, enemies, proj, key: this.keyCollected });
  }

  // Non-host (coop) : interpole les ennemis vers les cibles du dernier snapshot.
  _updateRemoteEnemies(delta) {
    const t = 1 - Math.exp(-12 * delta);
    for (const e of this.enemies) {
      if (e.dead) { this._fadeDeadEnemy(e); continue; }
      if (e._netTarget) {
        e.group.position.x += (e._netTarget.x - e.group.position.x) * t;
        e.group.position.z += (e._netTarget.z - e.group.position.z) * t;
        const dx = this.player.position.x - e.group.position.x;
        const dz = this.player.position.z - e.group.position.z;
        e.group.rotation.y = Math.atan2(dx, dz);
      }
      e._animate?.(delta, performance.now() * 0.001);
    }
    this._updateBossBar();
  }

  // Non-host : reconcilie les projectiles distants depuis le dernier snapshot.
  _syncRemoteProjectiles() {
    const data = this._remoteProjData || [];
    const seen = new Set();
    for (const pd of data) {
      seen.add(pd.id);
      let mesh = this._remoteProj.get(pd.id);
      if (!mesh) {
        const color = PROJ_COLORS[pd.t] || 0xffffff;
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 8),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.6 })
        );
        this.scene.add(mesh);
        this._remoteProj.set(pd.id, mesh);
      }
      mesh.position.set(pd.x, pd.y, pd.z);
    }
    for (const [id, mesh] of this._remoteProj) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this._remoteProj.delete(id);
      }
    }
  }

  _clearRemoteProj() {
    for (const mesh of this._remoteProj.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this._remoteProj.clear();
    this._remoteProjData = [];
  }

  // Application d'un snapshot monde (non-host).
  _applyWorldSnapshot(m) {
    for (const es of m.enemies) {
      const e = this.enemies[es.i];
      if (!e) continue;
      e.hp = es.hp;
      e._netTarget = { x: es.x, z: es.z };
      if (es.dead && !e.dead) {
        e.dead = true;
        e.alive = false;
        this.particles.burst(e.position, e.particleColor || 0xffffff, e.isBoss ? 28 : 12,
          e.isBoss ? { speed: 5, up: 4, life: 1.0, size: 1.6 } : { speed: 3, up: 2.5, life: 0.6 });
        this.sound.play(e.isBoss ? 'unlock' : 'enemyDeath');
        if (e.isBoss) { this.boss = null; this.ui.setBossVisible(false); }
      }
    }
    this._remoteProjData = m.proj || [];
    if (m.key && !this.keyCollected) {
      this.keyCollected = true;
      this.level.collectKey();
      this.level.unlockDoor(this.config.lockedDoorId);
    }
  }

  // Host : mort du boss → niveau suivant ou victoire commune.
  _hostHandleBossDeath() {
    if (this.levelIndex < LEVELS.length - 1) {
      this.sound.play('unlock');
      const nextSeed = (Math.random() * 0xffffffff) >>> 0;
      this._stainSeed = nextSeed;
      this.net.send({ type: MSG.LEVEL_CHANGE, index: this.levelIndex + 1, seed: nextSeed });
      this._goToLevel(this.levelIndex + 1);
    } else {
      this.net.send({ type: MSG.VICTORY });
      this._mpVictory();
    }
  }

  _goToLevel(index) {
    this._clearRemoteProj();
    this.levelIndex = index;
    this._buildWorld(true);
    // Réattache les avatars distants à la nouvelle scène.
    for (const rp of this.remotePlayers.values()) {
      rp.target.set(this.config.playerStart.x, 0, this.config.playerStart.z);
      rp.group.position.copy(rp.target);
      rp.setDead(false);
      this.scene.add(rp.group);
    }
    const config = LEVELS[index];
    this.ui.showMessage(`Niveau ${config.id} : ${config.name}`, 3.5);
    this.clock.getDelta();
  }

  _mpVictory() {
    this.sound.play('victory');
    this.sound.stopMusic();
    this.state = 'victory';
    this.input.exitLock();
    this.ui.setScoreboardVisible(false);
    this.menu.showVictory(this._buildScore(true));
  }

  // --- Mort & réapparition du joueur local ---
  _localPlayerDied(by) {
    if (this._localDead) return;
    this._localDead = true;
    this._respawnTimer = RESPAWN_DELAY;
    this.player.hp = 0;
    this.sound.play('hurt');
    this.net.send({ type: MSG.DIED, by: by || null });
    this.ui.showMessage('💀 Éliminé — réapparition…', RESPAWN_DELAY);
  }

  _respawnLocal() {
    this._localDead = false;
    this._respawnTimer = 0;
    const s = this.config.playerStart;
    this.player.reset(s.x, s.z); // restaure les PV au max
    this.ui.setHealth(this.player.hp, this.player.maxHp);
    this.net.send({ type: MSG.RESPAWN, x: s.x, z: s.z });
  }

  // --- Réception des messages in-game ---
  _bindGameNet() {
    const net = this.net;

    net.on(MSG.STATE, (m) => {
      const rp = this.remotePlayers.get(m.id);
      if (rp) rp.setState(m);
    });

    net.on(MSG.SWING, (m) => this.remotePlayers.get(m.id)?.swing());

    net.on(MSG.WORLD, (m) => {
      if (!this.isHost) this._applyWorldSnapshot(m);
    });

    net.on(MSG.CLEAN, (m) => {
      if (!Array.isArray(m.ids) || !this.stains) return;
      for (const id of m.ids) {
        const r = this.stains.removeById(id);
        if (r) {
          this.particles.burst(r.position, 0x9fd8ff, 6, { speed: 2, up: 2, life: 0.5, gravity: 4 });
        }
      }
      this._updateCleanlinessHud(this._currentRoom);
    });

    // Coop : un client a frappé un ennemi → le host applique les dégâts.
    net.on(MSG.ENEMY_HIT, (m) => {
      if (!this.isHost) return;
      const e = this.enemies[m.i];
      if (!e || e.dead) return;
      e.takeDamage(m.dmg);
      if (e.dead) this._onEnemyKilled(e, m.id);
    });

    // Le host nous crédite des pièces pour un ennemi qu'on a tué.
    net.on(MSG.ENEMY_KILLED, (m) => {
      if (m.by === this.selfId) {
        this.coins += m.coin || 0;
        this.ui.setCoins(this.coins);
        this.sound.play('coin');
      }
    });

    // Dégâts PvE qui nous sont destinés (routés par le host).
    net.on(MSG.HIT, (m) => {
      if (m.targetId === this.selfId) this._takeNetDamage(m.dmg, null);
    });

    // Dégâts PvP d'un autre joueur.
    net.on(MSG.PVP_HIT, (m) => {
      if (m.targetId === this.selfId) this._takeNetDamage(m.dmg, m.id);
    });

    net.on(MSG.DIED, (m) => {
      const rp = this.remotePlayers.get(m.id);
      if (rp) rp.setDead(true);
      if (this.mode === MODE.PVP && m.by) {
        this.frags[m.by] = (this.frags[m.by] || 0) + 1;
        if (m.by === this.selfId) this.ui.showMessage('🎯 Élimination !', 1.5);
      }
    });

    net.on(MSG.RESPAWN, (m) => {
      const rp = this.remotePlayers.get(m.id);
      if (rp) { rp.setDead(false); rp.target.set(m.x, 0, m.z); rp.group.position.set(m.x, 0, m.z); rp.hp = rp.maxHp; }
    });

    net.on(MSG.LEVEL_CHANGE, (m) => {
      if (!this.isHost) { this._stainSeed = m.seed >>> 0; this._goToLevel(m.index); }
    });

    net.on(MSG.VICTORY, () => { if (!this.isHost) this._mpVictory(); });

    // Un joueur quitte en cours de partie.
    net.on(MSG.PLAYERS, (m) => {
      if (this.state !== 'playing' || !Array.isArray(m.list)) return;
      const ids = new Set(m.list.map((p) => p.id));
      for (const [id, rp] of this.remotePlayers) {
        if (!ids.has(id)) { rp.dispose(); this.scene.remove(rp.group); this.remotePlayers.delete(id); }
      }
    });

    net.on(MSG.HOST_LEFT, () => {
      if (this.state === 'playing') this._endNetworkGame('L\'hôte a quitté la partie.');
    });

    net.on('disconnected', () => {
      if (this.state === 'playing') this._endNetworkGame('Connexion au serveur perdue.');
    });
  }

  // Applique des dégâts reçus du réseau au joueur local (+ mort éventuelle).
  _takeNetDamage(dmg, by) {
    if (this._localDead) return;
    this.player.takeDamage(dmg);
    this.player.addShake(0.4);
    this.ui.flashDamage();
    this.ui.setHealth(this.player.hp, this.player.maxHp);
    this.sound.play('hurt');
    if (this.player.isDead) this._localPlayerDied(by);
  }

  // Mise à jour du tableau des scores (frags PvP / PV coop). Throttlé (~6 Hz).
  _updateScoreboard() {
    const now = performance.now();
    if (now - (this._sbLast || 0) < 160) return;
    this._sbLast = now;
    const rows = [];
    rows.push({
      id: this.selfId, name: this.name + ' (toi)', color: this.color,
      hp: this.player.hp, dead: this._localDead, me: true,
    });
    for (const rp of this.remotePlayers.values()) {
      rows.push({ id: rp.id, name: rp.name, color: rp.colorHex, hp: rp.hp, dead: rp.dead, me: false });
    }
    if (this.mode === MODE.PVP) {
      for (const r of rows) r.value = String(this.frags[r.id] || 0);
      rows.sort((a, b) => Number(b.value) - Number(a.value));
      this.ui.setScoreboard('Frags', rows);
    } else {
      for (const r of rows) r.value = Math.max(0, Math.round(r.hp)) + ' PV';
      this.ui.setScoreboard('Équipe', rows);
    }
  }

  // Fin de partie réseau (host parti / déconnexion) → retour menu propre.
  _endNetworkGame(reason) {
    this.sound.stopMusic();
    this.input.exitLock();
    this._teardownMultiplayer();
    this.state = 'menu';
    this.menu.showMenu();
    this.ui.showMessage(reason || 'Partie terminée.', 4);
  }

  _teardownMultiplayer() {
    for (const rp of this.remotePlayers.values()) { this.scene.remove(rp.group); rp.dispose(); }
    this.remotePlayers.clear();
    this._clearRemoteProj();
    this.ui.setScoreboardVisible(false);
    this.multiplayer = false;
    this.isHost = false;
    try { this.net?.close(); } catch { /* noop */ }
    this.net = null;
  }
}

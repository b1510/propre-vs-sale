// Gestion des écrans plein écran : menu principal, game over, victoire.
// Gère aussi la saisie du pseudo et l'affichage du classement en ligne.

const PSEUDO_KEY = 'pvs_pseudo';

export default class Menu {
  constructor(leaderboard = null) {
    this.leaderboard = leaderboard;

    this.menuScreen = document.getElementById('menuScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.victoryScreen = document.getElementById('victoryScreen');

    this.btnPlay = document.getElementById('btnPlay');
    this.btnMultiplayer = document.getElementById('btnMultiplayer');
    this.btnQuit = document.getElementById('btnQuit');
    this.btnRestart = document.getElementById('btnRestart');
    this.btnRestartWin = document.getElementById('btnRestartWin');

    this.gameOverInfo = document.getElementById('gameOverInfo');
    this.victoryInfo = document.getElementById('victoryInfo');

    // Blocs classement (game over / victoire).
    this.goBlock = {
      score: document.getElementById('gameOverScore'),
      name: document.getElementById('goName'),
      submit: document.getElementById('goSubmit'),
      board: document.getElementById('goBoard'),
      wrap: document.getElementById('goLeaderboard'),
    };
    this.winBlock = {
      score: document.getElementById('victoryScore'),
      name: document.getElementById('winName'),
      submit: document.getElementById('winSubmit'),
      board: document.getElementById('winBoard'),
      wrap: document.getElementById('winLeaderboard'),
    };
    // Classement en lecture seule sur l'écran d'accueil.
    this.menuBlock = {
      board: document.getElementById('menuBoard'),
      wrap: document.getElementById('menuLeaderboard'),
    };

    this.onPlay = null;
    this.onRestart = null;
    this.onMultiplayer = null;

    this.btnPlay.addEventListener('click', () => {
      if (this.onPlay) this.onPlay();
    });

    this.btnMultiplayer.addEventListener('click', () => {
      if (this.onMultiplayer) this.onMultiplayer();
    });

    this.btnQuit.addEventListener('click', () => {
      // Tente de fermer l'onglet ; sinon affiche un message.
      window.open('', '_self');
      window.close();
      this.btnQuit.textContent = 'Ferme l\'onglet pour quitter';
    });

    this.btnRestart.addEventListener('click', () => {
      if (this.onRestart) this.onRestart();
    });
    this.btnRestartWin.addEventListener('click', () => {
      if (this.onRestart) this.onRestart();
    });

    // Câblage des boutons d'envoi de score.
    this.goBlock.submit.addEventListener('click', () =>
      this._submit(this.goBlock, this._lastGoStats)
    );
    this.winBlock.submit.addEventListener('click', () =>
      this._submit(this.winBlock, this._lastWinStats)
    );
  }

  showMenu() {
    this.menuScreen.classList.remove('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');

    // Affiche le top 10 sous les boutons (masqué si pas de backend configuré).
    if (!this.leaderboard || !this.leaderboard.isConfigured()) {
      if (this.menuBlock.wrap) this.menuBlock.wrap.classList.add('hidden');
    } else {
      if (this.menuBlock.wrap) this.menuBlock.wrap.classList.remove('hidden');
      this._renderBoard(this.menuBlock, null);
    }
  }

  hideAll() {
    this.menuScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
  }

  showGameOver(stats) {
    this._lastGoStats = stats;
    this.gameOverScreen.classList.remove('hidden');
    this.gameOverInfo.textContent = 'La saleté a gagné...';
    this._setupBlock(this.goBlock, stats);
  }

  showVictory(stats) {
    this._lastWinStats = stats;
    this.victoryScreen.classList.remove('hidden');
    this.victoryInfo.textContent = 'La villa est propre !';
    this._setupBlock(this.winBlock, stats);
  }

  // --- Classement ---

  _scoreLine(s) {
    return `Score : ${s.score} · 🪙 ${s.coins} · niveau ${s.level} · ` +
      `propreté ${s.clean_pct}% · temps ${s.time_sec}s`;
  }

  _setupBlock(block, stats) {
    block.score.textContent = this._scoreLine(stats);

    // Pas de backend configuré : on masque le classement, on garde le score local.
    if (!this.leaderboard || !this.leaderboard.isConfigured()) {
      if (block.wrap) block.wrap.classList.add('hidden');
      return;
    }
    if (block.wrap) block.wrap.classList.remove('hidden');

    block.name.value = localStorage.getItem(PSEUDO_KEY) || '';
    block.submit.disabled = false;
    block.submit.textContent = 'Enregistrer';
    block.submitted = false;

    this._renderBoard(block, null);
  }

  async _submit(block, stats) {
    if (!stats || block.submitted || !this.leaderboard) return;
    const name = (block.name.value || '').trim().slice(0, 24);
    if (!name) {
      block.name.focus();
      return;
    }
    block.submit.disabled = true;
    block.submit.textContent = 'Envoi…';
    localStorage.setItem(PSEUDO_KEY, name);

    const ok = await this.leaderboard.submitScore({ ...stats, name });
    block.submitted = ok;
    block.submit.textContent = ok ? 'Enregistré ✓' : 'Réessayer';
    block.submit.disabled = !ok ? false : true;
    this._lastName = name;
    await this._renderBoard(block, name);
  }

  async _renderBoard(block, highlightName) {
    block.board.innerHTML = '<li class="lb-empty">Chargement…</li>';
    const rows = await this.leaderboard.fetchTop(10);
    if (!rows.length) {
      block.board.innerHTML = '<li class="lb-empty">Aucun score pour l\'instant.</li>';
      return;
    }
    block.board.innerHTML = '';
    let highlighted = false;
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      // Surligne la première ligne correspondant au pseudo qui vient d'envoyer.
      if (!highlighted && highlightName && r.name === highlightName) {
        li.classList.add('lb-me');
        highlighted = true;
      }
      li.innerHTML =
        `<span class="lb-rank">${i + 1}</span>` +
        `<span class="lb-name">${this._escape(r.name)}</span>` +
        `<span class="lb-score">${r.score}</span>`;
      block.board.appendChild(li);
    });
  }

  _escape(str) {
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }
}

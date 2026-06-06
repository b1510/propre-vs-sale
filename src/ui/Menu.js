// Gestion des écrans plein écran : menu principal, game over, victoire.
// Pas de dépendances.

export default class Menu {
  constructor() {
    this.menuScreen = document.getElementById('menuScreen');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.victoryScreen = document.getElementById('victoryScreen');

    this.btnPlay = document.getElementById('btnPlay');
    this.btnQuit = document.getElementById('btnQuit');
    this.btnRestart = document.getElementById('btnRestart');
    this.btnRestartWin = document.getElementById('btnRestartWin');

    this.gameOverInfo = document.getElementById('gameOverInfo');
    this.victoryInfo = document.getElementById('victoryInfo');

    this.onPlay = null;
    this.onRestart = null;

    this.btnPlay.addEventListener('click', () => {
      if (this.onPlay) this.onPlay();
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
  }

  showMenu() {
    this.menuScreen.classList.remove('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
  }

  hideAll() {
    this.menuScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
  }

  showGameOver(coins) {
    this.gameOverScreen.classList.remove('hidden');
    this.gameOverInfo.textContent =
      `La saleté a gagné... Pièces collectées : ${coins} 🪙`;
  }

  showVictory(coins) {
    this.victoryScreen.classList.remove('hidden');
    this.victoryInfo.textContent =
      `La villa est propre ! Pièces collectées : ${coins} 🪙`;
  }
}

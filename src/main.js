import Game from './Game.js';

// Point d'entrée : instancie le jeu une fois le DOM prêt.
const container = document.getElementById('app');
const game = new Game(container);

// Exposé pour debug éventuel.
window.__game = game;

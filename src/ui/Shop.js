// Boutique affichée entre deux niveaux : permet de dépenser les pièces.
// Les effets (soin, boost, +PV max) sont appliqués par Game via le callback buy().

export const SHOP_ITEMS = [
  {
    id: 'heal',
    name: 'Soin instantané',
    desc: '+60 PV immédiats. À utiliser en jeu avec la touche 1.',
    price: 90,
    type: 'consumable',
  },
  {
    id: 'damage',
    name: 'Boost de dégâts',
    desc: 'Dégâts ×1.5 pendant 20 s. À activer avec la touche 2.',
    price: 160,
    type: 'consumable',
  },
  {
    id: 'maxhp',
    name: '+20 PV max',
    desc: 'Augmente la vie maximale (permanent, cumulable). Soigne aussi de 20.',
    price: 250,
    type: 'permanent',
  },
];

export default class Shop {
  constructor() {
    this.screen = document.getElementById('shopScreen');
    this.coinsEl = document.getElementById('shopCoins');
    this.itemsEl = document.getElementById('shopItems');
    this.btnContinue = document.getElementById('btnShopContinue');

    this.ctx = null;
    this.btnContinue.addEventListener('click', () => {
      if (this.ctx && this.ctx.onContinue) this.ctx.onContinue();
    });
  }

  // ctx : { getCoins(), getOwned(id), buy(id)->bool, onContinue() }
  open(ctx) {
    this.ctx = ctx;
    this.screen.classList.remove('hidden');
    this._render();
  }

  hide() {
    this.screen.classList.add('hidden');
  }

  _render() {
    const coins = this.ctx.getCoins();
    this.coinsEl.textContent = `🪙 ${coins}`;
    this.itemsEl.innerHTML = '';

    for (const item of SHOP_ITEMS) {
      const row = document.createElement('div');
      row.className = 'shop-item';

      const owned = this.ctx.getOwned(item.id);
      const ownedLabel = item.type === 'permanent'
        ? (owned > 0 ? `Acheté ×${owned}` : '')
        : `Possédé ×${owned}`;

      const info = document.createElement('div');
      info.className = 'info';
      info.innerHTML =
        `<div class="name">${item.name}</div>` +
        `<div class="desc">${item.desc}</div>` +
        (ownedLabel ? `<div class="owned">${ownedLabel}</div>` : '');
      row.appendChild(info);

      const btn = document.createElement('button');
      btn.textContent = `Acheter (${item.price} 🪙)`;
      btn.disabled = coins < item.price;
      btn.addEventListener('click', () => {
        if (this.ctx.buy(item.id)) this._render();
      });
      row.appendChild(btn);

      this.itemsEl.appendChild(row);
    }
  }
}

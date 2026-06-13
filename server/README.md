# Serveur multijoueur — Propre vs Sale

Petit serveur WebSocket (Node + [`ws`](https://github.com/websockets/ws)) qui gère les
**salons** (lobby) et **relaie** les messages entre joueurs. Il ne simule pas le jeu :
le premier joueur d'un salon est le *host* et son navigateur fait autorité sur le monde
(ennemis, projectiles, taches). Le serveur ne fait que connecter les joueurs entre eux.

## Lancer en local

```bash
cd server
npm install
npm start          # écoute http://localhost:8787 (WebSocket sur le même port)
```

Vérifier qu'il tourne : ouvrir <http://localhost:8787/health> → `{"ok":true,"rooms":0}`.

Côté client (à la racine du projet), pointer vers ce serveur via `.env` :

```
VITE_SERVER_URL=ws://localhost:8787
```

Sans `VITE_SERVER_URL`, le client retombe sur `ws://localhost:8787` par défaut.

## Déployer (Render)

Le fichier [`render.yaml`](./render.yaml) décrit un service web Node gratuit.

1. Pousser le repo sur GitHub.
2. Sur Render : *New → Blueprint* et sélectionner le repo (il lit `server/render.yaml`).
3. Une fois en ligne, récupérer l'URL `https://<nom>.onrender.com`.
4. Configurer le client en production : `VITE_SERVER_URL=wss://<nom>.onrender.com`
   (noter `wss://`, pas `ws://`, car le site est servi en HTTPS).

> Railway / Fly.io fonctionnent pareil : `rootDir = server`, démarrage `npm start`,
> la plateforme fournit `PORT` automatiquement.

## Déployer sur ton propre VPS

Sur le serveur (Node 18+ installé) :

```bash
git clone <ton-repo> && cd <repo>/server
npm install
PORT=8787 node index.js        # test rapide
```

Pour le garder en vie, utilise un gestionnaire de process, p. ex. **pm2** :

```bash
npm install -g pm2
PORT=8787 pm2 start index.js --name pvs-server
pm2 save && pm2 startup       # redémarrage auto au boot
```

Le client (site en HTTPS) doit parler en **`wss://`** : place le serveur derrière
un reverse proxy TLS (Nginx/Caddy) qui termine le HTTPS et relaie le WebSocket.

Exemple **Nginx** (sous-domaine `ws.exemple.com` → port local 8787) :

```nginx
server {
  listen 443 ssl;
  server_name ws.exemple.com;
  ssl_certificate     /etc/letsencrypt/live/ws.exemple.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ws.exemple.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # indispensable pour le WebSocket
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;                    # garde les sockets longues ouvertes
  }
}
```

Exemple **Caddy** (HTTPS automatique, encore plus court) :

```
ws.exemple.com {
  reverse_proxy 127.0.0.1:8787
}
```

Puis configure le client : `VITE_SERVER_URL=wss://ws.exemple.com`.
(Si tu sers le jeu en simple HTTP sur le VPS, `ws://IP:8787` suffit, mais les
navigateurs bloquent `ws://` depuis une page `https://`.)

## Protocole (résumé)

| Message (client → serveur) | Effet |
| --- | --- |
| `create {name,color,mode}` | crée un salon, l'émetteur devient host |
| `join {code,name,color}` | rejoint un salon existant |
| `setReady {ready}` | (in)disponibilité dans le lobby |
| `setMode {mode}` | host change le mode (coop/pvp) |
| `start` | host lance la partie (génère une `seed` partagée) |
| `leave` | quitte le salon |

Les messages **in-game** (`state`, `world`, `clean`, `hit`, `pvpHit`, `enemyKilled`,
`swing`, `died`, `respawn`, `levelChange`, `gameover`, `victory`, `chat`) sont **relayés**
tels quels aux autres membres du salon, estampillés de l'`id` de l'émetteur.

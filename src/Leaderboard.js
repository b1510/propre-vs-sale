// Classement en ligne via l'API REST (PostgREST) de Supabase.
// Aucune dépendance : on utilise fetch directement.
// Les clés viennent des variables d'env Vite (import.meta.env.VITE_*).
// Si elles manquent, le module est "non configuré" et le jeu reste jouable
// sans classement (les méthodes échouent proprement).

// Normalise l'URL du projet : on tolère une valeur avec ou sans `/rest/v1`
// et un éventuel slash final, pour éviter les chemins dupliqués (/rest/v1/rest/v1).
const RAW_URL = import.meta.env.VITE_SUPABASE_URL;
const URL = RAW_URL
  ? RAW_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
  : RAW_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default class Leaderboard {
  isConfigured() {
    return Boolean(URL && KEY);
  }

  _headers(extra = {}) {
    return {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  // Enregistre une partie. entry = { name, score, coins, level, time_sec, clean_pct, won }
  async submitScore(entry) {
    if (!this.isConfigured()) return false;
    try {
      const res = await fetch(`${URL}/rest/v1/scores`, {
        method: 'POST',
        headers: this._headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify(entry),
      });
      if (!res.ok) {
        console.warn('[Leaderboard] submit failed', res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Leaderboard] submit error', err);
      return false;
    }
  }

  // Récupère le top N trié par score décroissant.
  async fetchTop(limit = 10) {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(
        `${URL}/rest/v1/scores?select=*&order=score.desc&limit=${limit}`,
        { headers: this._headers() }
      );
      if (!res.ok) {
        console.warn('[Leaderboard] fetch failed', res.status);
        return [];
      }
      return await res.json();
    } catch (err) {
      console.warn('[Leaderboard] fetch error', err);
      return [];
    }
  }
}

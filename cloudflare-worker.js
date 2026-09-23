/**
 * CX Intelligence Platform — Anthropic API Proxy
 * Déployez ce fichier comme Cloudflare Worker
 *
 * SETUP :
 * 1. Allez sur https://workers.cloudflare.com → "Create a Worker"
 * 2. Collez ce code et cliquez "Save and Deploy"
 * 3. Dans Settings → Variables → Ajouter un Secret :
 *    Nom : ANTHROPIC_API_KEY   Valeur : sk-ant-votre-clé
 * 4. Copiez l'URL de votre Worker (ex: https://cx-proxy.mon-compte.workers.dev)
 * 5. Mettez cette URL dans votre HTML (voir PROXY_URL plus bas)
 */

// ─── Origines autorisées ──────────────────────────────────────────────────────
// Ajoutez votre domaine GitHub Pages ici
const ALLOWED_ORIGINS = [
  'https://votre-username.github.io',    // ← remplacez par votre domaine GitHub Pages
  'http://localhost:3000',               // pour tester en local
  'http://127.0.0.1:5500',              // VS Code Live Server
  'null',                                // fichier ouvert directement (file://)
];

export default {
  async fetch(request, env) {

    const origin = request.headers.get('Origin') || '';

    // ─── Preflight CORS ───────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, origin, 204);
    }

    // ─── Vérification méthode ─────────────────────────────────────────────────
    if (request.method !== 'POST') {
      return corsResponse(
        JSON.stringify({ error: 'Method not allowed' }),
        origin, 405,
        { 'Content-Type': 'application/json' }
      );
    }

    // ─── Vérification origine ─────────────────────────────────────────────────
    const isAllowed = ALLOWED_ORIGINS.some(o =>
      o === origin || (o.endsWith('*') && origin.startsWith(o.slice(0, -1)))
    );
    if (!isAllowed) {
      return corsResponse(
        JSON.stringify({ error: `Origin not allowed: ${origin}` }),
        origin, 403,
        { 'Content-Type': 'application/json' }
      );
    }

    // ─── Clé API ──────────────────────────────────────────────────────────────
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return corsResponse(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Worker secrets' }),
        origin, 500,
        { 'Content-Type': 'application/json' }
      );
    }

    // ─── Body ─────────────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(
        JSON.stringify({ error: 'Invalid JSON body' }),
        origin, 400,
        { 'Content-Type': 'application/json' }
      );
    }

    // ─── Appel Anthropic ──────────────────────────────────────────────────────
    try {
      const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await anthropicResp.json();

      return corsResponse(
        JSON.stringify(data),
        origin,
        anthropicResp.status,
        { 'Content-Type': 'application/json' }
      );

    } catch (err) {
      return corsResponse(
        JSON.stringify({ error: 'Upstream error', detail: err.message }),
        origin, 502,
        { 'Content-Type': 'application/json' }
      );
    }
  }
};

// ─── Helper CORS ──────────────────────────────────────────────────────────────
function corsResponse(body, origin, status = 200, extraHeaders = {}) {
  const headers = {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
    ...extraHeaders,
  };
  return new Response(body, { status, headers });
}

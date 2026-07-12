// Worker BikeHealth : sert les assets statiques et relaie les formulaires
// vers Google Apps Script côté serveur. Avantages vs l'ancien fetch no-cors
// depuis le navigateur : vraie détection d'échec (l'utilisateur n'a plus de
// faux succès si Apps Script refuse), et URLs Apps Script non exposées.

const APPS_SCRIPT_URLS = {
  '/api/notify': 'https://script.google.com/macros/s/AKfycbxB8MsWmqbWdTaPY6WHANBXZpNaftfmfEkyEo8-A4veReqPCL7hQM7729kIyeUj-v3k/exec',
  '/api/notify-pro': 'https://script.google.com/macros/s/AKfycbwhZbzhpPste_2Kyh-ljpMxF4OzFQ1bBVfosey0PQW7QPMUCsHJ711u9JXRkFbY7Stk/exec',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = APPS_SCRIPT_URLS[url.pathname];

    if (target) {
      if (request.method !== 'POST') {
        return json({ ok: false, error: 'method-not-allowed' }, 405);
      }
      return handleNotify(request, target);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleNotify(request, target) {
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid-json' }, 400);
  }

  if (typeof payload.email !== 'string' || !EMAIL_RE.test(payload.email.trim())) {
    return json({ ok: false, error: 'invalid-email' }, 400);
  }

  // Apps Script attend un POST text/plain (pas de préflight CORS à gérer
  // côté serveur, mais on garde le format que la sheet sait parser).
  const upstream = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    return json({ ok: false, error: 'upstream-error' }, 502);
  }

  return json({ ok: true });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

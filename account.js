/* =====================================================================
   Meivi games: the player's account.
   Sign-in is the account of the Shopify store (config.js, "account"): the phone goes to the store's own
   sign-in page and comes back with a proof, the games' server checks it and gives this phone a long session.
   The server keeps what the player owns: credits, opened games, "all games" passes.

   Game keys: "s:<id>" a game for one phone (1 credit), "m:<id>" a multiplayer game (2 credits).
   While config.locks is false every game is open for everyone and the account is only shown.
   No text of any language is in this file: words come from T.account.
   ===================================================================== */
(function () {
  const CFG = MEIVI.config, A = CFG.account, T = MEIVI.ui, X = T.account;
  if (!A || !A.client || !A.server || !X || typeof location === "undefined") return;
  const AUTH = "https://shopify.com/authentication/" + A.shop;
  const HERE = location.origin + "/";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const box = (store, key, v) => { try { if (v === undefined) return store.getItem(key); if (v === null) store.removeItem(key); else store.setItem(key, v); } catch (e) {} return null; };
  const keep = v => box(localStorage, "meivi.account", v === null ? null : JSON.stringify(v));
  const st = { token: null, id: null, account: null, sheet: false, busy: false, error: "", sure: "" };
  try { const s = JSON.parse(box(localStorage, "meivi.account") || "null"); if (s && s.token) Object.assign(st, { token: s.token, id: s.id || null, account: s.account || null }); } catch (e) {}
  const save = () => keep(st.token ? { token: st.token, id: st.id, account: st.account } : null);
  const redraw = () => { if (MEIVI.app && MEIVI.app.redraw) MEIVI.app.redraw(); };

  /* Trying the locks before they are switched on for everyone: add ?locks=1 to the address once. */
  try { if (new URLSearchParams(location.search).has("locks")) box(sessionStorage, "meivi.locks", "1"); } catch (e) {}
  const locksOn = () => !!CFG.locks || box(sessionStorage, "meivi.locks") === "1";
  const cost = key => key[0] === "m" ? 2 : 1;
  const owns = key => !!st.account && (st.account.passes.includes(key[0]) || st.account.games.includes(key));
  const locked = key => locksOn() && !owns(key);

  async function api(path, method, body) {
    const r = await fetch(A.server + "/" + path, { method: method || "GET", headers: Object.assign({ "Content-Type": "application/json" }, st.token ? { Authorization: "Bearer " + st.token } : {}), body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && d.error === "signed_out") { Object.assign(st, { token: null, id: null, account: null }); save(); }
    if (!r.ok) throw new Error(d.error || "server");
    return d;
  }
  const b64url = bytes => btoa(String.fromCharCode.apply(null, new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const random = n => b64url(crypto.getRandomValues(new Uint8Array(n)));

  /* Off to the store's sign-in page. "back" says where to return the player afterwards. */
  async function signIn(back) {
    const verifier = random(48), state = random(16), nonce = random(16);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    box(sessionStorage, "meivi.signin", JSON.stringify({ verifier, state, nonce, back: back || null }));
    location.assign(AUTH + "/oauth/authorize?" + new URLSearchParams({ client_id: A.client, response_type: "code", redirect_uri: HERE,
      scope: "openid email customer-account-api:full", state, nonce, code_challenge: challenge, code_challenge_method: "S256", locale: CFG.lang }));
  }
  /* Back from the store with a one-time code: swap it at the store, then show the proof to the games' server. */
  async function finish(code, state) {
    const p = JSON.parse(box(sessionStorage, "meivi.signin") || "null");
    box(sessionStorage, "meivi.signin", null);
    if (!p || p.state !== state) throw new Error("state");
    const r = await fetch(AUTH + "/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: A.client, redirect_uri: HERE, code, code_verifier: p.verifier }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token || !d.id_token) throw new Error("store");
    const s = await api("session", "POST", { id_token: d.id_token, access_token: d.access_token, nonce: p.nonce });
    Object.assign(st, { token: s.token, id: d.id_token, account: s.account }); save();
    return p.back;
  }
  async function refresh() { if (!st.token) return; try { st.account = (await api("me")).account; save(); } catch (e) {} redraw(); }
  async function signOut() {
    const id = st.id;
    try { await api("signout", "POST", {}); } catch (e) {}
    Object.assign(st, { token: null, id: null, account: null, sheet: false }); save();
    /* Also out of the store's own sign-in, so that another person can sign in on this phone. */
    if (id) location.assign(AUTH + "/logout?" + new URLSearchParams({ id_token_hint: id, post_logout_redirect_uri: HERE })); else redraw();
  }
  async function unlock(key) {
    st.busy = true; st.error = ""; redraw();
    try { const d = await api("unlock", "POST", { game: key }); st.account = d.account; save(); if (d.result !== "ok" && d.result !== "owned") st.error = X.noCredits; }
    catch (e) { st.error = X.failed; }
    st.busy = false; st.sure = ""; redraw();
  }

  /* ---------- what is drawn ---------- */
  const shop = path => A.store + (path || A.shopPath || "");
  /* The small button on the first screen. */
  function button() {
    return st.account ? `<button class="wallet" data-act="a-open" aria-label="${esc(X.title + ": " + X.credits(st.account.credits))}"><span class="coin" aria-hidden="true"></span><b>${esc(st.account.credits)}</b><i class="wsep" aria-hidden="true"></i><small>${esc(X.profile)}</small></button>`
                      : `<button class="btn ghost small acc" data-act="a-in">${esc(st.busy ? X.signingIn : X.signIn)}</button>`;
  }
  /* In place of "start": what a player must do to open a locked game. */
  function gate(key, back) {
    const c = cost(key), a = st.account, buy = `<a class="btn ghost" href="${esc(shop(A.gamePath && key[0] === "s" ? A.gamePath.replace("{id}", key.slice(2)) : ""))}" target="_blank" rel="noopener">${esc(X.buyGame)}</a>`;
    const head = `<p class="flash">🔒 ${esc(X.locked)}</p>${st.error ? `<p class="flash">${esc(st.error)}</p>` : ""}`;
    if (!a) return `<section class="stack gate">${head}<p class="note">${esc(X.signInToPlay)}</p>
      <button class="btn" data-act="a-in" data-back="${esc(back || "")}">${esc(X.signIn)}</button>${buy}</section>`;
    if (a.credits >= c) return `<section class="stack gate">${head}
      <button class="btn" data-act="a-unlock" data-g="${esc(key)}" ${st.busy ? "disabled" : ""}>${esc(st.sure === key ? X.sure : X.unlockWith(c))}</button>
      <p class="note">${esc(X.youHave(a.credits))}</p></section>`;
    return `<section class="stack gate">${head}<p class="note">${esc(X.needMore(c, a.credits))}</p>
      <a class="btn" href="${esc(shop())}" target="_blank" rel="noopener">${esc(X.buyCredits)}</a>${buy}</section>`;
  }
  /* The account window. */
  function overlay() {
    if (!st.sheet || !st.account) return "";
    const a = st.account, C = X.cashback, k = a.cashback;
    const initial = (a.email || "?").trim()[0] || "?";
    /* Credits for shopping: how far the player is towards the next one. */
    let shopping = "";
    if (C && k && k.step > 0) {
      const into = k.spent % k.step, pct = Math.round(into / k.step * 100);
      shopping = `<section class="cbk">
        <p class="cbk-h"><span aria-hidden="true">🛍️</span><b>${esc(C.title)}</b></p>
        <p class="note">${esc(C.how(X.money(k.step)))}</p>
        <div class="cbk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${k.step}" aria-valuenow="${into}" aria-label="${esc(C.title)}"><i style="width:${pct}%"></i></div>
        <p class="cbk-row"><span>${esc(C.of(X.money(into), X.money(k.step)))}</span><b>${esc(C.left(X.money(k.step - into)))}</b></p>
        ${k.earned ? `<p class="cbk-got">${esc(C.earned(k.earned))}</p>` : ""}
      </section>`;
    }
    /* All games the player can open, the "all games" passes included, counted over the games on this site. */
    const keys = MEIVI.app && MEIVI.app.gameKeys ? MEIVI.app.gameKeys() : null;
    const open = keys ? keys.filter(owns).length : a.games.length;
    const owned = open ? [X.opened(open)] : [];
    return `<div class="sheet rsheet" data-act="a-close"><div role="dialog" aria-label="${esc(X.title)}">
      <div class="who-row"><span class="avatar" aria-hidden="true">${esc(initial.toUpperCase())}</span><span><b>${esc(X.title)}</b><small>${esc(a.email)}</small></span></div>
      <section class="wcard">
        <span class="wlabel">${esc(X.walletLabel)}</span>
        <div class="wnum"><span class="coin big" aria-hidden="true"></span><b>${esc(a.credits)}</b><span>${esc(X.creditsWord(a.credits))}</span></div>
        <p>${esc(X.how)}</p>
      </section>
      ${owned.length ? `<div class="owned">${owned.map(t => `<span>✓ ${esc(t)}</span>`).join("")}</div>` : ""}
      ${shopping}
      <a class="btn" href="${esc(shop())}" target="_blank" rel="noopener">${esc(X.buyCredits)}</a>
      <div class="row"><button class="btn ghost" data-act="a-out">${esc(X.signOut)}</button><button class="btn ghost" data-act="a-close">${esc(X.close)}</button></div>
    </div></div>`;
  }
  function click(act, b, target) {
    if (act === "a-in") { st.busy = true; signIn(b.dataset.back || "").catch(() => { st.busy = false; st.error = X.failed; redraw(); }); return true; }
    if (act === "a-open") { st.sheet = true; refresh(); return true; }
    if (act === "a-close") { if (b.classList.contains("sheet") && target !== b) return false; st.sheet = false; return true; }
    if (act === "a-out") { signOut(); return true; }
    if (act === "a-star" || act.startsWith("a-op")) return ratingClick(act, b, target);
    if (act === "a-unlock") { const key = b.dataset.g; if (st.sure !== key) { st.sure = key; return true; } unlock(key); return true; }
    return false;
  }
  /* Opening the app: coming back from the store's sign-in page, or simply asking the server what is new. */
  function boot() {
    let p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
    if (p.get("code") && p.get("state") && box(sessionStorage, "meivi.signin")) {
      st.busy = true;
      finish(p.get("code"), p.get("state")).then(back => { st.busy = false; if (back && MEIVI.app.open) MEIVI.app.open(back); else redraw(); })
        .catch(() => { st.busy = false; st.error = X.failed; redraw(); });
      try { history.replaceState(null, "", HERE); } catch (e) {}
    } else {
      if (p.get("error") || p.get("code")) { try { history.replaceState(null, "", HERE); } catch (e) {} }
      refresh();
    }
    loadScores();
  }
  /* ---------- how players rate the games ----------
     Above the name of a game: the average of the stars players gave it and, in small brackets, how many gave them.
     The server sends only the games with enough ratings (5), so a game with fewer shows nothing.
     Kept on the phone too, so the list shows it at once the next time. */
  st.scores = {};
  try { st.scores = JSON.parse(box(localStorage, "meivi.scores") || "{}") || {}; } catch (e) {}
  function loadScores() {
    api("scores").then(d => { st.scores = d.scores || {}; box(localStorage, "meivi.scores", JSON.stringify(st.scores)); if (MEIVI.app && MEIVI.app.repaint) MEIVI.app.repaint(); }).catch(() => {});
  }
  function score(game) {
    const s = st.scores[game], Y = X.rating;
    if (!s || !s.n) return "";
    return `<span class="gscore" role="img" aria-label="${esc(Y.scoreLabel(Y.avg(s.avg), s.n))}"><span aria-hidden="true">★</span> ${esc(Y.avg(s.avg))} <i>(${Number(s.n)})</i></span>`;
  }
  /* ---------- ratings: stars on every card and an opinion of the game ----------
     Every player sees five stars on every card and, after a game, five stars and one question about the game.
     A card is known by a short fingerprint of its text, so it is found again in any later game.
     Stars are kept on the phone at once and sent to the server when the player is signed in. */
  const stars = {}, texts = {}, touched = {}, opinions = {}, loaded = {};
  try { Object.assign(stars, JSON.parse(box(localStorage, "meivi.stars") || "{}")); } catch (e) {}
  const keepStars = () => box(localStorage, "meivi.stars", JSON.stringify(stars));
  const R = () => X.rating;
  const cardKey = text => { let x = 0x811c9dc5; for (let i = 0; i < text.length; i++) { x ^= text.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36); };
  const repaint = () => { if (MEIVI.app && MEIVI.app.repaint) MEIVI.app.repaint(); };
  async function loadRatings(game) {
    if (!st.token || loaded[game]) return;
    const asked = Date.now();
    loaded[game] = "busy";
    try {
      const d = await api("ratings?game=" + encodeURIComponent(game)), got = d.cards || {};
      /* A star tapped after this question left is newer than what the server just said. */
      Object.keys(touched).forEach(k => { const [g, c] = k.split("|"); if (g === game && touched[k].at >= asked) { if (touched[k].v) got[c] = touched[k].v; else delete got[c]; } });
      stars[game] = got; keepStars();
      if (d.game && !opinions[game]) opinions[game] = d.game;
      loaded[game] = "yes";
      repaint();
    } catch (e) { loaded[game] = ""; }
  }
  /* Five small stars in the top corner of a card. Tapping the chosen star again takes the rating away. */
  function cardStars(game, text) {
    if (!text) return "";
    const key = cardKey(String(text)), now = (stars[game] || {})[key] || 0;
    texts[game + "|" + key] = String(text);
    return `<div class="cstars" role="group" aria-label="${esc(R().card)}">${[1, 2, 3, 4, 5].map(n =>
      `<button data-act="a-star" data-g="${esc(game)}" data-c="${key}" data-v="${n}" aria-pressed="${now >= n}" aria-label="${n}">★</button>`).join("")}</div>`;
  }
  function setStars(game, key, v) {
    const was = (stars[game] || {})[key] || 0, next = was === v ? 0 : v;
    stars[game] = stars[game] || {};
    if (next) stars[game][key] = next; else delete stars[game][key];
    keepStars();
    if (!st.token) return;
    const id = game + "|" + key; touched[id] = { v: next, at: Date.now() };
    api("rate", "POST", { game, card: key, text: texts[id] || "", stars: next || null }).catch(() => { delete touched[id]; });
  }
  /* The opinion of a whole game, on its last screen: stars and one question. */
  const openOpinion = game => {
    const o = opinions[game] || {};
    st.op = { game, stars: o.stars || 0, text: o.opinion || "", busy: false, err: "" };
  };
  /* What is being typed is kept, so that a redraw of the page does not lose it. */
  if (typeof document !== "undefined") document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "opText" && st.op) st.op.text = t.value;
  });
  /* On the last screen: a button, and the small window it opens. */
  function gameRating(game) {
    if (!loaded[game]) loadRatings(game);
    const o = opinions[game], Y = R();
    return `<button class="btn ghost" data-act="a-opopen" data-g="${esc(game)}">${esc(o && (o.stars || o.opinion) ? Y.rated : Y.game)}</button>`;
  }
  function ratingSheet() {
    const o = st.op, Y = R();
    if (!o) return "";
    return `<div class="sheet rsheet" data-act="a-opclose"><div role="dialog" aria-label="${esc(Y.title)}">
      <h1 class="rsheet-h">${esc(Y.title)}</h1>
      <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-act="a-opstar" data-v="${n}" aria-pressed="${o.stars >= n}" aria-label="${n}">★</button>`).join("")}</div>
      <label class="rform"><b>${esc(Y.question)}</b><textarea id="opText" rows="4" maxlength="1500">${esc(o.text)}</textarea></label>
      ${o.err ? `<p class="flash">${esc(o.err)}</p>` : ""}
      <div class="row"><button class="btn ghost" data-act="a-opclose">${esc(X.close)}</button><button class="btn" data-act="a-opsend" ${o.busy ? "disabled" : ""}>${esc(o.busy ? Y.sending : Y.send)}</button></div>
    </div></div>`;
  }
  function ratingClick(act, b, target) {
    if (act === "a-star") { setStars(b.dataset.g, b.dataset.c, +b.dataset.v); return true; }
    if (act === "a-opopen") { openOpinion(b.dataset.g); return true; }
    const o = st.op;
    if (!o) return false;
    if (act === "a-opclose") { if ((b.classList.contains("sheet") && target !== b) || o.busy) return false; st.op = null; return true; }
    if (act === "a-opstar") { const v = +b.dataset.v; o.stars = o.stars === v ? 0 : v; o.err = ""; return true; }
    if (act === "a-opsend") {
      const el = document.getElementById("opText"); if (el) o.text = el.value;
      if (!o.stars && !o.text.trim()) { o.err = R().empty; return true; }
      const kept = { stars: o.stars, opinion: o.text };
      if (!st.token) { opinions[o.game] = kept; st.op = null; return true; }
      o.busy = true; o.err = "";
      api("opinion", "POST", { game: o.game, stars: o.stars || null, opinion: o.text }).then(() => { opinions[o.game] = kept; st.op = null; })
        .catch(() => { o.busy = false; o.err = X.failed; }).then(repaint);
      return true;
    }
    return false;
  }

  window.MACC = { button, gate, overlay, click, boot, locked, owns, state: st, loadRatings, cardStars, gameRating, ratingSheet, score };
})();

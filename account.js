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
    return st.account ? `<button class="btn ghost small acc" data-act="a-open"><span aria-hidden="true">👤</span> ${esc(X.credits(st.account.credits))}</button>`
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
    const a = st.account;
    return `<div class="sheet rsheet" data-act="a-close"><div role="dialog" aria-label="${esc(X.title)}">
      <h1 class="rsheet-h">${esc(X.title)}</h1>
      <p class="note">${esc(a.email)}</p>
      <div class="rbig c-hot"><b>${esc(a.credits)}</b><span>${esc(X.creditsWord(a.credits))}</span></div>
      <p class="how">${esc(X.how)}</p>
      ${a.passes.length ? `<p class="rp strong">${a.passes.map(p => esc(X.pass[p])).join(" · ")}</p>` : ""}
      ${a.games.length ? `<p class="note">${esc(X.opened(a.games.length))}</p>` : ""}
      <a class="btn" href="${esc(shop())}" target="_blank" rel="noopener">${esc(X.buyCredits)}</a>
      <div class="row"><button class="btn ghost" data-act="a-out">${esc(X.signOut)}</button><button class="btn ghost" data-act="a-close">${esc(X.close)}</button></div>
    </div></div>`;
  }
  function click(act, b, target) {
    if (act === "a-in") { st.busy = true; signIn(b.dataset.back || "").catch(() => { st.busy = false; st.error = X.failed; redraw(); }); return true; }
    if (act === "a-open") { st.sheet = true; refresh(); return true; }
    if (act === "a-close") { if (b.classList.contains("sheet") && target !== b) return false; st.sheet = false; return true; }
    if (act === "a-out") { signOut(); return true; }
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
  }
  window.MACC = { button, gate, overlay, click, boot, locked, owns, state: st };
})();

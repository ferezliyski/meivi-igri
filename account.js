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
    return st.account ? `<button class="wallet" data-act="a-open" aria-label="${esc(X.title + ": " + X.credits(st.account.credits))}"><span class="coin" aria-hidden="true"></span><b>${esc(st.account.credits)}</b><small>${esc(X.creditsWord(st.account.credits))}</small></button>`
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
    const owned = [...a.passes.map(p => X.pass[p]), ...(a.games.length ? [X.opened(a.games.length)] : [])];
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
    if (act === "a-rv") { setReview(b.dataset.g, b.dataset.c, b.dataset.v); return true; }
    if (act.startsWith("a-rv") || act.startsWith("a-fb")) return testerClick(act, b, target);
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
  /* ---------- testers: marking cards while playing ----------
     Only an account the server marks as "reviewer" sees three buttons on every card:
     ✕ replace this card, ✓ keep it, ⇄ keep the idea but rework it. Tapping ✓ again clears it.
     ⇄ and ✕ open a small window for a note (quick reasons and own words); tapping them again opens the note
     to change it, and the window can also take the mark away.
     A card is known by a short fingerprint of its text, so it is found again in any later game.
     After a game a tester can also write an opinion of the whole game (stars, liked, change, play again). */
  /* notes: what the server knows; myNotes: what was written on this phone since it opened (always the newest). */
  const reviews = {}, texts = {}, touched = {}, notes = {}, myNotes = {}, opinions = {}, loaded = {};
  try { Object.assign(reviews, JSON.parse(box(localStorage, "meivi.reviews") || "{}")); } catch (e) {}
  const keepReviews = () => box(localStorage, "meivi.reviews", JSON.stringify(reviews));
  const isReviewer = () => !!(st.account && st.account.reviewer);
  const R = () => X.review;
  const cardKey = text => { let x = 0x811c9dc5; for (let i = 0; i < text.length; i++) { x ^= text.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36); };
  async function loadReviews(game) {
    if (!isReviewer()) return;
    const asked = Date.now();
    loaded[game] = loaded[game] || "busy";
    try {
      const d = await api("reviews?game=" + encodeURIComponent(game)), got = d.reviews || {};
      /* A mark tapped after this question left is newer than what the server just said. */
      Object.keys(touched).forEach(k => { const [g, c] = k.split("|"); if (g === game && touched[k].at >= asked) { if (touched[k].v) got[c] = touched[k].v; else delete got[c]; } });
      reviews[game] = got; keepReviews();
      notes[game] = Object.assign({}, d.notes || {}, myNotes[game] || {});
      opinions[game] = d.feedback || opinions[game] || null;
      loaded[game] = "yes";
      if (MEIVI.app.repaint) MEIVI.app.repaint();
    } catch (e) { loaded[game] = ""; }
  }
  function reviewButtons(game, text) {
    if (!isReviewer() || !text) return "";
    const key = cardKey(String(text)), now = (reviews[game] || {})[key] || "";
    texts[game + "|" + key] = String(text);
    const b = (v, mark, label) => `<button class="rvb rv-${v}" data-act="a-rv" data-g="${esc(game)}" data-c="${key}" data-v="${v}" aria-pressed="${now === v}" aria-label="${esc(label)}">${mark}</button>`;
    return `<div class="rv" role="group" aria-label="${esc(X.review.title)}">${b("bad", "✕", X.review.bad)}${b("good", "✓", X.review.good)}${b("fix", "⇄", X.review.fix)}</div>`;
  }
  const noteOf = (game, key) => (notes[game] || {})[key] || { note: "", tags: [] };
  const putNote = (game, key, n) => {
    [notes, myNotes].forEach(o => { o[game] = o[game] || {}; if (n) o[game][key] = n; else delete o[game][key]; });
  };
  function setReview(game, key, v, extra) {
    const was = (reviews[game] || {})[key] || "";
    /* ⇄ or ✕ tapped again: open its note instead of taking the mark away. */
    if (was === v && v !== "good" && !extra) { openNote(game, key, v); return; }
    const next = extra && extra.clear ? null : (was === v && !extra ? null : v);
    reviews[game] = reviews[game] || {};
    if (next) reviews[game][key] = next; else delete reviews[game][key];
    keepReviews();
    const id = game + "|" + key; touched[id] = { v: next, at: Date.now() };
    const body = { game, card: key, text: texts[id] || "", verdict: next };
    const oldNote = noteOf(game, key);
    if (extra && extra.note) { body.note = extra.note.note; body.tags = extra.note.tags; putNote(game, key, (extra.note.note || extra.note.tags.length) ? extra.note : null); }
    else if (next === "good" || !next) putNote(game, key, null);
    api("review", "POST", body).catch(() => {
      delete touched[id]; if (was) reviews[game][key] = was; else delete reviews[game][key]; keepReviews();
      putNote(game, key, (oldNote.note || oldNote.tags.length) ? oldNote : null);
      st.rvError = X.failed; if (MEIVI.app.repaint) MEIVI.app.repaint();
    });
    if ((next === "fix" || next === "bad") && !extra) openNote(game, key, next);
  }
  function openNote(game, key, v) {
    const n = noteOf(game, key);
    st.rv = { game, key, v, note: n.note || "", tags: (n.tags || []).slice(), text: texts[game + "|" + key] || "" };
  }
  /* The tester's own words are kept while typing, so that a redraw of the page does not lose them. */
  if (typeof document !== "undefined") document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "rvNote" && st.rv) st.rv.note = t.value;
    if (t.dataset && t.dataset.fb && st.fb) st.fb[t.dataset.fb] = t.value;
  });
  function testerClick(act, b, target) {
    const backdrop = b.classList.contains("sheet");
    if (backdrop && target !== b) return false;
    const r = st.rv, f = st.fb;
    st.rvError = "";
    if (act === "a-rvtag" && r) { const t = b.dataset.t, i = r.tags.indexOf(t); if (i >= 0) r.tags.splice(i, 1); else r.tags.push(t); return true; }
    if (act === "a-rvsave" && r) { const el = document.getElementById("rvNote"); if (el) r.note = el.value; st.rv = null;
      setReview(r.game, r.key, r.v, { note: { note: r.note.trim().slice(0, 600), tags: r.tags } }); return true; }
    if (act === "a-rvdel" && r) { st.rv = null; setReview(r.game, r.key, r.v, { clear: true }); return true; }
    if (act === "a-rvskip") { st.rv = null; return true; }
    if (act === "a-fbopen") { const g = b.dataset.g, o = opinions[g] || {};
      st.fb = { game: g, stars: o.stars || 0, liked: o.liked || "", change: o.change || "", again: o.again || "", players: o.players || 0, minutes: o.minutes || 0, err: "", busy: false }; return true; }
    if (act === "a-fbclose") { if (f && f.busy) return false; st.fb = null; return true; }
    if (!f) return false;
    if (act === "a-fbset") { const k = b.dataset.k, v = k === "again" ? b.dataset.v : +b.dataset.v; f[k] = f[k] === v ? (k === "again" ? "" : 0) : v; f.err = ""; return true; }
    if (act === "a-fbsend") {
      document.querySelectorAll("[data-fb]").forEach(el => { f[el.dataset.fb] = el.value; });
      if (!f.stars && !f.liked.trim() && !f.change.trim() && !f.again) { f.err = R().fbEmpty; return true; }
      f.busy = true; f.err = "";
      const body = { game: f.game, stars: f.stars || null, liked: f.liked, change: f.change, again: f.again || null, players: f.players || null, minutes: f.minutes || null };
      api("feedback", "POST", body).then(() => { opinions[f.game] = body; st.fb = null; st.fbThanks = f.game; })
        .catch(() => { f.busy = false; f.err = X.failed; }).then(() => { if (MEIVI.app.repaint) MEIVI.app.repaint(); });
      return true;
    }
    return false;
  }
  /* Windows that open over a game or its last screen. */
  function testerSheets() {
    const r = st.rv, f = st.fb, Y = R();
    if (r) {
      const pick = r.v === "fix" ? Y.tagsFix : Y.tagsBad;
      return `<div class="sheet rsheet" data-act="a-rvskip"><div role="dialog" aria-label="${esc(Y.title)}">
        <p class="rvhead"><span class="rvb rv-${r.v}" aria-hidden="true" aria-pressed="true">${r.v === "fix" ? "⇄" : "✕"}</span><b>${esc(r.v === "fix" ? Y.noteFix : Y.noteBad)}</b></p>
        ${r.text ? `<p class="rvcard">${esc(r.text.split("||")[0])}</p>` : ""}
        <div class="rvtags">${pick.map(t => `<button class="rvtag" data-act="a-rvtag" data-t="${t}" aria-pressed="${r.tags.includes(t)}">${esc(Y.tags[t])}</button>`).join("")}</div>
        <div class="rform"><textarea id="rvNote" rows="3" maxlength="600" placeholder="${esc(Y.placeholder)}">${esc(r.note)}</textarea></div>
        <div class="row"><button class="btn ghost" data-act="a-rvskip">${esc(Y.skip)}</button><button class="btn" data-act="a-rvsave">${esc(Y.save)}</button></div>
        <button class="btn ghost small rvdel" data-act="a-rvdel">${esc(Y.remove)}</button>
      </div></div>`;
    }
    if (f) {
      const seg = (k, list) => `<div class="rvtags">${list.map(([v, t]) => `<button class="rvtag" data-act="a-fbset" data-k="${k}" data-v="${v}" aria-pressed="${f[k] === v}">${esc(t)}</button>`).join("")}</div>`;
      return `<div class="sheet rsheet" data-act="a-fbclose"><div role="dialog" aria-label="${esc(Y.fbTitle)}">
        <h1 class="rsheet-h">${esc(Y.fbTitle)}</h1>
        <div class="fbq"><b>${esc(Y.stars)}</b><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-act="a-fbset" data-k="stars" data-v="${n}" aria-pressed="${f.stars >= n}" aria-label="${n}">★</button>`).join("")}</div></div>
        <label class="fbq rform"><b>${esc(Y.liked)}</b><textarea data-fb="liked" rows="3" maxlength="1500">${esc(f.liked)}</textarea></label>
        <label class="fbq rform"><b>${esc(Y.change)}</b><textarea data-fb="change" rows="3" maxlength="1500">${esc(f.change)}</textarea></label>
        <div class="fbq"><b>${esc(Y.again)}</b>${seg("again", Object.entries(Y.againOpts))}</div>
        <div class="fbq"><b>${esc(Y.players)}</b>${seg("players", Y.playerOpts)}</div>
        <div class="fbq"><b>${esc(Y.minutes)}</b>${seg("minutes", Y.minuteOpts)}</div>
        ${f.err ? `<p class="flash">${esc(f.err)}</p>` : ""}
        <div class="row rfoot"><button class="btn ghost" data-act="a-fbclose">${esc(X.close)}</button><button class="btn" data-act="a-fbsend" ${f.busy ? "disabled" : ""}>${esc(f.busy ? Y.sending : Y.send)}</button></div>
      </div></div>`;
    }
    return "";
  }
  /* For a tester on a game's own screens: how many of its cards are marked, and the opinion of the game. */
  function testerBox(game, cardTexts, wide) {
    if (!isReviewer()) return "";
    if (!loaded[game]) loadReviews(game);
    const mine = reviews[game] || {}, keys = new Set(cardTexts.map(t => cardKey(String(t))));
    const n = Object.keys(mine).filter(k => keys.has(k)).length, Y = R();
    const thanks = st.fbThanks === game ? `<p class="note">${esc(Y.fbThanks)}</p>` : "";
    return `<section class="tbox${wide ? " wide" : ""}"><p class="tlabel">${esc(Y.tester)}</p><p>${esc(Y.counted(n, keys.size))}</p>
      <button class="btn ${wide ? "" : "ghost small"}" data-act="a-fbopen" data-g="${esc(game)}">${esc(opinions[game] ? Y.opinionEdit : Y.opinion)}</button>${thanks}
      ${st.rvError ? `<p class="flash">${esc(st.rvError)}</p>` : ""}</section>`;
  }

  window.MACC = { button, gate, overlay, click, boot, locked, owns, state: st, isReviewer, loadReviews, reviewButtons, testerSheets, testerBox };
})();

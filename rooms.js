/* =====================================================================
   Meivi games: rooms, for the games played on several phones.

   One phone is the host. It keeps the whole game, decides what every player sees and sends it to
   the others; the other phones only show their screen and send back what the player taps.
   So the rules of a game run in one place (rooms-games.js) and a guest's phone needs no game code.

   What travels between the phones (through MEIVI.transport, see the end of this file):
     guest -> host   "hello" {id, name}       I am here (also after a lost connection)
                     "act"   {id, a}          the player did something: a = {k: "ans", v}
                     "bye"   {id}             I left
     host -> all     "snap"  {seq, code, game, phase, host, views: {playerId: view}}
                     "closed"                 the host closed the room

   A view is plain data, never HTML:
     { top: {icon, title, color}, sub, bar, blocks: [...], input, note, host: [...], foot: [...] }
     bar     how far the game has come, in percent (a line under the round), when the game counts rounds
     On the last screen also: poster (the result as one card, see rooms-games.js) and rest (blocks under the card).
     blocks  {k: "h" | "p" | "card" | "rows" | "chips" | "code" | "wait" | "big" | "letter" | "pick", ...}
             pick: {options: [{v, t}], done, cmd}: a row of buttons; with cmd it sends a command of the host (the number of rounds)
     input   {k: "choice", options: [{v, t, sub, dis, tag}], done, pills, cols}
             {k: "text", max, ph, sent} | {k: "btn", t, v}
     host    buttons only the host has: {t, cmd, ghost, dis, sure}

   A game (MEIVI.mgame(id, {...})) gives: min, max, setup(c), view(c, g, playerId), ans(c, g, playerId, value),
   cmd(c, g, name), over(g), final(c, g) and, if it uses a timer, wake(c, g). Its state g must be plain data.
   A game may also give rounds: [15, 30, 50] and pool(c) (how many questions it has): the host then chooses the number
   of rounds before the game, among those the questions can fill, and the game reads it as c.opts.rounds.
   No text of any language is in this file: words come from T.rooms and from lang/<lang>/multi/<id>.js.
   ===================================================================== */
(function () {
  const CFG = MEIVI.config, T = MEIVI.ui, X = T.rooms;
  const DEFS = {};
  MEIVI.mgame = (id, def) => { DEFS[id] = def; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const info = id => (MEIVI.catalog.multi || []).find(g => g.id === id) || null;
  const gameName = id => ((MEIVI.multi.games[id] || {}).name) || id;
  /* A game can be played when it is marked ready in the catalogue and both its rules and its text are loaded. */
  MEIVI.mready = id => { const i = info(id); return !!(i && i.ready && DEFS[id] && MEIVI.mtexts[id]); };

  /* ---------- one room, as one phone sees it ---------- */
  function createRoom(env) {
    const st = { mode: null, code: null, me: null, game: null, players: [], late: [], phase: "lobby", g: null, seq: 0, opts: {},
                 snap: null, online: false, hostOn: true, closed: false, link: "" };
    let line = null, timers = [], helloAt = 0;
    const rnd = n => Math.floor(env.random() * n);
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newId = () => "p" + rnd(1e9).toString(36) + rnd(1e9).toString(36);
    const def = () => DEFS[st.game];
    const ctx = () => ({
      ids: st.players.map(p => p.id),
      name: id => { const p = st.players.find(p => p.id === id); return p ? p.name : "?"; },
      tx: MEIVI.mtexts[st.game], ui: X, rnd, shuffle, pick: a => a[rnd(a.length)], now: env.now, opts: st.opts,
      /* Asks for a command to arrive after some time (the bomb's fuse). Only the host keeps time. */
      later: (ms, cmd) => { timers.push(env.timer(() => { if (st.mode === "host" && st.phase === "play") { def().cmd(ctx(), st.g, cmd); settle(); } }, ms)); }
    });
    const stopTimers = () => { timers.forEach(env.clear); timers = []; };

    function open() { line = env.transport(st.code, st.me.id, { message: onMessage, peers: onPeers, status: onStatus }); }
    function save() {
      if (!st.mode) return env.store.set(null);
      const s = { mode: st.mode, code: st.code, me: st.me, game: st.game, ts: env.now() };
      if (st.mode === "host") Object.assign(s, { players: st.players, late: st.late, phase: st.phase, g: st.g, seq: st.seq, opts: st.opts });
      env.store.set(s);
    }

    /* ----- host ----- */
    function host(game, name) {
      Object.assign(st, { mode: "host", game, code: String(10000 + rnd(90000)), me: { id: newId(), name }, late: [], phase: "lobby", g: null, seq: 0, snap: null, closed: false, online: false, wasOn: false, hostOn: true });
      st.players = [{ id: st.me.id, name, on: true }];
      st.opts = {}; const r = roundChoices(); if (r.length) st.opts.rounds = r[0];
      st.link = env.link(st.code);
      open(); publish();
    }
    /* The numbers of rounds the host may choose: those the questions of the game can fill (at least the smallest). */
    function roundChoices() {
      const d = def(); if (!d || !d.rounds) return [];
      const n = d.pool ? d.pool(ctx()) : Infinity, fit = d.rounds.filter(r => r <= n);
      return fit.length ? fit : d.rounds.slice(0, 1);
    }
    function viewFor(pid) {
      const d = def(), inf = info(st.game), isHost = pid === st.me.id;
      const top = { icon: inf.icon, title: gameName(st.game), color: inf.color };
      if (st.late.some(p => p.id === pid)) return { top, sub: X.room(st.code), blocks: [{ k: "p", text: X.lateJoin }], foot: [{ t: X.leave, local: "leave" }] };
      if (st.phase === "lobby") {
        const n = st.players.length, ok = n >= d.min && n <= d.max, rc = roundChoices();
        /* the number of rounds: the host chooses it, the others see it */
        const rounds = !rc.length ? [] : isHost && rc.length > 1
          ? [{ k: "h", text: X.roundsAsk }, { k: "pick", cmd: true, options: rc.map(r => ({ v: "rounds:" + r, t: String(r) })), done: "rounds:" + st.opts.rounds }]
          : [{ k: "p", text: X.roundsAre(st.opts.rounds) }];
        return { top, sub: X.room(st.code), blocks: [
            { k: "code", code: st.code, link: st.link },
            { k: "chips", title: X.inRoom(n), items: st.players.map(p => ({ t: p.name, sub: p.id === st.me.id ? X.hostTag : "", dim: !p.on })) }
          ].concat(rounds, [{ k: "p", text: ok ? (isHost ? X.canStart : X.waitHost) : X.needPlayers(d.min, d.max, n) }]),
          host: isHost ? [{ t: X.start, cmd: "start", dis: !ok }, { t: X.closeRoom, cmd: "close", ghost: true, sure: true }] : null,
          foot: isHost ? null : [{ t: X.leave, local: "leave" }] };
      }
      if (st.phase === "end") {
        const f = st.g ? d.final(ctx(), st.g) : { blocks: [] };
        return { top, sub: X.gameOver, blocks: f.blocks, poster: f.poster, rest: f.rest, party: true,
          host: isHost ? [{ t: X.again, cmd: "again" }, { t: X.closeRoom, cmd: "close", ghost: true, sure: true }] : null,
          foot: isHost ? null : [{ t: X.leave, local: "leave" }] };
      }
      const v = d.view(ctx(), st.g, pid);
      return { top, sub: v.sub, blocks: v.blocks, input: v.input, note: v.note, key: v.key,
        bar: st.g.rounds ? Math.round(Math.min(1, st.g.round / st.g.rounds) * 100) : null,
        host: isHost ? (v.host || []).concat([{ t: X.endGame, cmd: "stop", ghost: true, sure: true }]) : null };
    }
    function publish() {
      if (st.mode !== "host") return;
      st.seq++;
      const views = {};
      st.players.concat(st.late).forEach(p => { views[p.id] = viewFor(p.id); });
      st.snap = { seq: st.seq, code: st.code, game: st.game, phase: st.phase, host: st.me.id, views };
      line.send("snap", st.snap); save(); env.changed();
    }
    /* After anything changed in a game: is it over? Then tell everyone. */
    function settle() { if (st.phase === "play" && def().over(st.g)) { st.phase = "end"; stopTimers(); } publish(); }
    function command(c) {
      if (st.mode !== "host") return;
      const d = def();
      if (c === "start" && st.phase === "lobby") {
        const n = st.players.length; if (n < d.min || n > d.max) return;
        st.g = d.setup(ctx()); st.phase = "play"; settle();
      } else if (/^rounds:\d+$/.test(c) && st.phase === "lobby") {
        const r = +c.slice(7); if (roundChoices().includes(r)) { st.opts.rounds = r; publish(); }
      } else if (c === "again" && st.phase === "end") {
        while (st.late.length && st.players.length < d.max) st.players.push(st.late.shift());
        st.phase = "lobby"; st.g = null; publish();
      } else if (c === "stop" && st.phase === "play") { st.phase = "end"; stopTimers(); publish(); }
      else if (c === "close") { line.send("closed", {}); leave(); }
      else if (st.phase === "play") { d.cmd(ctx(), st.g, c); settle(); }
    }
    function act(id, a) {
      if (st.mode !== "host" || st.phase !== "play" || !a || a.k !== "ans" || !st.players.some(p => p.id === id)) return;
      def().ans(ctx(), st.g, id, a.v); settle();
    }

    /* ----- guest ----- */
    function join(code, name, id) {
      Object.assign(st, { mode: "guest", code: String(code), me: { id: id || newId(), name }, snap: null, closed: false, game: null, online: false, wasOn: false, hostOn: true });
      open(); save(); env.changed();
    }
    function hello() { helloAt = env.now(); line.send("hello", { id: st.me.id, name: st.me.name }); }

    /* ----- the line ----- */
    function onStatus(s) {
      st.online = s === "open"; if (st.online) st.wasOn = true;
      if (st.online) { if (st.mode === "guest") hello(); else if (st.mode === "host") publish(); }
      env.changed();
    }
    function onPeers(ids) {
      if (st.mode === "host") {
        let changed = false;
        st.players.forEach(p => { const on = p.id === st.me.id || ids.includes(p.id); if (p.on !== on) { p.on = on; changed = true; } });
        if (changed) publish();
      } else if (st.mode === "guest") { st.hostOn = !st.snap || ids.includes(st.snap.host); env.changed(); }
    }
    function onMessage(e, d) {
      if (st.mode === "host") {
        if (e === "hello" && d && d.id) {
          const name = String(d.name || "").slice(0, 18) || "?";
          const p = st.players.find(p => p.id === d.id) || st.late.find(p => p.id === d.id);
          if (p) { p.name = name; p.on = true; }
          else if (st.phase === "lobby" && st.players.length < def().max) st.players.push({ id: d.id, name, on: true });
          else st.late.push({ id: d.id, name, on: true });
          publish();
        } else if (e === "act" && d) act(d.id, d.a);
        else if (e === "bye" && d) {
          if (st.phase === "lobby") st.players = st.players.filter(p => p.id !== d.id || p.id === st.me.id);
          else { const p = st.players.find(p => p.id === d.id); if (p) p.on = false; }
          st.late = st.late.filter(p => p.id !== d.id);
          publish();
        }
      } else if (st.mode === "guest") {
        if (e === "snap" && d && d.views) {
          st.snap = d; st.game = d.game; st.hostOn = true;
          /* The host does not know me (it restarted, or I came back): say hello again, but not in a loop. */
          if (!d.views[st.me.id] && env.now() - helloAt > 1500) hello();
          env.changed();
        } else if (e === "closed") { st.closed = true; env.store.set(null); env.changed(); }
      }
    }

    /* ----- what the player on this phone does ----- */
    function answer(v) {
      if (st.mode === "host") act(st.me.id, { k: "ans", v });
      else if (st.mode === "guest") line.send("act", { id: st.me.id, a: { k: "ans", v } });
    }
    function leave() {
      if (st.mode === "guest" && line) line.send("bye", { id: st.me.id });
      stopTimers(); if (line) line.close(); line = null;
      st.mode = null; st.snap = null; st.g = null; save(); env.changed();
    }
    /* Coming back after the page was closed or reloaded. */
    function resume(s) {
      if (s.mode === "host") {
        Object.assign(st, { mode: "host", code: s.code, me: s.me, game: s.game, players: s.players || [], late: s.late || [], phase: s.phase || "lobby", g: s.g || null, seq: s.seq || 0, opts: s.opts || {}, closed: false });
        st.link = env.link(st.code);
        open();
        if (st.phase === "play" && def().wake) def().wake(ctx(), st.g);
        publish();
      } else join(s.code, s.me.name, s.me.id);
    }
    const myView = () => (st.snap && st.me && st.snap.views[st.me.id]) || null;

    return { st, host, join, resume, leave, command, answer, myView };
  }
  MEIVI.createRoom = createRoom;

  /* ---------- drawing a view ---------- */
  const qrCache = {};
  /* A short text is written larger on its card: the same rule as on the cards of the one-phone games (app.js). */
  const longest = s => Math.max(0, ...String(s).split(/\s+/).map(w => w.length));
  const qSize = s => { const n = String(s).length, w = longest(s); return n <= 42 && w <= 11 ? " xl" : n <= 80 && w <= 13 ? " lg" : ""; };
  /* How players rate a game: "★ 4,8 (23)" above its name, once enough people have rated it (account.js). */
  const score = id => window.MACC && MACC.score ? MACC.score("m:" + id) : "";
  function block(b, color) {
    if (b.k === "h") return `<h2 class="rh">${esc(b.text)}</h2>`;
    if (b.k === "p") return `<p class="rp${b.strong ? " strong" : ""}">${esc(b.text)}</p>`;
    if (b.k === "card") return `<div class="deck still rdeck"><article class="card rcard c-${b.color || color}${b.secret ? " secret" : ""}"><span class="tag">${esc(b.tag)}</span><p class="q${qSize(b.text)}">${esc(b.text)}</p>${b.sub ? `<p class="rule">${esc(b.sub)}</p>` : ""}</article></div>`;
    if (b.k === "pick") return `<div class="seg">${b.options.map(o => `<button data-act="${b.cmd ? "r-cmd" : "r-ans"}" data-c="${esc(o.v)}" data-v="${esc(o.v)}" aria-pressed="${String(b.done) === String(o.v)}">${esc(o.t)}</button>`).join("")}</div>`;
    if (b.k === "letter") return `<article class="letter"><span>${esc(b.from)}</span><p>${esc(b.text)}</p></article>`;
    if (b.k === "big") return `<div class="rbig c-${color}"><b>${esc(b.text)}</b>${b.sub ? `<span>${esc(b.sub)}</span>` : ""}</div>`;
    if (b.k === "wait") return b.names.length ? `<p class="note rwait">${esc(X.waiting(b.names.join(", ")))}</p>` : "";
    if (b.k === "rows") return `${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ""}<table class="rrows"><tbody>${b.rows.map(r => `<tr class="${r.hot ? "hot" : ""}${r.dim ? " dim" : ""}"><td>${esc(r.l)}</td><td>${esc(r.r)}</td></tr>`).join("")}</tbody></table>`;
    if (b.k === "chips") return `${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ""}<div class="chips">${b.items.map(i => `<span class="chip rchip${i.on ? " on" : ""}${i.dim ? " dim" : ""}">${esc(i.t)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>`).join("")}</div>`;
    if (b.k === "code") return `<section class="rcode"><span>${esc(X.roomCode)}</span><b>${esc(b.code)}</b><div class="qr" data-qr="${esc(b.link)}">${qrCache[b.link] || ""}</div><small>${esc(X.scan(CFG.playAt || location.host))}</small></section>`;
    return "";
  }
  /* The result of a game as one card in the colour of the game: what happened, then who stands where.
     The same data makes the picture to share (story.js), so the card shows exactly what will be shared. */
  const wideRank = r => r.list.some(p => p.v.some(v => String(v).length > 3));
  function poster(P, top) {
    const h = P.hero || {}, r = P.rank;
    let hero;
    if (h.kind === "ring") hero = `<div class="ring" style="--p:${Math.max(0, Math.min(100, +h.p || 0))}"><b${String(h.big).length > 3 ? ` class="sm"` : ""}>${esc(h.big)}</b><span${String(h.word).length > 12 ? ` class="sm"` : ""}>${esc(h.word)}</span></div>
        <p class="ptitle${/\S{15,}/.test(h.title) ? " long" : ""}">${esc(h.title)}</p>
        <p class="pnames">${esc(h.names)}</p>`;
    else if (h.kind === "name") hero = `<p class="plabel">${esc(h.label)}</p><p class="pname${String(h.name).length > 12 ? " long" : ""}">${esc(h.name)}</p>`;
    else hero = `<p class="pname long">${esc(h.title)}</p>`;
    const rank = r ? `<div class="prank${wideRank(r) ? " wide" : ""}" style="--c:${r.cols.length}">
        <div class="pr ph"><span>${esc(r.head)}</span>${r.cols.map(t => `<span>${esc(t)}</span>`).join("")}</div>
        ${r.list.map((p, i) => `<div class="pr"><span>${r.plain ? "" : `<i>${i + 1}</i>`}${esc(p.p)}</span>${p.v.map(v => `<span>${esc(v)}</span>`).join("")}</div>`).join("")}
      </div>` : "";
    return `<section class="poster c-${top.color}">
        <div class="phead"><span class="plogo"><img class="logo" src="logo-ink.png" alt="Meivi"></span><span>${esc(T.brand)}</span></div>
        <p class="pgame"><span aria-hidden="true">${top.icon}</span>${esc(top.title)}</p>
        <div class="phero">${hero}</div>
        ${rank}
        <p class="pfoot">${T.playToo(`<b>${esc(CFG.site)}</b>`)}</p>
      </section>`;
  }
  /* The card as a picture for a story. It is made as soon as the last screen shows, so that "share" can open the phone's menu at once. */
  const story = { key: "", file: null, url: "", sheet: false, wanted: false };
  function prepareStory(V) {
    if (!MEIVI.story || !V || !V.poster) return;
    const P = V.poster, key = room.st.code + "|" + JSON.stringify(P), game = room.st.game;
    if (story.key === key) return;
    Object.assign(story, { key, file: null, url: "", sheet: false, wanted: false });
    MEIVI.story.make({ color: V.top.color, icon: V.top.icon, game: V.top.title, brand: T.brand, foot: T.playToo(location.host), hero: P.hero, rows: [],
        rank: P.rank ? Object.assign({}, P.rank, { colW: wideRank(P.rank) ? 300 : 0 }) : null })
      .then(blob => {
        if (!blob || story.key !== key) return;
        story.file = new File([blob], "meivi-" + game + ".png", { type: "image/png" }); story.url = URL.createObjectURL(blob);
        if (story.wanted && MEIVI.app) MEIVI.app.refresh();
      }).catch(() => {});
  }
  function shareStory() {
    if (!story.file) { story.wanted = true; return; }
    story.wanted = false;
    try {
      if (navigator.canShare && navigator.canShare({ files: [story.file] })) { navigator.share({ files: [story.file], text: T.shareText(gameName(room.st.game), location.origin) }).catch(() => {}); return; }
    } catch (e) {}
    story.sheet = true;   /* no sharing of pictures on this phone: show it, to be kept by hand */
  }
  function input(i, draft) {
    if (!i) return "";
    if (i.k === "choice") {
      const cls = i.pills ? "pick" : "opts" + (i.cols === 2 ? " two" : "");
      return `<div class="${cls}">${i.options.map(o => `<button class="${i.pills ? "" : "opt"}" data-act="r-ans" data-v="${esc(o.v)}" aria-pressed="${String(i.done) === String(o.v)}" ${o.dis ? "disabled" : ""}>${i.pills ? esc(o.t) : `<span>${esc(o.t)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}${o.tag ? `<i>${esc(o.tag)}</i>` : ""}`}</button>`).join("")}</div>`;
    }
    if (i.k === "text") return i.sent
      ? `<article class="letter mine"><span>${esc(X.sent)}</span><p>${esc(i.sent)}</p></article>`
      : `<form class="rform" id="rForm"><textarea id="rText" maxlength="${i.max || 240}" rows="4" placeholder="${esc(i.ph || "")}">${esc(draft || "")}</textarea><button class="btn" type="submit">${esc(X.send)}</button></form>`;
    if (i.k === "btn") return `<button class="btn rgo" data-act="r-ans" data-v="${esc(i.v)}">${esc(i.t)}</button>`;
    return "";
  }

  /* ---------- the room on this phone: screens, taps, the connection ---------- */
  const ui = { sheet: null, name: "", code: "", err: "", sure: "", draft: "", draftKey: "", rules: false, lastHtml: "" };
  /* Trying things out between tabs of one browser (?local=1): each tab must remember its own room. */
  const wantLocal = (() => { try { return new URLSearchParams(location.search).has("local"); } catch (e) { return false; } })();
  const box = () => wantLocal ? sessionStorage : localStorage;
  const store = {
    get() { try { return JSON.parse(box().getItem("meivi.room") || "null"); } catch (e) { return null; } },
    set(v) { try { if (v) box().setItem("meivi.room", JSON.stringify(v)); else box().removeItem("meivi.room"); } catch (e) {} }
  };
  const hasServer = () => !!(CFG.rooms && CFG.rooms.url && CFG.rooms.key) || MEIVI.transport.local;
  const room = createRoom({
    transport: (code, id, on) => MEIVI.transport.open(code, id, on),
    store, random: Math.random, now: () => Date.now(),
    timer: (fn, ms) => setTimeout(fn, ms), clear: h => clearTimeout(h),
    link: code => location.origin + location.pathname + "?room=" + code + (wantLocal ? "&local=1" : ""),
    changed: () => { if (MEIVI.app) MEIVI.app.refresh(); }
  });
  const lastName = () => { try { return localStorage.getItem("meivi.room.name") || ""; } catch (e) { return ""; } };
  const keepName = n => { try { localStorage.setItem("meivi.room.name", n); } catch (e) {} };

  function rulesHtml(id) {
    const inf = info(id), tx = MEIVI.mtexts[id], d = DEFS[id];
    return `<header class="stack c-${inf.color} ghead">
        <span class="ico lg" aria-hidden="true">${inf.icon}</span>
        ${score(id)}<h1${longest(gameName(id)) >= 15 ? ` class="long"` : ""}>${esc(gameName(id))}</h1>
        <p class="note">${esc(T.players(d.min, d.max))} · ${esc(tx.time)}${inf.adult ? ` · <i class="age">18+</i>` : ""}</p>
      </header>
      <p class="how">${esc(tx.about)}</p>
      <ol class="rrules">${tx.rules.map(r => `<li>${esc(r)}</li>`).join("")}</ol>`;
  }
  /* Windows over the page of the games: the rules of a game, the name, the code. */
  function overlay() {
    const s = ui.sheet; if (!s) return "";
    let body = "";
    if (s.k === "rules") {
      const inf = info(s.game);
      body = `${rulesHtml(s.game)}
        ${hasServer() ? "" : `<p class="flash">${esc(X.noServer)}</p>`}
        <div class="stack rfoot">${window.MACC && MACC.locked("m:" + s.game) ? MACC.gate("m:" + s.game, "m:" + s.game) : `<button class="btn" data-act="r-sheet" data-c="name" ${hasServer() ? "" : "disabled"}>${esc(inf.adult ? X.createAdult : X.create)}</button>`}
        <div class="row"><button class="btn ghost" data-act="r-sheet" data-c="join" ${hasServer() ? "" : "disabled"}>${esc(X.joinCode)}</button><button class="btn ghost" data-act="r-sheet" data-c="close">${esc(X.close)}</button></div></div>`;
    } else if (s.k === "name") {
      body = `<h1 class="rsheet-h">${esc(gameName(s.game))}</h1>
        <form class="stack" id="rName"><label class="rlabel">${esc(X.yourName)}<input id="rNameIn" maxlength="18" autocomplete="off" value="${esc(ui.name)}" placeholder="${esc(X.namePh)}"></label>
        ${ui.err ? `<p class="flash">${esc(ui.err)}</p>` : ""}
        <button class="btn" type="submit">${esc(X.make)}</button></form>
        <button class="btn ghost" data-act="r-sheet" data-c="close">${esc(X.cancel)}</button>`;
    } else if (s.k === "join") {
      body = `<h1 class="rsheet-h">${esc(X.joinRoom)}</h1>
        <form class="stack" id="rJoin"><label class="rlabel">${esc(X.roomCode)}<input id="rCodeIn" inputmode="numeric" maxlength="5" autocomplete="off" value="${esc(ui.code)}" placeholder="${esc(X.codePh)}"></label>
        <label class="rlabel">${esc(X.yourName)}<input id="rNameIn" maxlength="18" autocomplete="off" value="${esc(ui.name)}" placeholder="${esc(X.namePh)}"></label>
        ${ui.err ? `<p class="flash">${esc(ui.err)}</p>` : ""}
        ${hasServer() ? "" : `<p class="flash">${esc(X.noServer)}</p>`}
        <button class="btn" type="submit" ${hasServer() ? "" : "disabled"}>${esc(X.enter)}</button></form>
        <button class="btn ghost" data-act="r-sheet" data-c="close">${esc(X.cancel)}</button>`;
    } else if (s.k === "resume") {
      body = `<h1 class="rsheet-h">${esc(X.resume(s.saved.code))}</h1>
        <button class="btn" data-act="r-sheet" data-c="resume">${esc(X.resumeYes)}</button>
        <button class="btn ghost" data-act="r-sheet" data-c="forget">${esc(X.resumeNo)}</button>`;
    }
    return `<div class="sheet rsheet" data-act="r-sheet" data-c="close"><div role="dialog">${body}</div></div>`;
  }
  function view() {
    const st = room.st, V = room.myView();
    if (st.closed) return `<section class="cover"><p class="note">${esc(X.closed)}</p><button class="btn" data-act="r-local" data-c="leave">${esc(X.backToGames)}</button></section>`;
    if (!V) return `<section class="cover"><b class="rwaiting">${esc(X.room(st.code))}</b><p class="note">${esc(st.online ? X.noRoom : X.connecting)}</p><button class="btn ghost" data-act="r-local" data-c="leave">${esc(X.leave)}</button></section>`;
    const banner = !st.online ? (st.wasOn ? X.offline : X.connecting) : (st.mode === "guest" && !st.hostOn ? X.hostAway : "");
    const key = V.key || "";
    if (ui.draftKey !== key) { ui.draftKey = key; ui.draft = ""; }
    const btn = (b, kind) => `<button class="btn${b.ghost ? " ghost" : ""}" data-act="${kind}" data-c="${esc(b.cmd || b.local)}" ${b.dis ? "disabled" : ""}>${esc(b.sure && ui.sure === (b.cmd || b.local) ? X.sure : b.t)}</button>`;
    return `<div class="top"><span class="rtitle c-${V.top.color}"><span class="ico" aria-hidden="true">${V.top.icon}</span><b>${esc(V.top.title)}</b></span><button class="btn ghost small" data-act="r-local" data-c="rules">${esc(X.rules)}</button></div>
      <p class="rsub">${esc(V.sub || "")}</p>
      ${V.bar != null ? `<div class="bar rbar c-${V.top.color}"><i style="width:${+V.bar}%"></i></div>` : ""}
      ${banner ? `<p class="flash">${esc(banner)}</p>` : ""}
      ${V.poster ? poster(V.poster, V.top) + (V.rest || []).map(b => block(b, V.top.color)).join("") : (V.blocks || []).map(b => block(b, V.top.color)).join("")}
      ${input(V.input, ui.draft)}
      ${V.note ? `<p class="note rnote">${esc(V.note)}</p>` : ""}
      ${V.party ? `<div class="stack">${V.poster && MEIVI.story ? `<button class="btn" data-act="r-local" data-c="share">${esc(story.wanted && !story.file ? T.shareWait : T.shareStory)}</button>` : ""}${st.game && window.MACC && MACC.gameRating ? MACC.gameRating("m:" + st.game) : ""}</div>` : ""}
      ${V.host ? `<div class="stack rhost">${V.host.map(b => btn(V.poster ? Object.assign({ ghost: true }, b) : b, "r-cmd")).join("")}</div>` : ""}
      ${V.foot ? `<div class="stack rhost">${V.foot.map(b => btn(Object.assign({ ghost: true }, b), "r-local")).join("")}</div>` : ""}
      ${ui.rules && st.game ? `<div class="sheet rsheet" data-act="r-local" data-c="rules-close"><div role="dialog">${rulesHtml(st.game)}<div class="stack rfoot"><button class="btn" data-act="r-local" data-c="rules-close">${esc(X.close)}</button></div></div></div>` : ""}
      ${V.party && window.MACC && MACC.ratingSheet ? MACC.ratingSheet() : ""}
      ${V.poster && story.sheet && story.url ? `<div class="sheet" data-act="r-local" data-c="story-close"><div role="dialog" aria-label="${esc(T.shareTitle)}">
        <h1 class="rsheet-h">${esc(T.shareTitle)}</h1><img class="storyimg" src="${story.url}" alt=""><p class="note">${esc(T.shareKeep)}</p>
        <a class="btn" href="${story.url}" download="meivi-${esc(st.game)}.png">${esc(T.shareSave)}</a>
        <button class="btn ghost" data-act="r-local" data-c="story-close">${esc(X.close)}</button></div></div>` : ""}`;
  }
  /* The mood of the page while a game is played in the room (the styles "mood-<name>", set by app.js):
     a game for two has the mood of the couples' games, an adult one the dark one, a game for a company the friends' one.
     The room before the game (the code, who is in) keeps the plain page. */
  function mood() {
    const st = room.st, snap = st.mode && !st.closed && st.snap, inf = snap && info(snap.game);
    if (!inf || snap.phase === "lobby" || !room.myView()) return null;
    return { grp: inf.adult ? "adult" : inf.max === 2 ? "couples" : "friends", play: snap.phase === "play" };
  }
  function enter() { ui.sheet = null; ui.err = ""; ui.sure = ""; ui.rules = false; MEIVI.app.show("room"); keepAwake(); }
  function click(act, b, target) {
    const c = b.dataset.c;
    if (act === "r-open") { ui.sheet = { k: "rules", game: b.dataset.g }; ui.err = ""; ui.name = ui.name || lastName(); return true; }
    if (act === "r-join") { ui.sheet = { k: "join" }; ui.err = ""; ui.name = ui.name || lastName(); return true; }
    if (act === "r-sheet") {
      if (c === "close") { if (b.classList.contains("sheet") && target !== b) return false; ui.sheet = null; }
      else if (c === "name") ui.sheet = { k: "name", game: ui.sheet.game };
      else if (c === "join") ui.sheet = { k: "join" };
      else if (c === "resume") { const s = ui.sheet.saved; ui.sheet = null; room.resume(s); enter(); }
      else if (c === "forget") { store.set(null); ui.sheet = null; }
      ui.err = "";
      return true;
    }
    if (act === "r-ans") { room.answer(b.dataset.v); return true; }
    if (act === "r-cmd") {
      const sure = (room.myView().host || []).find(x => x.cmd === c && x.sure);
      if (sure && ui.sure !== c) { ui.sure = c; return true; }
      ui.sure = "";
      room.command(c);
      if (c === "close") MEIVI.app.show("multi");
      return true;
    }
    if (act === "r-local") {
      if (c === "rules") ui.rules = true;
      else if (c === "rules-close") { if (b.classList.contains("sheet") && target !== b) return false; ui.rules = false; }
      else if (c === "share") shareStory();
      else if (c === "story-close") { if (b.classList.contains("sheet") && target !== b) return false; story.sheet = false; }
      else if (c === "leave") { room.leave(); MEIVI.app.show("multi"); }
      return true;
    }
    return false;
  }
  function submit(form) {
    const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    if (form.id === "rName") {
      ui.name = val("rNameIn");
      if (!ui.name) { ui.err = X.needName; return; }
      keepName(ui.name); room.host(ui.sheet.game, ui.name); enter();
    } else if (form.id === "rJoin") {
      ui.name = val("rNameIn"); ui.code = val("rCodeIn").replace(/\D/g, "");
      if (ui.code.length !== 5) { ui.err = X.badCode; return; }
      if (!ui.name) { ui.err = X.needName; return; }
      keepName(ui.name); room.join(ui.code, ui.name); enter();
    } else if (form.id === "rForm") {
      const text = val("rText"); if (!text) return;
      ui.draft = ""; room.answer(text);
    }
  }
  /* After the screen was drawn again: the QR picture, and the letter someone is in the middle of writing. */
  function after() {
    const box = document.querySelector("[data-qr]");
    if (box && !box.innerHTML) drawQr(box);
    if (room.st.mode) prepareStory(room.myView());
    const ta = document.getElementById("rText");
    if (ta) { ta.addEventListener("input", () => { ui.draft = ta.value; }); keepTyping(ta, "typing"); } else ui.typing = false;
    /* the opinion of the game, written on the last screen */
    const op = document.getElementById("opText");
    if (op) keepTyping(op, "opTyping"); else ui.opTyping = false;
  }
  /* Someone in the middle of writing stays in the field when the room is drawn again. */
  function keepTyping(el, flag) {
    if (ui[flag]) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    el.addEventListener("focus", () => { ui[flag] = true; });
    el.addEventListener("blur", () => { setTimeout(() => { if (document.activeElement !== document.getElementById(el.id)) ui[flag] = false; }, 0); });
  }
  function drawQr(box) {
    const link = box.dataset.qr;
    const paint = () => { try { const q = window.qrcode(0, "M"); q.addData(link); q.make(); qrCache[link] = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); box.innerHTML = qrCache[link]; } catch (e) {} };
    if (window.qrcode) return paint();
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js", paint);
  }
  function loadScript(src, done) {
    const old = document.querySelector(`script[data-src="${src}"]`);
    if (old) { if (old.dataset.ok) done(); else old.addEventListener("load", done); return; }
    const s = document.createElement("script"); s.src = src; s.dataset.src = src;
    s.addEventListener("load", () => { s.dataset.ok = "1"; done(); });
    document.head.append(s);
  }
  /* A phone that goes dark in the middle of a game drops out of the room. */
  let lock = null;
  function keepAwake() {
    try { if (navigator.wakeLock && !lock) navigator.wakeLock.request("screen").then(l => { lock = l; l.addEventListener("release", () => { lock = null; }); }).catch(() => {}); } catch (e) {}
  }
  if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", () => { if (!document.hidden && room.st.mode) keepAwake(); });

  /* Opening the app with ?room=12345 (the QR code), or coming back to a room left open. */
  function boot() {
    let code = "";
    try { code = (new URLSearchParams(location.search).get("room") || "").replace(/\D/g, "").slice(0, 5); } catch (e) {}
    const saved = store.get();
    if (code && !(saved && saved.code === code)) { ui.code = code; ui.name = lastName(); ui.sheet = { k: "join" }; MEIVI.app.show("multi"); }
    else if (saved && saved.code && Date.now() - (saved.ts || 0) < 3 * 3600 * 1000) { ui.sheet = { k: "resume", saved }; MEIVI.app.show("multi"); }
    else if (saved) store.set(null);
  }

  window.MROOM = { view, overlay, click, submit, after, boot, room, ui, mood };

  /* ---------- the line between the phones ----------
     open(code, myId, {message(event, data), peers(ids), status("open" | "lost")}) -> {send(event, data), close()}
     "supabase": a Realtime channel of the project named in config.js (rooms.url, rooms.key).
     "local": between tabs of one browser, for trying things out (add ?local=1 to the address). */
  MEIVI.transport = MEIVI.transport || {
    local: wantLocal,
    open(code, id, on) {
      if (wantLocal && typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("meivi-room-" + code);
        ch.onmessage = e => on.message(e.data.e, e.data.d);
        setTimeout(() => on.status("open"), 0);
        return { send: (e, d) => ch.postMessage({ e, d: JSON.parse(JSON.stringify(d)) }), close: () => ch.close() };
      }
      let ch = null, client = null, closed = false; const queue = [];
      loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.0/dist/umd/supabase.min.js", () => {
        if (closed) return;
        client = window.supabase.createClient(CFG.rooms.url, CFG.rooms.key, { auth: { persistSession: false, autoRefreshToken: false } });
        ch = client.channel("meivi-room-" + code, { config: { broadcast: { self: false }, presence: { key: id } } });
        ch.on("broadcast", { event: "m" }, m => on.message(m.payload.e, m.payload.d));
        ch.on("presence", { event: "sync" }, () => on.peers(Object.keys(ch.presenceState())));
        ch.subscribe(status => {
          if (status === "SUBSCRIBED") { ch.track({ at: Date.now() }); on.status("open"); queue.splice(0).forEach(m => ch.send(m)); }
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") on.status("lost");
        });
      });
      return {
        send(e, d) { const m = { type: "broadcast", event: "m", payload: { e, d } }; if (ch && ch.state === "joined") ch.send(m); else { if (e === "snap") { const i = queue.findIndex(q => q.payload.e === "snap"); if (i >= 0) queue.splice(i, 1); } queue.push(m); } },
        close() { closed = true; try { if (client && ch) client.removeChannel(ch); } catch (e) {} }
      };
    }
  };
})();

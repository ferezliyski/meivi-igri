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
     { top: {icon, title, color}, sub, blocks: [...], input, note, host: [...], foot: [...] }
     blocks  {k: "h" | "p" | "card" | "rows" | "chips" | "code" | "wait" | "big" | "letter", ...}
     input   {k: "choice", options: [{v, t, sub, dis, tag}], done, pills, cols}
             {k: "text", max, ph, sent} | {k: "btn", t, v}
     host    buttons only the host has: {t, cmd, ghost, dis, sure}

   A game (MEIVI.mgame(id, {...})) gives: min, max, setup(c), view(c, g, playerId), ans(c, g, playerId, value),
   cmd(c, g, name), over(g), final(c, g) and, if it uses a timer, wake(c, g). Its state g must be plain data.
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
    const st = { mode: null, code: null, me: null, game: null, players: [], late: [], phase: "lobby", g: null, seq: 0,
                 snap: null, online: false, hostOn: true, closed: false, link: "" };
    let line = null, timers = [], helloAt = 0;
    const rnd = n => Math.floor(env.random() * n);
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const newId = () => "p" + rnd(1e9).toString(36) + rnd(1e9).toString(36);
    const def = () => DEFS[st.game];
    const ctx = () => ({
      ids: st.players.map(p => p.id),
      name: id => { const p = st.players.find(p => p.id === id); return p ? p.name : "?"; },
      tx: MEIVI.mtexts[st.game], ui: X, rnd, shuffle, pick: a => a[rnd(a.length)], now: env.now,
      /* Asks for a command to arrive after some time (the bomb's fuse). Only the host keeps time. */
      later: (ms, cmd) => { timers.push(env.timer(() => { if (st.mode === "host" && st.phase === "play") { def().cmd(ctx(), st.g, cmd); settle(); } }, ms)); }
    });
    const stopTimers = () => { timers.forEach(env.clear); timers = []; };

    function open() { line = env.transport(st.code, st.me.id, { message: onMessage, peers: onPeers, status: onStatus }); }
    function save() {
      if (!st.mode) return env.store.set(null);
      const s = { mode: st.mode, code: st.code, me: st.me, game: st.game, ts: env.now() };
      if (st.mode === "host") Object.assign(s, { players: st.players, late: st.late, phase: st.phase, g: st.g, seq: st.seq });
      env.store.set(s);
    }

    /* ----- host ----- */
    function host(game, name) {
      Object.assign(st, { mode: "host", game, code: String(10000 + rnd(90000)), me: { id: newId(), name }, late: [], phase: "lobby", g: null, seq: 0, snap: null, closed: false, online: false, wasOn: false, hostOn: true });
      st.players = [{ id: st.me.id, name, on: true }];
      st.link = env.link(st.code);
      open(); publish();
    }
    function viewFor(pid) {
      const d = def(), inf = info(st.game), isHost = pid === st.me.id;
      const top = { icon: inf.icon, title: gameName(st.game), color: inf.color };
      if (st.late.some(p => p.id === pid)) return { top, sub: X.room(st.code), blocks: [{ k: "p", text: X.lateJoin }], foot: [{ t: X.leave, local: "leave" }] };
      if (st.phase === "lobby") {
        const n = st.players.length, ok = n >= d.min && n <= d.max;
        return { top, sub: X.room(st.code), blocks: [
            { k: "code", code: st.code, link: st.link },
            { k: "chips", title: X.inRoom(n), items: st.players.map(p => ({ t: p.name, sub: p.id === st.me.id ? X.hostTag : "", dim: !p.on })) },
            { k: "p", text: ok ? (isHost ? X.canStart : X.waitHost) : X.needPlayers(d.min, d.max, n) }
          ],
          host: isHost ? [{ t: X.start, cmd: "start", dis: !ok }, { t: X.closeRoom, cmd: "close", ghost: true, sure: true }] : null,
          foot: isHost ? null : [{ t: X.leave, local: "leave" }] };
      }
      if (st.phase === "end") {
        const f = st.g ? d.final(ctx(), st.g) : { blocks: [] };
        return { top, sub: X.gameOver, blocks: f.blocks, party: true,
          host: isHost ? [{ t: X.again, cmd: "again" }, { t: X.closeRoom, cmd: "close", ghost: true, sure: true }] : null,
          foot: isHost ? null : [{ t: X.leave, local: "leave" }] };
      }
      const v = d.view(ctx(), st.g, pid);
      return { top, sub: v.sub, blocks: v.blocks, input: v.input, note: v.note, key: v.key,
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
        Object.assign(st, { mode: "host", code: s.code, me: s.me, game: s.game, players: s.players || [], late: s.late || [], phase: s.phase || "lobby", g: s.g || null, seq: s.seq || 0, closed: false });
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
  function block(b, color) {
    if (b.k === "h") return `<h2 class="rh">${esc(b.text)}</h2>`;
    if (b.k === "p") return `<p class="rp${b.strong ? " strong" : ""}">${esc(b.text)}</p>`;
    if (b.k === "card") return `<div class="deck still"><article class="card rcard c-${b.color || color}${b.secret ? " secret" : ""}"><span class="tag">${esc(b.tag)}</span><p class="q">${esc(b.text)}</p>${b.sub ? `<p class="rule">${esc(b.sub)}</p>` : ""}</article></div>`;
    if (b.k === "letter") return `<article class="letter"><span>${esc(b.from)}</span><p>${esc(b.text)}</p></article>`;
    if (b.k === "big") return `<div class="rbig c-${color}"><b>${esc(b.text)}</b>${b.sub ? `<span>${esc(b.sub)}</span>` : ""}</div>`;
    if (b.k === "wait") return b.names.length ? `<p class="note rwait">${esc(X.waiting(b.names.join(", ")))}</p>` : "";
    if (b.k === "rows") return `${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ""}<table class="rrows"><tbody>${b.rows.map(r => `<tr class="${r.hot ? "hot" : ""}${r.dim ? " dim" : ""}"><td>${esc(r.l)}</td><td>${esc(r.r)}</td></tr>`).join("")}</tbody></table>`;
    if (b.k === "chips") return `${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ""}<div class="chips">${b.items.map(i => `<span class="chip rchip${i.on ? " on" : ""}${i.dim ? " dim" : ""}">${esc(i.t)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</span>`).join("")}</div>`;
    if (b.k === "code") return `<section class="rcode"><span>${esc(X.roomCode)}</span><b>${esc(b.code)}</b><div class="qr" data-qr="${esc(b.link)}">${qrCache[b.link] || ""}</div><small>${esc(X.scan(CFG.playAt || location.host))}</small></section>`;
    return "";
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
        <h1>${esc(gameName(id))}</h1>
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
      ${banner ? `<p class="flash">${esc(banner)}</p>` : ""}
      ${(V.blocks || []).map(b => block(b, V.top.color)).join("")}
      ${input(V.input, ui.draft)}
      ${V.note ? `<p class="note rnote">${esc(V.note)}</p>` : ""}
      ${V.host ? `<div class="stack rhost">${V.host.map(b => btn(b, "r-cmd")).join("")}</div>` : ""}
      ${V.foot ? `<div class="stack rhost">${V.foot.map(b => btn(Object.assign({ ghost: true }, b), "r-local")).join("")}</div>` : ""}
      ${ui.rules && st.game ? `<div class="sheet rsheet" data-act="r-local" data-c="rules-close"><div role="dialog">${rulesHtml(st.game)}<div class="stack rfoot"><button class="btn" data-act="r-local" data-c="rules-close">${esc(X.close)}</button></div></div></div>` : ""}`;
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
    const ta = document.getElementById("rText");
    if (ta) {
      ta.addEventListener("input", () => { ui.draft = ta.value; });
      if (ui.typing) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} }
      ta.addEventListener("focus", () => { ui.typing = true; });
      ta.addEventListener("blur", () => { setTimeout(() => { if (document.activeElement !== document.getElementById("rText")) ui.typing = false; }, 0); });
    } else ui.typing = false;
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

  window.MROOM = { view, overlay, click, submit, after, boot, room, ui };

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

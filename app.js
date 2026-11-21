/* =====================================================================
   Meivi games: the app.
   No text of any language lives in this file. It reads:
     config.js                    which site this is: language, shop address, list of games
     catalog.js                   what every game is (how it is played, players, colour), without text
     lang/<lang>/ui.js            every word of the app itself, as T
     lang/<lang>/games/<id>.js    the text of one game
   A new game = one line in catalog.js and one text file per language, with no change here.

   Three ways to play: cards (passed around), quiz (four answers), match (two people).
   Cards: [kind, text, level]; kind is "A" confession | "V" who of us | "Q" question | "D" task | "G" guess.
          In a text {o} is another player, {h} the first player (the hero), "text||answer" hides an answer.
   Quiz:  [question, [right, wrong, wrong, wrong]] (shown shuffled).
   Match: text (a choice between the two names), [question, [a, b]],
          or [about myself, about the other with {n}, [options]].
   ===================================================================== */
const CFG = MEIVI.config, T = MEIVI.ui;
const SHELVES = MEIVI.catalog.categories;
const GAMES = MEIVI.catalog.games
  .filter(m => MEIVI.texts[m.id] && (!CFG.games || CFG.games.includes(m.id)))
  .map(m => {
    const t = MEIVI.texts[m.id];
    return Object.assign({}, t, {
      id: m.id, grp: m.cat, c: m.color, eng: m.eng, n: m.players, ico: m.icon,
      adult: m.adult, levels: m.levels, modes: m.modes, drinkOpt: m.drink, ordered: m.ordered,
      cat: t.label, aw: t.awards, qs: t.questions
    });
  });

/* Games for several phones are only announced for now; a site without them starts straight at the list. */
const MULTI = MEIVI.multi && MEIVI.catalog.multi ? MEIVI.catalog.multi : null;
const multiCount = () => MULTI.length;
/* "How many are you?": a game fits when the number is between its fewest and its most players.
   6 stands for "six or more". A game that is not built yet has no "max" and fits from its fewest up. */
const multiFits = (g, n) => !n || (n >= 6 ? g.min <= 6 && (g.max == null || g.max >= 6) : g.min <= n && (g.max == null || g.max >= n));
const multiReady = g => !!(MEIVI.mready && MEIVI.mready(g.id));

const KIND_CLASS = {A:"c-gold",V:"c-mint",Q:"c-hot",D:"c-lilac"};
const KIND_COLOR = {A:"gold",V:"mint",Q:"hot",D:"lilac",G:"gold"};
function poolOf(g){
  return g.cards.filter(([k,t,l]) => (!g.levels || (l >= Math.max(1,S.level-1) && l <= S.level)) && (!g.modes || S.kinds[k]));
}

/* ---------- State ---------- */
let S = {screen: MULTI ? "start" : "home", g:null, rounds:15, level:2, kinds:{A:true,V:true,Q:true,D:true}, drink:true, players:[], deck:[], i:0, stats:[], sel:[], flash:"",
         sheet:false, copied:false, picked:null, m:null, mn:0, msoon:false, run:0, story:{}};
try{ S.mn = +(localStorage.getItem("meivi.multi.n") || 0) || 0; }catch(e){}

const app = document.getElementById("app");
const h = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const bold = s => `<b>${h(s)}</b>`;
const rand = n => Math.floor(Math.random()*n);
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };
const game = () => GAMES.find(g => g.id === S.g);
/* A tester's buttons on a card (account.js); empty for everyone else. */
const rv = text => window.MACC ? MACC.reviewButtons("s:" + S.g, text) : "";
const playersLabel = g => T.players(g.n[0], g.n[1]);

function loadNames(){
  try{
    const v = JSON.parse(localStorage.getItem("meivi.games.players")||"null");
    if(Array.isArray(v) && v.length) S.players = v.slice(0,12).map(String).filter(x => !T.autoName.test(x));
  }catch(e){}
}
function saveNames(){ try{ localStorage.setItem("meivi.games.players", JSON.stringify(S.players)); }catch(e){} }

/* ---------- Building the deck ---------- */
function begin(){
  const g = game(), n = S.players.length;
  S.run++; S.i = 0; S.sel = []; S.flash = ""; S.sheet = false; S.copied = false; S.picked = null; S.answered = 0; S.hist = [];
  S.stats = S.players.map(() => ({a:0,b:0,pass:0}));
  if(g.eng === "cards"){
    let deck = poolOf(g).map(([k,t,l]) => ({k,t,l}));
    const R = Math.min(S.rounds, deck.length);
    if(g.ordered) deck = Array.from({length:R}, (_,i) => deck[R > 1 ? Math.round(i*(deck.length-1)/(R-1)) : 0]);
    else deck = shuffle(deck).slice(0, R);
    let turn = g.ordered ? 0 : rand(n);
    deck.forEach(c => {
      if(c.k==="Q" || c.k==="D"){
        c.p = turn % n; turn++;
        let o = rand(n-1); if(o >= c.p) o++;
        c.o = o;
      }
    });
    S.deck = deck;
  }else if(g.eng === "quiz"){
    S.deck = shuffle(g.qs.slice()).slice(0, S.rounds).map(([q,opts]) => ({q, opts: shuffle(opts.map((t,i) => ({t, ok:i===0})))}));
  }else{
    S.deck = shuffle(g.qs.slice()).slice(0, S.rounds);
    S.m = {step:0, ans:[null,null], hits:0, guess:[0,0], asked:[0,0]};
  }
  S.screen = "play";
  if(window.MACC) MACC.loadReviews("s:" + g.id);
}

/* ---------- First screen: one phone or several ---------- */
function viewStart(){
  return `${window.MACC ? `<div class="top acctop">${MACC.button()}</div>` : ""}
  <header class="stack hero">
    <img class="logo" src="logo-ink.png" alt="Meivi"><span class="brand">${T.brand}</span>
    <h1>${T.startTitle}</h1>
  </header>
  <div class="grid ways">
    <button class="tile big c-hot" data-act="home">
      <span class="ico" aria-hidden="true">📱</span>
      <span class="tx"><b>${T.onePhone}</b><span class="d">${T.onePhoneText}</span><small>${T.gamesCount(GAMES.length)}</small></span>
    </button>
    <button class="tile big c-lilac" data-act="multi">
      <span class="ico two" aria-hidden="true">📱📱</span>
      <span class="tx"><b>${T.manyPhones}</b><span class="d">${T.manyPhonesText}</span><small>${T.multiCount(MULTI.filter(g => MEIVI.mready && MEIVI.mready(g.id)).length, multiCount())}</small></span>
    </button>
  </div>${window.MACC ? MACC.overlay() : ""}`;
}

/* ---------- Games for several phones (announced, not yet playable) ---------- */
function viewMulti(){
  const M = MEIVI.multi;
  /* One game is one narrow row. A game that is built opens its rules; the others are only announced. */
  const row = g => { const t = M.games[g.id] || {name: g.id}, color = g.color || "hot", ready = multiReady(g);
    const body = `<span class="ico" aria-hidden="true">${g.icon || "🎲"}</span>
      <span class="tx"><b>${t.name}</b>${t.desc || t.hint ? `<small>${t.desc || t.hint}</small>` : ""}</span>
      <span class="end">${ready ? `<i>${window.MACC && MACC.locked("m:" + g.id) ? "🔒 " : ""}${T.playersShort(g.min, g.max)}</i>` : `<i class="pill">${T.soon}</i>`}${g.adult ? `<i class="age">18+</i>` : ""}</span>`;
    return ready ? `<button class="mrow c-${color}${window.MACC && MACC.locked("m:" + g.id) ? " locked" : ""}" data-act="r-open" data-g="${g.id}">${body}</button>` : `<div class="mrow wait c-${color}">${body}</div>`; };
  const fit = MULTI.filter(g => multiFits(g, S.mn)), ready = fit.filter(multiReady), soon = fit.filter(g => !multiReady(g));
  return `<div class="top"><button class="btn ghost small" data-act="landing"><span aria-hidden="true">←</span> ${T.toStart}</button>${window.MROOM ? `<button class="btn small join" data-act="r-join">${T.rooms.joinRoom}</button>` : ""}</div>
  <header class="stack hero">
    <img class="logo" src="logo-ink.png" alt="Meivi"><span class="brand">${T.manyPhones}</span>
    <h1>${T.multiTitle}</h1>
    <p class="note">${T.multiNote}</p>
  </header>
  <section class="stack">
    <h2 class="mid">${T.howMany}</h2>
    <div class="seg" role="group" aria-label="${T.howMany}">${[2, 3, 4, 5, 6].map(n => `<button data-act="mn" data-n="${n}" aria-pressed="${S.mn === n}">${n === 6 ? T.sixPlus : n}</button>`).join("")}</div>
  </section>
  <section class="stack">
    <div class="headrow"><h2>${S.mn ? T.multiFor(S.mn) : T.multiAll}</h2><span class="cnt">${T.gamesCount(ready.length)}</span></div>
    ${ready.length ? `<div class="mlist">${ready.map(row).join("")}</div>` : `<p class="how">${T.multiNone}</p>`}
    ${soon.length ? `<button class="msoon" data-act="msoon" aria-expanded="${S.msoon}">${T.soonMore(soon.length)} <span aria-hidden="true">${S.msoon ? "▴" : "▾"}</span></button>
    ${S.msoon ? `<div class="mlist">${soon.map(row).join("")}</div>` : ""}` : ""}
  </section>${window.MROOM ? MROOM.overlay() : ""}`;
}

/* ---------- Games for one phone ---------- */
function viewHome(){
  const tile = (g, big) => `<button class="tile c-${g.c}${big ? " big" : ""}${window.MACC && MACC.locked("s:" + g.id) ? " locked" : ""}" data-act="open" data-g="${g.id}">${window.MACC && MACC.locked("s:" + g.id) ? `<i class="lock" aria-hidden="true">🔒</i>` : ""}
      <span class="ico" aria-hidden="true">${g.ico || "🎲"}</span>
      <span class="tx"><b>${g.name}</b>${big ? `<span class="d">${g.desc}</span>` : ""}
        <small>${playersLabel(g)} · ${T.engines[g.eng]}${g.adult ? ` · <i class="age">18+</i>` : ""}</small></span>
    </button>`;
  /* A shelf with no game on this site is not shown at all. */
  const shelves = SHELVES.filter(id => GAMES.some(g => g.grp === id));
  return `
  ${MULTI ? `<div class="top"><button class="btn ghost small" data-act="landing"><span aria-hidden="true">←</span> ${T.toStart}</button></div>` : ""}
  <header class="stack hero">
    <img class="logo" src="logo-ink.png" alt="Meivi"><span class="brand">${T.brand}</span>
    <h1>${T.homeTitle}</h1>
    <p class="note">${T.homeNote(GAMES.length, shelves.length)}</p>
  </header>
  <nav class="cats" aria-label="${T.shelvesLabel}">${shelves.map(id => `<button data-act="cat" data-i="${id}">${T.shelves[id]}</button>`).join("")}</nav>
  ${shelves.map(id => {
    const gs = GAMES.filter(g => g.grp === id), all = MEIVI.catalog.games.filter(m => m.cat === id).length;
    return `<section class="shelf" id="cat-${id}">
      <div class="headrow"><h2>${T.shelves[id]}</h2><span class="cnt">${T.shelfCount(gs.length, all)}</span></div>
      <div class="grid">${gs.map((g,i) => tile(g, i===0)).join("")}</div>
    </section>`;
  }).join("")}`;
}

/* ---------- Before the game ---------- */
function viewSetup(){
  const g = game(), n = S.players.length;
  const anyKind = !g.modes || Object.values(S.kinds).some(Boolean);
  const ok = n >= g.n[0] && n <= g.n[1] && anyKind;
  const pool = g.eng==="cards" ? poolOf(g).length : 0;
  const extra = `${g.modes ? `<section class="stack"><h2>${T.modes}</h2>
    <div class="modes">${["A","V","Q","D"].map(k => `<button class="mode ${KIND_CLASS[k]}" data-act="kind" data-k="${k}" aria-pressed="${S.kinds[k]}"><b>${g.tags[k]}</b><small>${T.modeHints[k]}</small></button>`).join("")}</div>
    ${anyKind ? "" : `<p class="flash" style="text-align:left">${T.pickMode}</p>`}</section>` : ""}
  ${g.levels ? `<section class="stack"><h2>${T.spice}</h2>
    <div class="seg">${T.levels.map((t,i) => `<button data-act="level" data-v="${i+1}" aria-pressed="${S.level===i+1}">${t}</button>`).join("")}</div></section>` : ""}
  ${g.drinkOpt ? `<section class="stack"><h2>${T.penalty}</h2>
    <div class="seg"><button data-act="drink" data-v="1" aria-pressed="${S.drink}">${T.sip}</button><button data-act="drink" data-v="0" aria-pressed="${!S.drink}">${T.pointsOnly}</button></div></section>` : ""}`;
  const how = [T.how[g.eng], g.note, g.hero && T.heroHow(g.hero), g.adult && T.adultOnly].filter(Boolean).join(" ");
  return `
  <div class="top"><button class="btn ghost small" data-act="home">${T.allGames}</button><img class="logo sm" src="logo-ink.png" alt="Meivi"></div>
  <header class="stack c-${g.c} ghead">
    <span class="ico lg" aria-hidden="true">${g.ico || "🎲"}</span>
    <span class="brand" style="color:var(--m)">${g.cat}</span>
    <h1>${g.name}</h1>
    <p>${g.desc}</p>
  </header>
  <p class="how">${how}</p>
  <section class="stack">
    <div class="headrow"><h2>${T.playersTitle(n)}</h2><span class="req">${T.playersNeed(g.n[0], g.n[1])}</span></div>
    <div class="chips">
      ${S.players.map((p,i) => `<span class="chip ${g.hero && i===0 ? "first" : ""}">
        <button class="nm" data-act="front" data-i="${i}" ${g.hero ? "" : "disabled"}>${h(p)}</button>
        <button class="x" data-act="del" data-i="${i}" aria-label="${T.removePlayer(h(p))}">×</button></span>`).join("")}
    </div>
    ${n >= g.n[1] ? "" : `<form class="add" id="addForm">
      <input id="newName" maxlength="18" placeholder="${g.hero && n===0 ? T.heroFirst(g.hero) : T.playerName}" autocomplete="off" aria-label="${T.playerName}">
      <button class="btn small" type="submit">${T.add}</button>
    </form>`}
    <p class="${ok ? "note" : "flash"}" style="text-align:left">${T.playersStatus(n, g.n[0], g.n[1])}</p>
  </section>
  ${extra}
  <section class="stack">
    <h2>${g.eng==="cards" ? T.cardsCount : T.questionsCount}</h2>
    <div class="seg times">${[15,30,50].map(n => `<button data-act="rounds" data-v="${n}" aria-pressed="${S.rounds===n}"><b>${n}</b><small>${T.time[g.eng][n]}</small></button>`).join("")}</div>
    ${g.eng==="cards" && anyKind && pool < S.rounds ? `<p class="note">${T.poolNote(pool)}</p>` : ""}
  </section>
  ${window.MACC && MACC.locked("s:" + g.id) ? MACC.gate("s:" + g.id, "s:" + g.id) : `<button class="btn" data-act="start" ${ok ? "" : "disabled"}>${g.adult ? T.startAdult : T.start}</button>`}`;
}

/* ---------- Shared parts ---------- */
/* Back: with cards and "for two" it restores the state from before the last action (points too).
   In a quiz it only shows the previous question; the answer and the points stay. */
function keep(){
  (S.hist = S.hist || []).push(JSON.stringify({screen:S.screen, i:S.i, sel:S.sel, picked:S.picked, stats:S.stats, m:S.m, flash:S.flash}));
}
function canBack(){
  const g = game();
  if(S.screen === "end") return !!S.deck.length && (g.eng === "quiz" || !!(S.hist && S.hist.length));
  return g.eng === "quiz" ? S.i > 0 : !!(S.hist && S.hist.length);
}
function goBack(){
  const g = game();
  if(!canBack()) return;
  if(g.eng === "quiz"){
    if(S.screen === "end") S.screen = "play"; else S.i--;
    S.picked = S.deck[S.i].pick ?? null;
  }else{
    Object.assign(S, JSON.parse(S.hist.pop()));
    if(g.eng === "cards") S.flash = T.cardBack;
  }
  S.sheet = false; S.copied = false;
}
function topBar(total){
  const g = game();
  return `<div class="stack">
    <div class="top">
      <button class="btn ghost small" data-act="back" aria-label="${T.backLabel}" ${canBack() ? "" : "disabled"}><span aria-hidden="true">←</span> ${T.back}</button>
      <span class="count">${T.progress(S.i+1, total)}</span>
      <span class="grp">${g.eng==="match" ? "" : `<button class="btn ghost small" data-act="sheet">${T.score}</button>`}<button class="btn ghost small" data-act="quit">${T.end}</button></span>
    </div>
    <div class="bar"><i style="width:${Math.round(S.i/total*100)}%"></i></div>
  </div>`;
}
function fill(t, c){
  return h(t).replace(/\{o\}/g, `<u>${h(S.players[c.o] ?? "")}</u>`).replace(/\{h\}/g, `<u>${h(S.players[0])}</u>`);
}

/* ---------- Cards ---------- */
function viewCards(){
  const g = game(), c = S.deck[S.i];
  const pen = g.drinkOpt && S.drink;
  const group = c.k==="A" || c.k==="V" || c.k==="G";
  const parts = String(c.t).split("||");
  const text = fill(parts[0], c);
  const ans = parts[1] ? `<details class="ans"><summary>${T.showAnswer}</summary><b>${h(parts[1])}</b></details>` : "";
  let body, rule, actions;
  if(c.k==="A"){ body = `<p class="q">${text}</p>`; rule = g.ruleA || T.rules.A(pen); }
  else if(c.k==="V"){ body = `<p class="lead">${h(g.lead)}</p><p class="q">…${text}</p>`; rule = g.ruleV || T.rules.V(pen); }
  else if(c.k==="G"){ body = `<p class="q">${text}</p>`; rule = T.rules.G(h(S.players[0])); }
  else if(c.k==="Q"){ body = `<p class="who">${T.questionTo(bold(S.players[c.p]))}</p><p class="q">${text}</p>`; rule = g.ruleQ || T.rules.Q(pen); }
  else { body = `<p class="who">${T.taskFor(bold(S.players[c.p]))}</p><p class="q">${text}</p>`; rule = g.ruleD || T.rules.D(pen); }
  body += ans;
  if(group){
    const ask = c.k==="A" ? (g.askA || T.ask.A) : T.ask[c.k];
    actions = `<div class="stack"><h2>${ask}</h2>
      <div class="pick">${S.players.map((p,i) => (c.k==="G" && g.hero && i===0) ? "" :
        `<button data-act="pick" data-i="${i}" aria-pressed="${S.sel.includes(i)}">${h(p)}</button>`).join("")}</div></div>
      <button class="btn" data-act="next">${S.sel.length ? T.saveNext : T.nobodyNext}</button>`;
  }else{
    actions = `<div class="row"><button class="btn ghost" data-act="pass">${T.pass}</button>
      <button class="btn" data-act="done">${c.k==="Q" ? T.answered : T.done}</button></div>`;
  }
  return `${topBar(S.deck.length)}
  <div class="deck"><article class="card c-${KIND_COLOR[c.k]}">${rv(c.t)}<span class="tag">${g.tags?.[c.k] || T.kinds[c.k]}</span>${c.l ? `<span class="heat" role="img" aria-label="${T.levelLabel(c.l)}">${[1,2,3].map(n => `<i class="${n<=c.l ? "on" : ""}"></i>`).join("")}</span>` : ""}${body}<p class="rule">${rule}</p></article></div>
  <p class="flash" aria-live="polite">${h(S.flash)}</p>
  ${actions}${S.sheet ? viewSheet() : ""}`;
}

/* ---------- Quiz ---------- */
function viewQuiz(){
  const g = game(), c = S.deck[S.i], n = S.players.length, p = S.i % n;
  const done = S.picked !== null;
  const right = c.opts.find(o => o.ok).t;
  return `${topBar(S.deck.length)}
  <div class="deck"><article class="card c-${g.c}">${rv(c.q + " → " + right)}<span class="tag">${g.cat}</span>
    ${n > 1 ? `<p class="who">${T.turn(bold(S.players[p]))}</p>` : ""}
    <p class="q">${h(c.q)}</p>
  </article></div>
  <div class="opts">${c.opts.map((o,i) => `<button class="opt ${done ? (o.ok ? "ok" : i===S.picked ? "bad" : "") : ""}"
      data-act="q-pick" data-i="${i}" ${done ? "disabled" : ""}>${h(o.t)}</button>`).join("")}</div>
  <p class="flash" aria-live="polite">${done ? (c.opts[S.picked].ok ? T.right : T.rightIs(h(right))) : ""}</p>
  ${done ? `<button class="btn" data-act="q-next">${T.next}</button>` : ""}
  ${S.sheet ? viewSheet() : ""}`;
}

/* ---------- For two ---------- */
function matchInfo(){
  const q = S.deck[S.i], about = Array.isArray(q) && q.length===3, same = Array.isArray(q) && q.length===2;
  const subj = about ? S.i % 2 : 0;
  const order = about ? [subj, 1-subj] : [0,1];
  const opts = about ? q[2] : same ? q[1] : [S.players[0], S.players[1]];
  const neutral = about ? q[1].replace("{n}", S.players[subj]) : same ? q[0] : T.whichOfTwo(q);
  return {q, about, subj, order, opts, neutral};
}
function viewMatch(){
  const g = game(), m = S.m, I = matchInfo();
  const bar = topBar(S.deck.length);
  if(m.step===0 || m.step===2){
    const who = I.order[m.step/2];
    return `${bar}<section class="cover">
      <p class="note">${T.handTo}</p><b>${h(S.players[who])}</b>
      <p class="note">${m.step===2 ? T.otherLooksAway : I.about ? (who===I.subj ? T.forYourself : T.guessOther) : T.oneByOne}</p>
      <button class="btn" data-act="m-ready">${T.gotPhone}</button></section>`;
  }
  if(m.step===1 || m.step===3){
    const who = I.order[(m.step-1)/2];
    const prompt = I.about ? (who===I.subj ? I.q[0] : I.q[1].replace("{n}", S.players[I.subj])) : I.neutral;
    return `${bar}
    <div class="deck"><article class="card c-${g.c}">${rv(Array.isArray(I.q) ? I.q[0] : I.q)}<span class="tag">${g.cat}</span>
      <p class="who">${T.answers(bold(S.players[who]))}</p><p class="q">${h(prompt)}</p></article></div>
    <div class="opts">${I.opts.map((o,i) => `<button class="opt" data-act="m-pick" data-i="${i}">${h(o)}</button>`).join("")}</div>`;
  }
  const same = m.ans[0] === m.ans[1];
  return `${bar}
  <div class="deck"><article class="card c-${g.c}">${rv(Array.isArray(I.q) ? I.q[0] : I.q)}<span class="tag">${g.cat}</span>
    <p class="q">${h(I.neutral)}</p>
    <div class="ans"><span>${h(S.players[I.order[0]])}</span><b>${h(I.opts[m.ans[0]])}</b></div>
    <div class="ans"><span>${h(S.players[I.order[1]])}</span><b>${h(I.opts[m.ans[1]])}</b></div>
    <p class="verdict" style="color:${same ? "#1E7F6B" : "#B12A29"}">${same ? T.same : T.different}</p>
  </article></div>
  <button class="btn" data-act="m-next">${T.next}</button>`;
}

/* ---------- Points and the end ---------- */
function scoreTable(){
  const g = game();
  const rows = S.players.map((p,i) => ({p, ...S.stats[i]})).sort((x,y) => (y.a+y.b)-(x.a+x.b));
  if(g.eng==="quiz") return `<table><thead><tr><th>${T.colPlayer}</th><th>${T.colRight}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${h(r.p)}</td><td>${r.b}</td></tr>`).join("")}</tbody></table>`;
  return `<table><thead><tr><th>${T.colPlayer}</th><th>${T.colPointed}</th><th>${T.colPoints}</th><th>${T.colPass}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${h(r.p)}</td><td>${r.a}</td><td>${r.b}</td><td>${r.pass}</td></tr>`).join("")}</tbody></table>`;
}
function viewSheet(){
  return `<div class="sheet" data-act="sheet-close"><div role="dialog" aria-label="${T.score}">
    <h1 style="font-size:24px">${T.scoreSoFar}</h1>${scoreTable()}
    <button class="btn" data-act="sheet-close">${T.backToPlay}</button></div></div>`;
}
const andJoin = names => names.join(` ${T.and} `);
function topBy(key){
  let best = 0, who = [];
  S.stats.forEach((s,i) => { if(s[key] > best){ best = s[key]; who = [i]; } else if(s[key] === best && best > 0) who.push(i); });
  return best > 0 ? {names: andJoin(who.map(i => S.players[i])), n: best} : null;
}
function summary(){
  const g = game();
  if(g.eng==="match"){
    const m = S.m, played = m.played || 0;
    const pct = played ? Math.round(m.hits/played*100) : 0;
    const rows = [];
    if(S.deck.some(q => Array.isArray(q) && q.length===3)){
      rows.push([T.guessed(S.players[0]), T.outOf(m.guess[0], m.asked[0])], [T.guessed(S.players[1]), T.outOf(m.guess[1], m.asked[1])]);
      if(m.guess[0] !== m.guess[1]) rows.push([T.knowsBetter, S.players[m.guess[0] > m.guess[1] ? 0 : 1]]);
    }else rows.push([T.matches, T.outOf(m.hits, played)]);
    return {big:`${pct}%`, title:T.tier(pct), rows};
  }
  if(g.eng==="quiz"){
    const t = topBy("b"), n = S.players.length;
    const rows = t ? [[n>1 ? T.winner : T.result, n>1 ? `${t.names} (${t.n})` : T.rightOutOf(t.n, S.answered || S.deck.length)]] : [];
    return {title: t ? T.finalRanking : T.noRight, rows};
  }
  const rows = [];
  const a = topBy("a"), b = topBy("b"), p = topBy("pass");
  if(a && g.aw[0]) rows.push([g.aw[0], a.names]);
  if(b && g.aw[1]) rows.push([g.aw[1], b.names]);
  if(g.aw[2]){
    const least = Math.min(...S.stats.map(x => x.a));
    const who = S.players.filter((_,i) => S.stats[i].a === least);
    if(who.length < S.players.length) rows.push([g.aw[2], andJoin(who)]);
  }
  if(p) rows.push([T.passKing, p.names]);
  return {title:T.recap, rows};
}
/* The same result as the end screen, as plain data for the picture (story.js). */
function storyData(){
  const g = game(), s = summary(), n = S.players.length;
  let rows = s.rows.slice(), hero;
  if(s.big) hero = {kind:"ring", big:s.big, word:T.matchWord, title:s.title, names:`${S.players[0]} ${T.and} ${S.players[1]}`};
  else if(g.eng==="quiz" && n > 1 && rows.length){ hero = {kind:"podium", label:T.finalRanking, top:S.players.map((p,i) => ({p, b:S.stats[i].b})).sort((x,y) => y.b - x.b).slice(0,3)}; rows = []; }
  else if(rows.length){ const [k,v] = rows.shift(); hero = {kind:"name", label:k, name:v}; }
  else hero = {kind:"title", title:s.title};
  let rank = null;
  if(g.eng !== "match" && (g.eng !== "quiz" || n > 3)){
    const list = S.players.map((p,i) => ({p, ...S.stats[i]})).sort((x,y) => (y.a+y.b)-(x.a+x.b));
    let cols = g.eng==="quiz" ? [[T.colRight,"b"]] : [[T.colPointed,"a"],[T.colPoints,"b"],[T.colPass,"pass"]].filter(([,k]) => list.some(r => r[k] > 0));
    if(!cols.length) cols = [[T.colPoints,"b"]];
    rank = {head:T.ranking, cols:cols.map(([t]) => t), list:list.map(r => ({p:r.p, v:cols.map(([,k]) => r[k])}))};
  }
  return {color:g.c, icon:g.ico || "", game:g.name, brand:T.brand, foot:T.playToo(location.host), hero, rows, rank};
}
/* The picture is made as soon as the end screen shows, so that "share" can open the phone's menu at once. */
function prepareStory(){
  if(!MEIVI.story || S.story.run === S.run) return;
  const run = S.run; S.story = {run, file:null, url:"", sheet:false, wanted:false};
  MEIVI.story.make(storyData()).then(blob => {
    if(!blob || S.story.run !== run) return;
    S.story.file = new File([blob], "meivi-" + S.g + ".png", {type:"image/png"});
    S.story.url = URL.createObjectURL(blob);
    if(S.story.wanted && S.screen === "end") render();
  }).catch(() => {});
}
function shareStory(){
  const st = S.story, text = T.shareText(game().name, location.origin);
  if(!st.file){ st.wanted = true; return; }
  st.wanted = false;
  try{
    if(navigator.canShare && navigator.canShare({files:[st.file]})){
      navigator.share({files:[st.file], text}).catch(() => {});
      return;
    }
  }catch(e){}
  st.sheet = true;   /* no sharing of pictures on this phone: show it, to be kept by hand */
}
function viewStorySheet(){
  return `<div class="sheet" data-act="story-close"><div role="dialog" aria-label="${T.shareTitle}">
    <h1 class="rsheet-h">${T.shareTitle}</h1>
    <img class="storyimg" src="${S.story.url}" alt="">
    <p class="note">${T.shareKeep}</p>
    <a class="btn" href="${S.story.url}" download="meivi-${h(S.g)}.png">${T.shareSave}</a>
    <button class="btn ghost" data-act="story-close">${T.close}</button></div></div>`;
}

function viewEnd(){
  const g = game(), s = summary(), n = S.players.length;
  let rows = s.rows.slice(), hero;
  if(s.big){
    hero = `<div class="ring" style="--p:${parseInt(s.big, 10)}"><b>${s.big}</b><span>${T.matchWord}</span></div>
      <p class="ptitle">${h(s.title)}</p>
      <p class="pnames">${h(S.players[0])} <i>${T.and}</i> ${h(S.players[1])}</p>`;
  }else if(g.eng==="quiz" && n > 1 && rows.length){
    const top3 = S.players.map((p,i) => ({p, b:S.stats[i].b})).sort((x,y) => y.b - x.b).slice(0,3);
    const slot = (r, cls) => r ? `<div class="p ${cls}">${cls==="p1" ? `<span class="cr" aria-hidden="true">👑</span>` : ""}<span class="pn">${h(r.p)}</span><i>${r.b}</i></div>` : "";
    hero = `<p class="plabel">${T.finalRanking}</p><div class="podium">${slot(top3[1],"p2")}${slot(top3[0],"p1")}${slot(top3[2],"p3")}</div>`;
    rows = [];
  }else if(rows.length){
    const [k,v] = rows.shift();
    hero = `<p class="plabel">${h(k)}</p><p class="pname${String(v).length > 12 ? " long" : ""}">${h(v)}</p>`;
  }else{
    hero = `<p class="pname long">${h(s.title)}</p>`;
  }
  let rank = "";
  if(g.eng !== "match" && (g.eng !== "quiz" || n > 3)){
    const list = S.players.map((p,i) => ({p, ...S.stats[i]})).sort((x,y) => (y.a+y.b)-(x.a+x.b));
    let cols = g.eng==="quiz" ? [[T.colRight,"b"]] : [[T.colPointed,"a"],[T.colPoints,"b"],[T.colPass,"pass"]].filter(([,k]) => list.some(r => r[k] > 0));
    if(!cols.length) cols = [[T.colPoints,"b"]];
    rank = `<div class="prank" style="--c:${cols.length}">
      <div class="pr ph"><span>${T.ranking}</span>${cols.map(([t]) => `<span>${t}</span>`).join("")}</div>
      ${list.map((r,i) => `<div class="pr"><span><i>${i+1}</i>${h(r.p)}</span>${cols.map(([,k]) => `<span>${r[k]}</span>`).join("")}</div>`).join("")}
    </div>`;
  }
  return `
  <section class="poster c-${g.c}">
    <div class="phead"><span class="plogo"><img class="logo" src="logo-ink.png" alt="Meivi"></span><span>${T.brand}</span></div>
    <p class="pgame"><span aria-hidden="true">${g.ico || "🎲"}</span>${g.name}</p>
    <div class="phero">${hero}</div>
    ${rows.length ? `<div class="pchips">${rows.map(([k,v]) => `<div><span>${h(k)}</span><b>${h(v)}</b></div>`).join("")}</div>` : ""}
    ${rank}
    <p class="pfoot">${T.playToo(`<b>${h(CFG.site)}</b>`)}</p>
  </section>
  <div class="stack">
    <button class="btn" data-act="share" ${MEIVI.story ? "" : "disabled"}>${S.story.wanted && !S.story.file ? T.shareWait : T.shareStory}</button>
    <div class="row"><button class="btn ghost" data-act="again">${T.again}</button><button class="btn ghost" data-act="home">${T.allGames}</button></div>
    ${canBack() ? `<button class="btn ghost small" data-act="back" style="align-self:center"><span aria-hidden="true">←</span> ${T.backToGame}</button>` : ""}
  </div>${S.story.sheet && S.story.url ? viewStorySheet() : ""}`;
}

let held = false, heldAt = 0;
function render(){
  let v;
  if(S.screen==="start" && MULTI) v = viewStart();
  else if(S.screen==="multi" && MULTI) v = viewMulti();
  else if(S.screen==="room" && window.MROOM) v = MROOM.view();
  else if(S.screen==="home" || !game()) v = viewHome();
  else if(S.screen==="setup") v = viewSetup();
  else if(S.screen==="end") v = viewEnd();
  else v = {cards:viewCards, quiz:viewQuiz, match:viewMatch}[game().eng]();
  app.innerHTML = v;
  app.querySelector?.(".card")?.style.setProperty("--tilt", (S.i % 2 ? 1.3 : -1.3) + "deg");
  const key = S.screen + ":" + S.g + ":" + S.i + ":" + (S.m ? S.m.step : "");
  if(key === lastKey) app.querySelector?.(".deck")?.classList.add("still");
  lastKey = key;
  if(fx){ fx = false; confetti(); }
  if(window.MROOM && (S.screen==="room" || S.screen==="multi")) MROOM.after();
  /* While a window (rules, account, a code) is open, the page behind it stays still, exactly where it was. */
  const windowOpen = !!app.querySelector?.(".sheet");
  if(windowOpen !== held && document.body){
    held = windowOpen;
    if(held){ heldAt = window.scrollY || 0; document.body.style.top = -heldAt + "px"; document.documentElement.classList.add("noscroll"); }
    else { document.documentElement.classList.remove("noscroll"); document.body.style.top = ""; window.scrollTo(0, heldAt); }
  }
  if(S.screen === "end") prepareStory();
  if(window.MEIVI_UPDATE) MEIVI_UPDATE.idle();
}

/* ---------- Actions ---------- */
let busy = false, fx = false, lastKey = "";
const calm = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
function confetti(){
  if(!document.body || calm()) return;
  const box = document.createElement("div"); box.className = "fx";
  const cols = ["#B12A29","#EF8F61","#1E7F6B","#6B4FB3","#1F6FB5","#F7C948"];
  for(let n=0; n<26; n++){
    const i = document.createElement("i");
    i.style.cssText = `left:${38+Math.random()*24}%;background:${cols[n%cols.length]};--x:${(Math.random()*2-1)*44}vw;--y:${-(18+Math.random()*40)}vh;--r:${Math.random()*720-360}deg;animation-delay:${Math.random()*.12}s`;
    box.append(i);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 1400);
}
function advance(){
  const go = () => {
    busy = false;
    S.sel = []; S.picked = null;
    if(S.i + 1 >= S.deck.length){ S.screen = "end"; S.flash = ""; S.copied = false; fx = true; }
    else{ S.i++; S.picked = S.deck[S.i].pick ?? null; }
    render(); window.scrollTo(0,0);
  };
  const el = document.querySelector?.(".card");
  if(el && !calm()){ busy = true; el.classList.add("out"); setTimeout(go, 190); }
  else go();
}
app.addEventListener("submit", e => {
  e.preventDefault();
  /* Forms of the rooms (name, code, a letter) are handled by rooms.js. */
  if(e.target.id !== "addForm"){ if(window.MROOM){ MROOM.submit(e.target); render(); } return; }
  const inp = document.getElementById("newName"), name = inp.value.trim();
  if(name && S.players.length < (game() ? game().n[1] : 12)){ S.players.push(name); saveNames(); render(); document.getElementById("newName")?.focus(); }
});
app.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if(!b || busy || b.disabled) return;
  const act = b.dataset.act;
  if(act==="sheet-close" && b.classList.contains("sheet") && e.target !== b) return;
  /* Everything that starts with "r-" belongs to the rooms. */
  if(act.startsWith("r-")){ if(window.MROOM && MROOM.click(act, b, e.target)) render(); return; }
  /* ...and everything that starts with "a-" to the account. */
  if(act.startsWith("a-")){ if(window.MACC && MACC.click(act, b, e.target)) render(); return; }
  switch(act){
    case "cat": document.getElementById("cat-" + b.dataset.i)?.scrollIntoView?.({behavior: calm() ? "auto" : "smooth", block:"start"}); return;
    case "open": S.g = b.dataset.g; S.screen = "setup"; window.scrollTo(0,0); break;
    case "home": S.screen = "home"; S.g = null; window.scrollTo(0,0); break;
    case "landing": S.screen = "start"; S.g = null; window.scrollTo(0,0); break;
    case "multi": S.screen = "multi"; S.g = null; window.scrollTo(0,0); break;
    case "mn": S.mn = S.mn === +b.dataset.n ? 0 : +b.dataset.n; try{ localStorage.setItem("meivi.multi.n", S.mn); }catch(e){} break;
    case "msoon": S.msoon = !S.msoon; break;
    case "rounds": S.rounds = +b.dataset.v; break;
    case "level": S.level = +b.dataset.v; break;
    case "kind": S.kinds[b.dataset.k] = !S.kinds[b.dataset.k]; break;
    case "drink": S.drink = b.dataset.v==="1"; break;
    case "del": S.players.splice(+b.dataset.i,1); saveNames(); break;
    case "front": { const i = +b.dataset.i; S.players.unshift(S.players.splice(i,1)[0]); saveNames(); break; }
    case "start": case "again": begin(); window.scrollTo(0,0); break;
    case "pick": { const i = +b.dataset.i, k = S.sel.indexOf(i); if(k>=0) S.sel.splice(k,1); else S.sel.push(i); break; }
    case "back": goBack(); window.scrollTo(0,0); break;
    case "next": {
      keep();
      const c = S.deck[S.i], key = c.k==="G" ? "b" : "a";
      S.sel.forEach(i => S.stats[i][key]++);
      const names = S.sel.map(i => S.players[i]).join(", ");
      S.flash = names ? (c.k==="G" ? T.guessedBy(names) : T.marked(names)) : "";
      return advance();
    }
    case "done": { keep(); const c = S.deck[S.i], pts = c.k==="D" ? 2 : 1; S.stats[c.p].b += pts; S.flash = `${S.players[c.p]}: +${pts}`; return advance(); }
    case "pass": { keep(); const c = S.deck[S.i]; S.stats[c.p].pass++; S.flash = T.saidPass(S.players[c.p]); return advance(); }
    case "q-pick": {
      if(S.picked !== null) return;
      S.picked = +b.dataset.i; S.deck[S.i].pick = S.picked;
      S.answered = (S.answered||0) + 1;
      if(S.deck[S.i].opts[S.picked].ok){ S.stats[S.i % S.players.length].b++; fx = true; }
      break;
    }
    case "q-next": return advance();
    case "m-ready": keep(); S.m.step++; break;
    case "m-pick": {
      keep();
      const m = S.m, I = matchInfo();
      m.ans[(m.step-1)/2] = +b.dataset.i; m.step++;
      if(m.step === 4){
        const same = m.ans[0] === m.ans[1];
        m.played = (m.played||0) + 1;
        if(same){ m.hits++; fx = true; }
        if(I.about){ const guesser = 1 - I.subj; m.asked[guesser]++; if(same) m.guess[guesser]++; }
      }
      break;
    }
    case "m-next": keep(); S.m.step = 0; S.m.ans = [null,null]; return advance();
    case "sheet": S.sheet = true; break;
    case "sheet-close": S.sheet = false; break;
    case "quit": if(game().eng !== "quiz") keep(); S.screen = "end"; S.sheet = false; S.copied = false; fx = true; break;
    case "share": shareStory(); break;
    case "story-close": if(b.classList.contains("sheet") && e.target !== b) return; S.story.sheet = false; break;
  }
  render();
});

/* ---------- Start ---------- */
/* What rooms.js needs from the app: go to a screen, draw again. */
MEIVI.app = {
  show(screen){ S.screen = screen; S.g = null; render(); window.scrollTo(0,0); },
  refresh(){ if(S.screen === "room" || S.screen === "multi") render(); },
  redraw(){ if(S.screen !== "play") render(); },
  repaint(){ render(); },
  /* For the update check (index.html): is the player on a list of games, with nothing open and nothing going on? */
  idle(){ return ["start","home","multi"].includes(S.screen) && !S.sheet && !(window.MROOM && (MROOM.room.st.mode || MROOM.ui.sheet)) && !(window.MACC && (MACC.state.sheet || MACC.state.busy)); },
  /* ...and remember the screen, so that the new release opens on the same list. */
  park(){ try{ sessionStorage.setItem("meivi.screen", S.screen); }catch(e){} },
  /* Back from signing in: to the game the player wanted ("s:<id>" one phone, "m:<id>" multiplayer). */
  open(key){
    const id = String(key).slice(2);
    if(key[0] === "s" && GAMES.some(g => g.id === id)){ S.g = id; S.screen = "setup"; }
    else if(key[0] === "m" && MULTI){ S.g = null; S.screen = "multi"; if(window.MROOM && MEIVI.mready(id)) MROOM.ui.sheet = { k: "rules", game: id }; }
    render(); window.scrollTo(0,0);
  }
};
document.documentElement.lang = CFG.lang;
document.title = T.title;
window.addEventListener("error", e => { if(!app.innerHTML) app.textContent = T.loadError(e.message); });
loadNames();
try{ const p = sessionStorage.getItem("meivi.screen"); if(p){ sessionStorage.removeItem("meivi.screen"); if(p === "home" || (p === "multi" && MULTI)) S.screen = p; } }catch(e){}
try{ render(); }catch(e){ app.textContent = T.loadError(e.message); }
if(window.MROOM) MROOM.boot();
if(window.MACC) MACC.boot();
try{
  window.claude?.hot?.snapshot?.(() => S);
  window.claude?.hot?.ready?.(d => { try{ if(d && d.screen && Array.isArray(d.players)){ S = Object.assign(S, d); render(); } }catch(e){} });
}catch(e){}

/* =====================================================================
   Meivi games: the rules of the games played on several phones.
   Every game runs on the host's phone only (see rooms.js). It keeps its state in plain data (g),
   says what each player sees (view), takes what a player sent (ans) and what the host or a timer
   ordered (cmd). Words come from lang/<lang>/multi/<id>.js as c.tx; nothing here is in any language.

   c (the context): ids, name(id), tx, ui (T.rooms), rnd(n), pick(list), shuffle(list), now(), later(ms, cmd).
   Commands every game knows: "next" (go on after a result) and "skip" (stop waiting for those who do not answer).
   ===================================================================== */
(function () {
  const G = MEIVI.mgame;
  const blank = ids => { const o = {}; ids.forEach(id => { o[id] = 0; }); return o; };
  const allIn = (g, ids) => ids.every(id => id in g.in);
  const fillIn = (g, ids) => { ids.forEach(id => { if (!(id in g.in)) g.in[id] = null; }); };
  const waitNote = (c, g, ids) => { const names = ids.filter(id => !(id in g.in)).map(c.name); return names.length ? c.ui.waiting(names.join(", ")) : ""; };
  const skipBtn = (c, g, ids) => ids.some(id => !(id in g.in)) ? [{ t: c.ui.skipWait, cmd: "skip", ghost: true, sure: true }] : [];
  /* a game may call its rounds otherwise (t.round, t.nextRound in its text: "Въпрос 3 от 15", "Следващ въпрос") */
  const nextBtn = (c, g) => [{ t: g.round >= g.rounds ? c.ui.toEnd : (c.tx.t && c.tx.t.nextRound) || c.ui.nextRound, cmd: "next" }];
  const people = (c, ids) => ids.map(id => ({ v: id, t: c.name(id) }));
  const round = (c, g) => ((c.tx.t && c.tx.t.round) || c.ui.round)(g.round, g.rounds);
  const table = (c, score, title) => ({ k: "rows", title, rows: c.ids.slice().sort((a, b) => score[b] - score[a]).map(id => ({ l: c.name(id), r: String(score[id]) })) });
  const best = (c, score) => { const top = Math.max(...c.ids.map(id => score[id])); return c.ids.filter(id => score[id] === top).map(c.name); };
  const order = (c, list) => c.shuffle(list.map((_, i) => i));
  const over = g => !!g.end;
  /* The last screen of a game is one card, and the same card is the picture a player can share (story.js).
     final() gives:
       poster  {hero, rank}: only what may be shown to other people
               hero  {kind: "name", label, name} | {kind: "ring", big, p, word, title, names} | {kind: "title", title}
               rank  {head, cols: [title], list: [{p: name, v: [value]}], plain}: best first; "plain" is a list with no places
       rest    blocks under the card, seen in the room only (the letters, the wishes, a table that does not fit the card)
       blocks  the same end for a phone that still runs an older version of the app */
  const ranked = (c, score, head, col) => ({ head, cols: [col], list: c.ids.slice().sort((a, b) => score[b] - score[a]).map(id => ({ p: c.name(id), v: [score[id]] })) });
  const listed = (c, head, ids, show, plain) => ({ head, cols: [""], plain: !!plain, list: ids.map(id => ({ p: c.name(id), v: [show(id)] })) });
  const sorted = (c, score) => c.ids.slice().sort((a, b) => score[b] - score[a]);
  const pair = c => c.ids.map(c.name).join(" " + c.ui.and + " ");

  /* ---------- 1. The mole: everyone knows the word except one ---------- */
  G("mole", {
    min: 3, max: 10, over,
    setup(c) { const g = { round: 0, rounds: 5, score: blank(c.ids), used: [] }; this.deal(c, g); return g; },
    deal(c, g) {
      g.round++;
      const sets = c.tx.words; let i = c.rnd(sets.length), tries = 0;
      while (g.used.includes(i) && tries++ < 50) i = c.rnd(sets.length);
      g.used.push(i); g.set = i; g.cat = sets[i][0]; g.word = c.pick(sets[i][1]);
      g.mole = c.pick(c.ids); g.first = c.pick(c.ids); g.phase = "talk"; g.in = {}; g.out = null; g.options = null; g.votes = null;
    },
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g), isMole = pid === g.mole, moleName = c.name(g.mole);
      const secret = isMole ? { k: "card", secret: true, tag: t.moleTag, text: t.youAreMole, sub: t.category(g.cat) }
                            : { k: "card", secret: true, tag: t.wordTag, text: g.word, sub: t.category(g.cat) };
      if (g.phase === "talk") return { sub, blocks: [secret, { k: "p", text: t.talk(c.name(g.first)) }], host: [{ t: t.toVote, cmd: "vote" }] };
      if (g.phase === "vote") return { sub, blocks: [secret, { k: "h", text: t.whoIsMole }],
        input: { k: "choice", pills: true, options: people(c, c.ids.filter(id => id !== pid)), done: g.in[pid] }, note: waitNote(c, g, c.ids), host: skipBtn(c, g, c.ids) };
      if (g.phase === "guess") return isMole
        ? { sub, blocks: [{ k: "h", text: t.caughtYou }, { k: "p", text: t.guessWord(g.cat) }], input: { k: "choice", cols: 2, options: g.options.map(w => ({ v: w, t: w })) } }
        : { sub, blocks: [{ k: "card", tag: t.caughtTag, text: t.moleCaught(moleName), sub: t.moleGuessing }], host: [{ t: c.ui.skipWait, cmd: "skip", ghost: true, sure: true }] };
      return { sub, blocks: [
          { k: "card", tag: t.wordTag, text: g.word, sub: t.moleWas(moleName) },
          { k: "p", strong: true, text: t.out[g.out](moleName) },
          { k: "rows", title: t.votesTitle, rows: c.ids.slice().sort((a, b) => g.votes[b] - g.votes[a]).map(id => ({ l: c.name(id), r: String(g.votes[id]), hot: id === g.mole })) },
          table(c, g.score, c.ui.scores)
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) {
      if (g.phase === "vote") { if (v !== pid && c.ids.includes(v)) g.in[pid] = v; if (allIn(g, c.ids)) this.count(c, g); }
      else if (g.phase === "guess" && pid === g.mole && g.options.includes(v)) this.finish(c, g, v === g.word ? "guessed" : "caught");
    },
    count(c, g) {
      const votes = blank(c.ids); c.ids.forEach(id => { if (g.in[id]) votes[g.in[id]]++; });
      g.votes = votes;
      const top = Math.max(...c.ids.map(id => votes[id])), tops = c.ids.filter(id => votes[id] === top);
      if (top > 0 && tops.length === 1 && tops[0] === g.mole) {
        g.phase = "guess";
        g.options = c.shuffle(c.shuffle(c.tx.words[g.set][1].filter(w => w !== g.word)).slice(0, 5).concat([g.word]));
      } else this.finish(c, g, "escaped");
    },
    /* Points: whoever pointed at the mole +1. The mole: +3 if it got away, +2 if caught but it named the word.
       If it was caught and missed the word, everyone else gets +1 more. */
    finish(c, g, out) {
      g.out = out; g.phase = "result";
      c.ids.forEach(id => { if (id !== g.mole && g.in[id] === g.mole) g.score[id]++; });
      if (out === "escaped") g.score[g.mole] += 3; else if (out === "guessed") g.score[g.mole] += 2;
      else c.ids.forEach(id => { if (id !== g.mole) g.score[id]++; });
    },
    cmd(c, g, name) {
      if (name === "vote" && g.phase === "talk") { g.phase = "vote"; g.in = {}; }
      else if (name === "skip" && g.phase === "vote") { fillIn(g, c.ids); this.count(c, g); }
      else if (name === "skip" && g.phase === "guess") this.finish(c, g, "caught");
      else if (name === "next" && g.phase === "result") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const win = best(c, g.score).join(", ");
      return { blocks: [{ k: "big", text: win, sub: c.ui.winner }, table(c, g.score, c.ui.scores)],
        poster: { hero: { kind: "name", label: c.ui.winner, name: win }, rank: ranked(c, g.score, c.ui.ranking, c.ui.scores) } };
    }
  });

  /* ---------- The big quiz on every phone ----------
     The same question on every phone at once. A right answer is 1 point; the fastest right answer gets 1 more,
     but only when more than one player answered right. Every phone measures its own time, from the moment the
     question showed on it to the tap (sent with the answer as ms), so a slow line does not count against a player.
     The questions are those of the one-phone quiz; the state keeps only their places (topic, question). */
  const quizTopics = c => { const s = c.tx.source && c.tx.source(); return (s && s.topics) || []; };
  G("quiz", {
    min: 2, max: 10, over,
    needs: () => !!(MEIVI.mtexts.quiz && MEIVI.mtexts.quiz.source() && MEIVI.mtexts.quiz.source().topics),
    /* as many questions as in the one-phone quiz: 30, 50 or 100 */
    rounds: [30, 50, 100], pool: c => quizTopics(c).reduce((n, t) => n + t.questions.length, 0),
    setup(c) {
      const all = []; quizTopics(c).forEach((t, ti) => t.questions.forEach((q, qi) => all.push([ti, qi])));
      const want = this.rounds.includes(c.opts && c.opts.rounds) ? c.opts.rounds : this.rounds[0];
      const g = { id: c.rnd(1e9), round: 0, rounds: Math.min(want, all.length), score: blank(c.ids), right: blank(c.ids), qs: c.shuffle(all).slice(0, want) };
      this.deal(c, g); return g;
    },
    deal(c, g) { g.round++; g.at = c.now(); g.perm = c.shuffle([0, 1, 2, 3]); g.phase = "ask"; g.in = {}; g.ms = {}; g.last = null; },
    /* the question now: its topic, its text and the four answers in the order they are shown (the right one is perm.indexOf(0)) */
    ask(c, g) {
      const [ti, qi] = g.qs[g.round - 1], tp = quizTopics(c)[ti], q = tp.questions[qi];
      return { topic: tp.name, text: q[0], opts: g.perm.map(k => q[1][k]), right: String(g.perm.indexOf(0)) };
    },
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g), Q = this.ask(c, g), mine = g.in[pid];
      if (g.phase === "ask") return { sub, key: "g" + g.id + "q" + g.round, timed: true,
        blocks: [{ k: "card", tag: Q.topic, text: Q.text }],
        input: { k: "choice", abc: true, options: Q.opts.map((o, i) => ({ v: String(i), t: o, dis: pid in g.in })), done: mine },
        note: pid in g.in ? waitNote(c, g, c.ids) : t.hint, host: skipBtn(c, g, c.ids) };
      const L = g.last, ok = mine === Q.right;
      const order = L.correct.concat(c.ids.filter(id => !L.correct.includes(id)));
      return { sub, blocks: [
          { k: "card", tag: mine == null ? t.youNone : ok ? t.youRight : t.youWrong, color: ok ? "mint" : "hot", text: Q.text, sub: t.answerIs(Q.opts[+Q.right]) },
          { k: "rows", title: t.who, rows: order.map(id => ({ l: c.name(id),
            r: L.correct.includes(id) ? t.rowRight(t.secs(g.ms[id]), id === L.fast ? 2 : 1) : g.in[id] == null ? t.noAnswer : t.rowWrong, ok: L.correct.includes(id), dim: !L.correct.includes(id) })) },
          { k: "p", strong: true, text: L.fast ? t.fastest(c.name(L.fast)) : L.correct.length === 1 ? t.onlyOne(c.name(L.correct[0])) : t.nobody },
          table(c, g.score, c.ui.scores)
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v, ms) {
      if (g.phase !== "ask" || pid in g.in || !/^[0-3]$/.test(String(v))) return;
      g.in[pid] = String(v);
      /* the phone's own time; without it (or if it makes no sense), the time the host received the answer */
      const own = +ms, host = c.now() - g.at;
      g.ms[pid] = own > 0 && own < 600000 ? Math.round(own) : Math.max(0, host);
      if (allIn(g, c.ids)) this.score(c, g);
    },
    score(c, g) {
      const right = this.ask(c, g).right;
      const correct = c.ids.filter(id => g.in[id] === right).sort((a, b) => g.ms[a] - g.ms[b]);
      correct.forEach(id => { g.score[id]++; g.right[id]++; });
      const fast = correct.length >= 2 ? correct[0] : null;
      if (fast) g.score[fast]++;
      g.last = { correct, fast }; g.phase = "result";
    },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "ask") { fillIn(g, c.ids); this.score(c, g); }
      else if (name === "next" && g.phase === "result") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const t = c.tx.t, win = best(c, g.score).join(", ");
      const order = c.ids.slice().sort((a, b) => g.score[b] - g.score[a] || g.right[b] - g.right[a]);
      return { blocks: [{ k: "big", text: win, sub: c.ui.winner }, table(c, g.score, c.ui.scores)],
        poster: { hero: { kind: "name", label: c.ui.winner, name: win },
                  rank: { head: c.ui.ranking, cols: [t.colRight, c.ui.scores], list: order.map(id => ({ p: c.name(id), v: [g.right[id], g.score[id]] })) } } };
    }
  });

  /* ---------- 2. Conquer the country: reach in secret for a place nobody else wants ----------
     The map of the country is data (c.tx.map(): the capital, the regions, their municipalities, one village per
     municipality). A place is named by an id: "c" the capital, "r3" region 3, "m3.5" municipality 5 of region 3,
     "v3.5" the village of that municipality. The capital and the regions are open from the start; a municipality
     opens once its region is taken, a village once its municipality is taken. Points are in the text (points).

     A free place goes to the only player who reached for it. A place that someone holds can be attacked: the
     attacker and the holder get the same question (one question for all the attacks of a round, taken from the
     one-phone quiz). Attacker right and holder wrong, or both right and the attacker faster: the place and its
     points change hands. Holder right (and faster, if both are right): the holder keeps it and gets its points.
     Both wrong: both lose its points. Two players attacking the same place clash, like on a free place.

     Every fourth round has an event (CQ_EVENTS) and in the last three rounds everything counts double.
     A player who holds a regional town and all its municipalities has a bonus for as long as that lasts;
     at the end the largest group of neighbouring regions (by their towns, the capital counts) gets one more. */
  const CQ_EVENTS = [
    { id: "villages", kind: "v", x: 3 },          /* villages count three times */
    { id: "munis", kind: "m", x: 2 },             /* municipalities count double */
    { id: "sea", group: "sea", x: 2 },            /* everything in these regions counts double */
    { id: "danube", group: "danube", x: 2 },
    { id: "north", group: "north", closed: true },   /* nothing can be chosen in these regions */
    { id: "south", group: "south", closed: true },
    { id: "peace", peace: true }                  /* no attacks */
  ];
  const cq = {
    /* the place an id names: {k, r, j, n (name), up (id of the place that opens it)} or null */
    place(M, id) {
      const m = /^(c)$|^r(\d+)$|^([mv])(\d+)\.(\d+)$/.exec(String(id)); if (!m) return null;
      if (m[1]) return { k: "c", n: M.cap.n, at: "c" };
      if (m[2] != null) { const R = M.regs[+m[2]]; return R ? { k: "r", r: +m[2], at: +m[2], n: R.n, area: !!R.area } : null; }
      const R = M.regs[+m[4]], P = R && R.ms[+m[5]]; if (!P) return null;
      if (m[3] === "m") return { k: "m", r: +m[4], at: +m[4], j: +m[5], n: P.n, up: "r" + m[4] };
      return P.v ? { k: "v", r: +m[4], at: +m[4], j: +m[5], n: P.v, up: "m" + m[4] + "." + m[5] } : null;
    },
    name(c, M, id) { const p = cq.place(M, id); return c.tx.t.place(p.k, p.n, p.area); },
    finale: g => g.round > g.rounds - 3,
    questions(c) { const s = c.tx.source && c.tx.source(); return (s && s.topics) || []; },
    /* what a place is worth this round */
    val(c, g, M, id) {
      const p = cq.place(M, id), e = g.ev; let v = c.tx.points[p.k];
      if (e && e.x && (e.kind === p.k || (e.regs && e.regs.includes(p.at)))) v *= e.x;
      return v * (cq.finale(g) ? 2 : 1);
    },
    /* what a player may do with a place now: "claim" a free one, "attack" one that another holds, or nothing */
    can(c, g, M, pid, id) {
      const p = cq.place(M, id), e = g.ev; if (!p) return null;
      if (e && e.closed && e.regs.includes(p.at)) return null;
      const o = g.own[id];
      if (o) return o === pid || (e && e.peace) || !cq.questions(c).length ? null : "attack";
      return !p.up || g.own[p.up] ? "claim" : null;
    },
    /* every free place that can be taken right now */
    open(M, g) {
      const out = []; if (!g.own.c) out.push("c");
      M.regs.forEach((R, r) => {
        if (!g.own["r" + r]) return out.push("r" + r);
        R.ms.forEach((P, j) => { const m = "m" + r + "." + j; if (!g.own[m]) out.push(m); else if (P.v && !g.own["v" + r + "." + j]) out.push("v" + r + "." + j); });
      });
      return out;
    },
    /* what the phones draw: who holds what, as the number of the player (its colour) */
    own(c, g) { const o = {}; Object.keys(g.own).forEach(id => { o[id] = c.ids.indexOf(g.own[id]); }); return o; },
    /* the regions held whole (the town and every municipality), by player */
    whole(c, M, g) {
      const out = {}; c.ids.forEach(id => { out[id] = []; });
      M.regs.forEach((R, r) => { const o = g.own["r" + r]; if (o && out[o] && R.ms.every((P, j) => g.own["m" + r + "." + j] === o)) out[o].push(r); });
      return out;
    },
    /* the points of a player: what was won and lost, and the bonus for the regions held whole right now */
    totals(c, M, g) { const w = cq.whole(c, M, g), t = {}; c.ids.forEach(id => { t[id] = g.score[id] + w[id].length * c.tx.points.region; }); return t; },
    /* the largest group of neighbouring regions a player holds (the towns; the capital counts as one) */
    kingdom(M, g, pid) {
      const mine = k => g.own[k === "c" ? "c" : "r" + k] === pid, seen = {}; let best = 0;
      ["c"].concat(M.regs.map((R, r) => r)).forEach(k => {
        if (!mine(k) || seen[k]) return;
        let n = 0; const todo = [k]; seen[k] = 1;
        while (todo.length) { const x = todo.pop(); n++; (x === "c" ? M.cap.adj : M.regs[x].adj).forEach(y => { if (mine(y) && !seen[y]) { seen[y] = 1; todo.push(y); } }); }
        best = Math.max(best, n);
      });
      return best;
    },
    /* the event of a round: every fourth round, not in the last three; one that makes sense on the map as it is */
    event(c, g, M) {
      if (g.round % 4 || cq.finale(g)) return null;
      const open = cq.open(M, g), fits = e => {
        if (e.group && !(M.groups && M.groups[e.group])) return false;
        if (e.kind) return open.some(id => id[0] === e.kind);
        if (e.closed) return open.some(id => !M.groups[e.group].includes(cq.place(M, id).at));
        if (e.peace) return Object.keys(g.own).length > 0 && cq.questions(c).length > 0;
        return true;
      };
      for (let n = 0; n < g.evs.length; n++) {
        const e = CQ_EVENTS[g.evs[(g.evi + n) % g.evs.length]];
        if (fits(e)) { g.evi = (g.evi + n + 1) % g.evs.length; return { id: e.id, kind: e.kind, x: e.x, regs: e.group ? M.groups[e.group] : undefined, closed: e.closed, peace: e.peace }; }
      }
      return null;
    }
  };
  G("conquer", {
    min: 3, max: 8, over, rounds: [15, 30, 50],
    needs: () => !!(MEIVI.mtexts.conquer && MEIVI.mtexts.conquer.map && MEIVI.mtexts.conquer.map()),
    setup(c) {
      const rounds = this.rounds.includes(c.opts && c.opts.rounds) ? c.opts.rounds : this.rounds[0];
      const g = { id: c.rnd(1e9), round: 0, rounds, score: blank(c.ids), own: {}, evs: c.shuffle(CQ_EVENTS.map((e, i) => i)), evi: 0, asked: [] };
      this.deal(c, g); return g;
    },
    deal(c, g) { g.round++; g.phase = "pick"; g.in = {}; g.last = null; g.duels = null; g.q = null; g.ev = cq.event(c, g, c.tx.map()); },
    /* the question of the round: its text and the four answers in the order they are shown */
    ask(c, g) {
      const tp = cq.questions(c)[g.q.at[0]], q = tp.questions[g.q.at[1]];
      return { topic: tp.name, text: q[0], opts: g.q.perm.map(k => q[1][k]), right: String(g.q.perm.indexOf(0)) };
    },
    fighters: g => g.duels.reduce((all, d) => all.concat([d.a, d.d].filter(id => !all.includes(id))), []),
    view(c, g, pid) {
      const t = c.tx.t, M = c.tx.map(), fin = cq.finale(g), sub = round(c, g) + (fin ? " · " + t.doubleTag : ""), tot = cq.totals(c, M, g);
      const map = { own: cq.own(c, g), names: c.ids.map(c.name), scores: c.ids.map(id => tot[id]), me: c.ids.indexOf(pid), pts: c.tx.points,
        ev: g.ev || undefined, fin, war: !(g.ev && g.ev.peace) && cq.questions(c).length > 0 };
      const news = [].concat(g.ev ? [{ k: "p", strong: true, text: t.event(t.events[g.ev.id]) }] : [], fin ? [{ k: "p", strong: true, text: t.double }] : []);
      if (g.phase === "pick") return { sub, key: "pick" + g.id + "." + g.round, blocks: [{ k: "h", text: t.pick }].concat(news),
        input: Object.assign({ k: "map", done: g.in[pid] || null }, map), note: waitNote(c, g, c.ids), host: skipBtn(c, g, c.ids) };
      if (g.phase === "duel") {
        const Q = this.ask(c, g), F = this.fighters(g), inIt = F.includes(pid), wait = F.filter(id => !(id in g.q.in)).map(c.name);
        const fights = { k: "rows", keep: true, rows: g.duels.map(d => ({ l: c.name(d.a), r: t.attacks(cq.name(c, M, d.p), c.name(d.d), d.w), hot: d.a === pid || d.d === pid })) };
        return { sub, key: "duel" + g.id + "." + g.round, timed: inIt, blocks: [{ k: "h", text: t.duelTitle }, fights, { k: "card", tag: Q.topic, text: Q.text }],
          input: inIt ? { k: "choice", abc: true, options: Q.opts.map((o, i) => ({ v: String(i), t: o, dis: pid in g.q.in })), done: g.q.in[pid] } : null,
          note: inIt && !(pid in g.q.in) ? t.duelHint : wait.length ? c.ui.waiting(wait.join(", ")) : "",
          host: wait.length ? [{ t: c.ui.skipWait, cmd: "skip", ghost: true, sure: true }] : [] };
      }
      const Q = g.q ? this.ask(c, g) : null;
      return { sub, key: "res" + g.id + "." + g.round, blocks: [{ k: "h", text: t.result }].concat(
          Q ? [{ k: "p", text: t.answerWas(Q.text, Q.opts[+Q.right]) }] : [],
          [{ k: "rows", keep: true, rows: g.last.map(r => ({ l: c.name(r.id), r: t.did[r.k](r.p ? cq.name(c, M, r.p) : r.n, r.w, r.vs ? c.name(r.vs) : ""), ok: !!r.good, hot: r.good === false, dim: r.k === "none" })) },
           /* the points stand next to the names under the map, so the screen stays short: this game has many rounds */
           Object.assign({ k: "map", fresh: g.last.filter(r => r.fresh).map(r => r.p) }, map)]
        ), host: nextBtn(c, g) };
    },
    ans(c, g, pid, v, ms) {
      if (g.phase === "pick") {
        if (!cq.can(c, g, c.tx.map(), pid, v)) return;
        g.in[pid] = String(v); if (allIn(g, c.ids)) this.resolve(c, g);
      } else if (g.phase === "duel") {
        const F = this.fighters(g);
        if (!F.includes(pid) || pid in g.q.in || !/^[0-3]$/.test(String(v))) return;
        g.q.in[pid] = String(v);
        /* the phone's own time; without it (or if it makes no sense), the time the host received the answer */
        const own = +ms, host = c.now() - g.q.t0;
        g.q.ms[pid] = own > 0 && own < 600000 ? Math.round(own) : Math.max(0, host);
        if (F.every(id => id in g.q.in)) this.settle(c, g);
      }
    },
    /* A free place goes to the only player who reached for it; an attack by one player alone becomes a duel. */
    resolve(c, g) {
      const M = c.tx.map(), by = {}; c.ids.forEach(id => { const p = g.in[id]; if (p != null) (by[p] = by[p] || []).push(id); });
      g.was = cq.whole(c, M, g); g.last = []; g.duels = [];
      const held = Object.assign({}, g.own);     /* who held what when the choices were made */
      c.ids.forEach(id => {
        const p = g.in[id]; if (p == null) return g.last.push({ id, k: "none" });
        const solo = by[p].length === 1, w = cq.val(c, g, M, p);
        if (held[p]) { if (solo) g.duels.push({ a: id, d: held[p], p, w }); else g.last.push({ id, k: "aclash", p }); }
        else if (solo) { g.own[p] = id; g.score[id] += w; g.last.push({ id, k: "took", p, w, good: true, fresh: true }); }
        else g.last.push({ id, k: "clash", p });
      });
      if (!g.duels.length) return this.finish(c, g);
      /* one question for all the attacks of the round, not asked before in this game */
      const all = []; cq.questions(c).forEach((tp, ti) => tp.questions.forEach((q, qi) => all.push([ti, qi])));
      let left = all.filter(a => !g.asked.includes(a[0] + "." + a[1])); if (!left.length) { g.asked = []; left = all; }
      const at = c.pick(left); g.asked.push(at[0] + "." + at[1]);
      g.q = { at, perm: c.shuffle([0, 1, 2, 3]), t0: c.now(), in: {}, ms: {} }; g.phase = "duel";
    },
    settle(c, g) {
      const right = this.ask(c, g).right, ok = id => g.q.in[id] === right;
      g.duels.forEach(d => {
        const { a, p, w } = d, h = d.d;
        if (ok(a) && (!ok(h) || g.q.ms[a] < g.q.ms[h])) {
          g.own[p] = a; g.score[a] += w; g.score[h] -= w;
          g.last.push({ id: a, k: "won", p, w, vs: h, good: true, fresh: true }, { id: h, k: "lost", p, w, vs: a, good: false });
        } else if (ok(h)) {
          g.score[h] += w;
          g.last.push({ id: a, k: "failed", p, w, vs: h }, { id: h, k: "held", p, w, vs: a, good: true });
        } else {
          g.score[a] -= w; g.score[h] -= w;
          g.last.push({ id: a, k: "both", p, w, vs: h, good: false }, { id: h, k: "both2", p, w, vs: a, good: false });
        }
      });
      this.finish(c, g);
    },
    /* a region that became whole in this round, or stopped being whole */
    finish(c, g) {
      const M = c.tx.map(), now = cq.whole(c, M, g), b = c.tx.points.region;
      c.ids.forEach(id => {
        now[id].filter(r => !g.was[id].includes(r)).forEach(r => g.last.push({ id, k: "whole", n: M.regs[r].n, w: b, good: true }));
        g.was[id].filter(r => !now[id].includes(r)).forEach(r => g.last.push({ id, k: "broke", n: M.regs[r].n, w: b, good: false }));
      });
      g.was = null; g.phase = "result";
    },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "pick") { fillIn(g, c.ids); this.resolve(c, g); }
      else if (name === "skip" && g.phase === "duel") { this.fighters(g).forEach(id => { if (!(id in g.q.in)) g.q.in[id] = null; }); this.settle(c, g); }
      else if (name === "next" && g.phase === "result") {
        if (g.round >= g.rounds || !cq.open(c.tx.map(), g).length) g.end = true; else this.deal(c, g);
      }
    },
    final(c, g) {
      const t = c.tx.t, M = c.tx.map(), P = c.tx.points, n = {}, tot = cq.totals(c, M, g), whole = cq.whole(c, M, g);
      c.ids.forEach(id => { n[id] = { c: 0, r: 0, m: 0, v: 0, whole: whole[id].length }; });
      Object.keys(g.own).forEach(id => { if (n[g.own[id]]) n[g.own[id]][id[0]]++; });
      /* the largest kingdom: at least two neighbouring regions; everyone who has that many gets the bonus */
      const size = {}; c.ids.forEach(id => { size[id] = cq.kingdom(M, g, id); });
      const top = Math.max(...c.ids.map(id => size[id])), kings = top >= 2 ? c.ids.filter(id => size[id] === top) : [];
      kings.forEach(id => { tot[id] += P.kingdom; });
      const win = best(c, tot).join(", "), map = { k: "map", own: cq.own(c, g), names: c.ids.map(c.name), scores: c.ids.map(id => tot[id]), pts: P };
      const king = { k: "p", strong: true, text: kings.length ? t.kingdom(kings.map(c.name).join(", "), top, P.kingdom) : t.noKingdom };
      const owned = { k: "rows", keep: true, title: t.lands, rows: sorted(c, tot).map(id => ({ l: c.name(id), r: t.holds(n[id]) || t.noLand })) };
      return { blocks: [{ k: "big", text: win, sub: t.ruler }, table(c, tot, c.ui.scores), king, owned],
        poster: { hero: { kind: "name", label: t.ruler, name: win }, rank: ranked(c, tot, c.ui.ranking, c.ui.scores) }, rest: [map, king, owned] };
    }
  });

  /* ---------- 3. Who of us: everyone points at someone in secret ---------- */
  G("whoofus", {
    min: 3, max: 10, over,
    /* the host chooses how many questions: 15, 30 or 50 */
    rounds: [15, 30, 50], pool: c => c.tx.questions.length,
    setup(c) {
      const rounds = this.rounds.includes(c.opts && c.opts.rounds) ? c.opts.rounds : this.rounds[0];
      const g = { round: 0, rounds: Math.min(rounds, c.tx.questions.length), score: blank(c.ids), pointed: blank(c.ids), order: order(c, c.tx.questions) };
      this.deal(c, g); return g;
    },
    deal(c, g) { g.round++; g.q = c.tx.questions[g.order[(g.round - 1) % g.order.length]]; g.phase = "vote"; g.in = {}; g.votes = null; g.tops = []; },
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g), card = { k: "card", tag: t.lead, text: g.q };
      if (g.phase === "vote") return { sub, blocks: [card], input: { k: "choice", pills: true, options: people(c, c.ids), done: g.in[pid] }, note: waitNote(c, g, c.ids), host: skipBtn(c, g, c.ids) };
      return { sub, blocks: [card,
          { k: "p", strong: true, text: g.tops.length ? t.top(g.tops.map(c.name).join(", ")) : t.noVotes },
          { k: "rows", title: t.votesTitle, rows: c.ids.slice().sort((a, b) => g.votes[b] - g.votes[a]).map(id => ({ l: c.name(id), r: String(g.votes[id]), hot: g.tops.includes(id) })) },
          table(c, g.score, t.scoreTitle)
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) { if (g.phase !== "vote" || !c.ids.includes(v)) return; g.in[pid] = v; if (allIn(g, c.ids)) this.count(c, g); },
    /* A point for everyone who pointed at the person the company chose. */
    count(c, g) {
      const votes = blank(c.ids); c.ids.forEach(id => { if (g.in[id]) votes[g.in[id]]++; });
      const top = Math.max(...c.ids.map(id => votes[id]));
      g.votes = votes; g.tops = top > 0 ? c.ids.filter(id => votes[id] === top) : [];
      g.tops.forEach(id => { g.pointed[id]++; });
      c.ids.forEach(id => { if (g.tops.includes(g.in[id])) g.score[id]++; });
      g.phase = "result";
    },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "vote") { fillIn(g, c.ids); this.count(c, g); }
      else if (name === "next" && g.phase === "result") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const top = best(c, g.pointed).join(", ");
      return { blocks: [{ k: "big", text: top, sub: c.tx.t.mostPointed }, table(c, g.score, c.tx.t.scoreTitle)],
        poster: { hero: { kind: "name", label: c.tx.t.mostPointed, name: top }, rank: ranked(c, g.score, c.tx.t.scoreTitle, c.ui.scores) } };
    }
  });

  /* ---------- 4. The bomb: say a word, pass it on, do not hold it when it goes off ---------- */
  G("bomb", {
    min: 3, max: 10, over,
    setup(c) { const g = { round: 0, rounds: 5, strikes: blank(c.ids), order: c.shuffle(c.ids), tasks: order(c, c.tx.tasks) }; this.deal(c, g); return g; },
    deal(c, g) {
      g.round++; g.task = c.tx.tasks[g.tasks[(g.round - 1) % g.tasks.length]];
      g.holder = c.pick(g.order); g.phase = "play"; g.passes = 0;
      const fuse = 15000 + c.rnd(30000);          /* nobody sees how long: 15 to 45 seconds */
      g.boomAt = c.now() + fuse; c.later(fuse, "boom");
    },
    wake(c, g) { if (g.phase === "play") c.later(Math.max(1500, g.boomAt - c.now()), "boom"); },
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g);
      if (g.phase === "play") {
        const mine = pid === g.holder, next = c.name(g.order[(g.order.indexOf(g.holder) + 1) % g.order.length]);
        return { sub, key: "bomb" + g.round, blocks: [
            { k: "card", color: mine ? "hot" : "sky", tag: mine ? t.yours : t.at(c.name(g.holder)), text: g.task, sub: mine ? t.sayAndPass : t.listen },
            { k: "chips", items: g.order.map(id => ({ t: c.name(id), on: id === g.holder })) }
          ], input: mine ? { k: "btn", t: t.pass(next), v: "pass" } : null };
      }
      return { sub, blocks: [{ k: "big", text: t.boom, sub: t.boomAt(c.name(g.lost)) },
          { k: "rows", title: t.strikesTitle, rows: c.ids.slice().sort((a, b) => g.strikes[a] - g.strikes[b]).map(id => ({ l: c.name(id), r: String(g.strikes[id]), hot: id === g.lost })) }
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) {
      if (g.phase === "play" && pid === g.holder && v === "pass") { g.holder = g.order[(g.order.indexOf(pid) + 1) % g.order.length]; g.passes++; }
    },
    cmd(c, g, name) {
      if (name === "boom" && g.phase === "play") { g.phase = "boom"; g.lost = g.holder; g.strikes[g.holder]++; }
      else if (name === "next" && g.phase === "boom") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const low = Math.min(...c.ids.map(id => g.strikes[id])), names = c.ids.filter(id => g.strikes[id] === low).map(c.name);
      const order = c.ids.slice().sort((a, b) => g.strikes[a] - g.strikes[b]);
      return { blocks: [{ k: "big", text: names.join(", "), sub: c.tx.t.survivor },
        { k: "rows", title: c.tx.t.strikesTitle, rows: order.map(id => ({ l: c.name(id), r: String(g.strikes[id]) })) }],
        poster: { hero: { kind: "name", label: c.tx.t.survivor, name: names.join(", ") }, rank: listed(c, c.tx.t.strikesTitle, order, id => g.strikes[id]) } };
    }
  });

  /* ---------- 5. The night of the detectives: killers among the witnesses ---------- */
  G("detectives", {
    min: 5, max: 10, over,
    setup(c) {
      const ids = c.shuffle(c.ids), k = ids.length >= 7 ? 2 : 1, roles = {};
      ids.forEach((id, i) => { roles[id] = i < k ? "killer" : i === k ? "detective" : "citizen"; });
      return { roles, alive: c.ids.slice(), phase: "roles", night: 0, in: {}, notes: [], event: null, winner: null };
    },
    /* The game ends when no killer is left, or when the killers are as many as the others. */
    check(g) {
      const k = g.alive.filter(id => g.roles[id] === "killer").length, rest = g.alive.length - k;
      if (k === 0) g.winner = "good"; else if (k >= rest) g.winner = "bad";
      if (g.winner) g.end = true;
      return !!g.winner;
    },
    view(c, g, pid) {
      const t = c.tx.t, role = g.roles[pid], alive = g.alive.includes(pid), others = g.alive.filter(id => id !== pid);
      const sub = g.night ? t.night(g.night) : t.intro;
      if (g.phase === "roles") {
        const mates = c.ids.filter(id => g.roles[id] === "killer" && id !== pid).map(c.name);
        return { sub, blocks: [{ k: "card", secret: true, tag: t.yourRole, text: t.roles[role], sub: t.roleInfo[role] + (role === "killer" && mates.length ? " " + t.partner(mates.join(", ")) : "") }, { k: "p", text: t.keepSecret }],
          host: [{ t: t.startNight, cmd: "night" }] };
      }
      if (g.phase === "night") {
        if (!alive) return { sub, blocks: [{ k: "p", text: t.dead }] };
        const targets = role === "killer" ? others.filter(id => g.roles[id] !== "killer") : others;
        return { sub, blocks: [{ k: "card", secret: true, tag: t.roles[role], text: t.ask[role], sub: t.nightHint }],
          input: { k: "choice", pills: true, options: people(c, targets), done: g.in[pid] }, note: waitNote(c, g, g.alive), host: skipBtn(c, g, g.alive) };
      }
      const chips = { k: "chips", title: t.aliveTitle, items: c.ids.map(id => ({ t: c.name(id), dim: !g.alive.includes(id) })) };
      if (g.phase === "day") {
        const v = g.event.victim, blocks = [{ k: "card", tag: t.morning, text: v ? t.killed(c.name(v)) : t.nobodyKilled, sub: v ? t.was(t.roles[g.roles[v]]) : "" }];
        if (role === "detective" && alive) g.notes.forEach(n => blocks.push({ k: "p", strong: true, text: n.killer ? t.isKiller(c.name(n.id)) : t.notKiller(c.name(n.id)) }));
        if (!alive) return { sub, blocks: blocks.concat([{ k: "p", text: t.dead }, chips]) };
        return { sub, blocks: blocks.concat([{ k: "h", text: t.arrestAsk }, { k: "p", text: t.talk }]),
          input: { k: "choice", pills: true, options: people(c, others).concat([{ v: "none", t: t.nobody }]), done: g.in[pid] }, note: waitNote(c, g, g.alive), host: skipBtn(c, g, g.alive) };
      }
      const a = g.event.arrested;
      return { sub, blocks: [{ k: "card", tag: t.verdict, color: a && g.roles[a] === "killer" ? "mint" : "hot", text: a ? t.arrested(c.name(a)) : t.noArrest, sub: a ? (g.roles[a] === "killer" ? t.wasKiller : t.wasInnocent(t.roles[g.roles[a]])) : "" }, chips],
        host: [{ t: t.nextNight, cmd: "night" }] };
    },
    ans(c, g, pid, v) {
      if (!g.alive.includes(pid)) return;
      if (g.phase === "night") {
        if (g.alive.includes(v) && v !== pid && !(g.roles[pid] === "killer" && g.roles[v] === "killer")) g.in[pid] = v;
        if (allIn(g, g.alive)) this.dawn(g);
      } else if (g.phase === "day") {
        if (v === "none" || (g.alive.includes(v) && v !== pid)) g.in[pid] = v;
        if (allIn(g, g.alive)) this.judge(g);
      }
    },
    dawn(g) {
      const picks = g.alive.filter(id => g.roles[id] === "killer").map(id => g.in[id]).filter(Boolean), n = {};
      picks.forEach(p => { n[p] = (n[p] || 0) + 1; });
      const victim = picks.length ? picks.slice().sort((x, y) => n[y] - n[x])[0] : null;
      const det = g.alive.find(id => g.roles[id] === "detective");
      if (det && g.in[det]) g.notes.push({ id: g.in[det], killer: g.roles[g.in[det]] === "killer" });
      if (victim) g.alive = g.alive.filter(id => id !== victim);
      g.event = { victim }; g.in = {};
      if (!this.check(g)) g.phase = "day";
    },
    judge(g) {
      const n = {}; g.alive.forEach(id => { const v = g.in[id]; if (v && v !== "none") n[v] = (n[v] || 0) + 1; });
      const ids = Object.keys(n), top = Math.max(0, ...ids.map(id => n[id])), tops = ids.filter(id => n[id] === top);
      const arrested = top > 0 && tops.length === 1 ? tops[0] : null;
      if (arrested) g.alive = g.alive.filter(id => id !== arrested);
      g.event = { arrested }; g.in = {}; g.phase = "verdict"; this.check(g);
    },
    cmd(c, g, name) {
      if (name === "night" && (g.phase === "roles" || g.phase === "verdict")) { g.night++; g.phase = "night"; g.in = {}; }
      else if (name === "skip" && g.phase === "night") { fillIn(g, g.alive); this.dawn(g); }
      else if (name === "skip" && g.phase === "day") { fillIn(g, g.alive); this.judge(g); }
    },
    final(c, g) {
      const t = c.tx.t, e = g.event || {};
      const last = e.victim ? t.killed(c.name(e.victim)) : e.arrested ? t.arrested(c.name(e.arrested)) : "";
      const out = g.winner === "good" ? t.goodWin : g.winner === "bad" ? t.badWin : t.stopped;
      return { blocks: [{ k: "big", text: out, sub: last },
        { k: "rows", title: t.whoWas, rows: c.ids.map(id => ({ l: c.name(id), r: t.roles[g.roles[id]], hot: g.roles[id] === "killer", dim: !g.alive.includes(id) })) }],
        poster: { hero: last ? { kind: "name", label: last, name: out } : { kind: "title", title: out }, rank: listed(c, t.whoWas, c.ids, id => t.roles[g.roles[id]], true) } };
    }
  });

  /* ---------- 6. The mirror (for two): one answers about themselves, the other guesses ---------- */
  G("mirror", {
    min: 2, max: 2, over,
    setup(c) { const g = { round: 0, rounds: 10, score: blank(c.ids), asked: blank(c.ids), order: order(c, c.tx.questions) }; this.deal(c, g); return g; },
    deal(c, g) { g.round++; g.q = c.tx.questions[g.order[(g.round - 1) % g.order.length]]; g.subject = c.ids[(g.round - 1) % 2]; g.phase = "ask"; g.in = {}; g.same = false; },
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g), who = c.name(g.subject), other = c.ids.find(id => id !== g.subject), about = g.q[1].replace("{n}", who);
      const opt = v => v == null ? t.noAnswer : g.q[2][+v];
      if (g.phase === "ask") {
        const me = pid === g.subject;
        return { sub, blocks: [{ k: "card", tag: me ? t.aboutYou : t.guess(who), text: me ? g.q[0] : about }],
          input: { k: "choice", options: g.q[2].map((o, i) => ({ v: String(i), t: o })), done: g.in[pid] }, note: waitNote(c, g, c.ids), host: skipBtn(c, g, c.ids) };
      }
      return { sub, blocks: [
          { k: "card", tag: g.same ? t.match : t.miss, color: g.same ? "mint" : "hot", text: about },
          { k: "rows", rows: [{ l: t.answerOf(who), r: opt(g.in[g.subject]) }, { l: t.guessOf(c.name(other)), r: opt(g.in[other]), hot: g.same }] },
          { k: "rows", title: t.scoreTitle, rows: c.ids.map(id => ({ l: c.name(id), r: t.guessed(g.score[id], g.asked[id]) })) }
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) {
      if (g.phase !== "ask" || !(+v >= 0 && +v < g.q[2].length)) return;
      g.in[pid] = String(+v); if (allIn(g, c.ids)) this.compare(c, g);
    },
    compare(c, g) {
      const other = c.ids.find(id => id !== g.subject);
      g.same = g.in[g.subject] != null && g.in[g.subject] === g.in[other];
      g.asked[other]++; if (g.same) g.score[other]++;
      g.phase = "result";
    },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "ask") { fillIn(g, c.ids); this.compare(c, g); }
      else if (name === "next" && g.phase === "result") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const t = c.tx.t, hit = c.ids.reduce((n, id) => n + g.score[id], 0), all = c.ids.reduce((n, id) => n + g.asked[id], 0), pct = all ? Math.round(hit / all * 100) : 0;
      return { blocks: [{ k: "big", text: pct + "%", sub: t.tier(pct) }, { k: "rows", title: t.scoreTitle, rows: c.ids.map(id => ({ l: c.name(id), r: t.guessed(g.score[id], g.asked[id]) })) }],
        poster: { hero: { kind: "ring", big: pct + "%", p: pct, word: t.word, title: t.tier(pct), names: pair(c) }, rank: listed(c, t.scoreTitle, sorted(c, g.score), id => t.guessed(g.score[id], g.asked[id])) } };
    }
  });

  /* ---------- 7. One mind (for two): pick the same thing without a word ---------- */
  G("onemind", {
    min: 2, max: 2, over,
    /* the host chooses 15, 30 or 50 rounds (only as many as there are questions); the goal is 6 of every 10 */
    rounds: [15, 30, 50], pool: c => c.tx.prompts.length,
    setup(c) {
      const rounds = this.rounds.includes(c.opts && c.opts.rounds) ? c.opts.rounds : this.rounds[0];
      const g = { round: 0, rounds, goal: Math.ceil(rounds * 0.6), hits: 0, order: order(c, c.tx.prompts) }; this.deal(c, g); return g;
    },
    deal(c, g) {
      g.round++; g.q = c.tx.prompts[g.order[(g.round - 1) % g.order.length]]; g.phase = "ask"; g.in = {}; g.same = false;
      g.opts = {}; c.ids.forEach(id => { g.opts[id] = c.shuffle(g.q[1]); });   /* each sees the choices in another order */
    },
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g);
      if (g.phase === "ask") return { sub, blocks: [{ k: "card", tag: t.tag, text: g.q[0], sub: t.noTalking }],
        input: { k: "choice", cols: 2, options: g.opts[pid].map(o => ({ v: o, t: o })), done: g.in[pid] }, note: waitNote(c, g, c.ids), host: skipBtn(c, g, c.ids) };
      return { sub, blocks: [
          { k: "card", tag: g.same ? t.match : t.miss, color: g.same ? "mint" : "hot", text: g.q[0] },
          { k: "rows", rows: c.ids.map(id => ({ l: c.name(id), r: g.in[id] == null ? t.noAnswer : g.in[id], hot: g.same })) },
          { k: "p", strong: true, text: t.progress(g.hits, g.goal) }
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) { if (g.phase !== "ask" || !g.q[1].includes(v)) return; g.in[pid] = v; if (allIn(g, c.ids)) this.compare(c, g); },
    compare(c, g) { g.same = g.in[c.ids[0]] != null && g.in[c.ids[0]] === g.in[c.ids[1]]; if (g.same) g.hits++; g.phase = "result"; },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "ask") { fillIn(g, c.ids); this.compare(c, g); }
      else if (name === "next" && g.phase === "result") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const t = c.tx.t, out = g.hits >= g.goal ? t.won : t.lost;
      const pct = Math.round(g.hits / g.rounds * 100);
      return { blocks: [{ k: "big", text: g.hits + " / " + g.rounds, sub: out }, { k: "p", text: t.tier(pct) }],
        poster: { hero: { kind: "ring", big: g.hits + "/" + g.rounds, p: pct, word: out, title: t.tier(pct), names: pair(c) } } };
    }
  });

  /* ---------- 9. Letters in a bottle (for two): both write, both read at the same moment ---------- */
  G("letters", {
    min: 2, max: 2, over,
    /* three modes, chosen by the host: how many letters a game has, and from which beginnings (never more than there are) */
    modes: [{ id: "light", rounds: 20 }, { id: "medium", rounds: 14 }, { id: "deep", rounds: 7 }],
    /* g.id tells one game from the next in the same room, so that every animation plays once (rooms.js) */
    setup(c) {
      const m = this.modes.find(x => x.id === (c.opts && c.opts.mode)) || this.modes[0], list = c.tx.prompts[m.id];
      const g = { id: c.rnd(1e9), mode: m.id, round: 0, rounds: Math.min(m.rounds, list.length), log: [], order: order(c, list) }; this.deal(c, g); return g;
    },
    deal(c, g) { const list = c.tx.prompts[g.mode]; g.round++; g.q = list[g.order[(g.round - 1) % g.order.length]]; g.phase = "write"; g.in = {}; },
    /* Writing on a sheet of paper; a sent letter goes into a bottle on the sea, and the bottle of the other floats in when it is sent.
       When both are in, each opens the bottle of the other on the shore (see the blocks "sea" and "shore" in rooms.js). */
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g), other = c.ids.find(id => id !== pid), card = { k: "card", tag: t.tag, text: g.q }, key = "g" + g.id + "r" + g.round;
      if (g.phase === "write") {
        const mine = pid in g.in, theirs = other in g.in;
        const sea = { k: "sea", key, me: mine ? t.you : "", other: theirs ? c.name(other) : "" };
        return { sub, key: "letter" + g.round, blocks: [card].concat(mine || theirs ? [sea] : []),
          input: { k: "text", max: 240, ph: t.placeholder, sent: g.in[pid] || "", paper: true, send: t.seal },
          note: mine ? c.ui.waiting(c.name(other)) : theirs ? t.otherSent(c.name(other)) : t.secret, host: skipBtn(c, g, c.ids) };
      }
      return { sub, blocks: [card, { k: "shore", key, me: t.you, other: c.name(other), text: g.in[other] || t.empty, mine: g.in[pid] || t.empty,
        tap: t.tapToOpen(c.name(other)), from: t.from(c.name(other)), mineLabel: t.yourLetter }], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) {
      if (g.phase !== "write" || pid in g.in) return;
      const text = String(v == null ? "" : v).trim().slice(0, 240); if (!text) return;
      g.in[pid] = text; if (allIn(g, c.ids)) this.open(c, g);
    },
    open(c, g) { g.log.push({ q: g.q, a: c.ids.map(id => g.in[id] || "") }); g.phase = "read"; },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "write") { fillIn(g, c.ids); this.open(c, g); }
      else if (name === "next" && g.phase === "read") { if (g.round >= g.rounds) g.end = true; else this.deal(c, g); }
    },
    final(c, g) {
      const t = c.tx.t, blocks = [{ k: "h", text: t.keep }];
      g.log.forEach(e => { blocks.push({ k: "p", strong: true, text: e.q }); c.ids.forEach((id, i) => blocks.push({ k: "letter", from: c.name(id), text: e.a[i] || t.empty })); });
      /* the letters are for the two of them: the card (and the picture to share) says only how many were written */
      const n = g.log.reduce((sum, e) => sum + e.a.filter(Boolean).length, 0);
      /* in the room: every round a bottle on a shelf, which opens the two letters of that round */
      const shelf = { k: "bshelf", key: "g" + g.id + "end", hint: t.shelfHint, hintOpen: t.shelfOpen, items: g.log.map(e => ({ q: e.q, a: c.ids.map((id, i) => ({ from: c.name(id), text: e.a[i] || t.empty })) })) };
      return { blocks, poster: { hero: { kind: "bottle", big: String(n), word: t.written(n), title: t.keepTitle, names: pair(c) } }, rest: [{ k: "h", text: t.keep }, shelf] };
    }
  });
})();

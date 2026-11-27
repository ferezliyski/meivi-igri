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

  /* ---------- 2. Conquer the country: a region is yours only if nobody else reached for it ----------
     The regions and what each is worth come from the text file (regions: [[name, points], ...]),
     so the game of another country has its own map. */
  G("conquer", {
    min: 3, max: 8, over,
    setup(c) { return { round: 1, rounds: 7, score: blank(c.ids), owner: {}, phase: "pick", in: {}, last: null }; },
    free: (c, g) => c.tx.regions.filter((r, i) => !g.owner[i]).length,
    view(c, g, pid) {
      const t = c.tx.t, sub = round(c, g), R = c.tx.regions;
      if (g.phase === "pick") return { sub, blocks: [{ k: "h", text: t.pick }, { k: "p", text: t.pickHint }],
        input: { k: "choice", cols: 2, done: g.in[pid], options: R.map(([name, p], i) => ({ v: String(i), t: name, sub: t.pts(p), dis: !!g.owner[i], tag: g.owner[i] ? c.name(g.owner[i]) : "" })) },
        note: waitNote(c, g, c.ids), host: skipBtn(c, g, c.ids) };
      return { sub, blocks: [
          { k: "h", text: t.result },
          { k: "rows", rows: g.last.map(r => ({ l: c.name(r.id), r: r.region == null ? t.nothing : r.won ? t.took(R[r.region][0], r.pts) : t.clash(R[r.region][0]), hot: r.won })) },
          table(c, g.score, c.ui.scores),
          { k: "p", text: t.left(this.free(c, g)) }
        ], host: nextBtn(c, g) };
    },
    ans(c, g, pid, v) {
      const i = +v;
      if (g.phase !== "pick" || !c.tx.regions[i] || String(i) !== String(v) || g.owner[i]) return;
      g.in[pid] = String(i); if (allIn(g, c.ids)) this.resolve(c, g);
    },
    resolve(c, g) {
      g.last = c.ids.map(id => {
        const region = g.in[id] == null ? null : g.in[id], rivals = region == null ? 0 : c.ids.filter(o => g.in[o] === region).length;
        return { id, region, won: rivals === 1, pts: region == null ? 0 : c.tx.regions[region][1] };
      });
      g.last.forEach(r => { if (r.won) { g.owner[r.region] = r.id; g.score[r.id] += r.pts; } });
      g.phase = "result";
    },
    cmd(c, g, name) {
      if (name === "skip" && g.phase === "pick") { fillIn(g, c.ids); this.resolve(c, g); }
      else if (name === "next" && g.phase === "result") {
        if (g.round >= g.rounds || this.free(c, g) === 0) g.end = true; else { g.round++; g.phase = "pick"; g.in = {}; }
      }
    },
    final(c, g) {
      const lands = id => c.tx.regions.filter((r, i) => g.owner[i] === id).map(r => r[0]).join(", ") || c.tx.t.noLand;
      const win = best(c, g.score).join(", "), owned = { k: "rows", title: c.tx.t.lands, rows: c.ids.map(id => ({ l: c.name(id), r: lands(id) })) };
      return { blocks: [{ k: "big", text: win, sub: c.tx.t.ruler }, table(c, g.score, c.ui.scores), owned],
        poster: { hero: { kind: "name", label: c.tx.t.ruler, name: win }, rank: ranked(c, g.score, c.ui.ranking, c.ui.scores) }, rest: [owned] };
    }
  });

  /* ---------- 3. Who of us: everyone points at someone in secret ---------- */
  G("whoofus", {
    min: 3, max: 10, over,
    setup(c) { const g = { round: 0, rounds: 8, score: blank(c.ids), pointed: blank(c.ids), order: order(c, c.tx.questions) }; this.deal(c, g); return g; },
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

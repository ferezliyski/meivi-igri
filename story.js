/* =====================================================================
   Meivi games: the result as a picture for a story (1080 × 1920), drawn on a canvas.
   app.js hands over plain data (no language here):
     { color, icon, game, brand, foot,
       hero: {kind: "ring", big, word, title, names} | {kind: "podium", label, top: [{p, b}]}
           | {kind: "name", label, name} | {kind: "title", title},
       rows: [[label, value]], rank: {head, cols: [title], list: [{p, v: [..]}]} | null }
   MEIVI.story.make(data) -> Promise<Blob> (a PNG).
   ===================================================================== */
(function () {
  const W = 1080, H = 1920, PAD = 84;
  const COLORS = { hot: "#B12A29", gold: "#C2611F", mint: "#1E7F6B", lilac: "#6B4FB3", sky: "#1F6FB5" };
  const DISPLAY = '"Unbounded", "Golos Text", sans-serif', BODY = '"Golos Text", system-ui, sans-serif', HAND = '"Caveat", cursive';

  function shade(hex, k) {   /* k < 0 darker, k > 0 lighter */
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    return "rgb(" + c.map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)).join(",") + ")";
  }
  function round(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
  /* Splits text into lines that fit, at most "max" lines; the last one ends with "…" if cut. */
  function lines(x, text, width, max) {
    const words = String(text).split(/\s+/), out = [];
    let cur = "";
    words.forEach(w => { const t = cur ? cur + " " + w : w; if (x.measureText(t).width <= width || !cur) cur = t; else { out.push(cur); cur = w; } });
    if (cur) out.push(cur);
    if (out.length > max) { out.length = max; let l = out[max - 1]; while (l.length > 1 && x.measureText(l + "…").width > width) l = l.slice(0, -1); out[max - 1] = l + "…"; }
    return out;
  }
  /* Largest font size (down to "min") at which the text fits in "max" lines. */
  function fit(x, text, font, size, min, width, max) {
    for (let s = size; s >= min; s -= 4) { x.font = font.replace("#", s); const l = lines(x, text, width, 99); if (l.length <= max) return { size: s, lines: l }; }
    x.font = font.replace("#", min); return { size: min, lines: lines(x, text, width, max) };
  }
  const loadImage = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

  async function make(d) {
    try { await Promise.all(["800 60px Unbounded", "600 40px Unbounded", "700 40px \"Golos Text\"", "500 40px \"Golos Text\"", "700 60px Caveat"].map(f => document.fonts.load(f))); } catch (e) {}
    const logo = await loadImage("logo-ink.png");
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"), m = COLORS[d.color] || COLORS.hot;
    x.textBaseline = "alphabetic";

    /* background: the game's colour, lighter at the top right, darker at the bottom left, a few soft dots */
    let g = x.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, m); g.addColorStop(1, shade(m, -0.4)); x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(W, 0, 0, W, 0, W * 0.95); g.addColorStop(0, "rgba(255,200,170,.55)"); g.addColorStop(1, "rgba(255,200,170,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(0, H, 0, 0, H, W); g.addColorStop(0, "rgba(0,0,0,.28)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    [[130, 520, 7], [960, 760, 9], [760, 250, 5], [250, 1500, 7], [980, 1580, 5], [520, 140, 5]].forEach(([a, b, r]) => { x.fillStyle = "rgba(255,240,225,.45)"; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });

    /* head: logo in a white box, the brand line beside it */
    let y = 110;
    x.fillStyle = "#fff"; round(x, PAD, y, 220, 170, 44); x.fill();
    if (logo) { const lw = 172, lh = lw * logo.height / logo.width; x.drawImage(logo, PAD + 24, y + (170 - lh) / 2, lw, lh); }
    x.fillStyle = "#fff"; x.font = "700 64px " + HAND; x.textAlign = "right"; x.fillText(d.brand, W - PAD, y + 110); x.textAlign = "left";
    y += 250;

    /* the game */
    x.font = "700 40px " + BODY;
    const chip = (d.icon ? d.icon + "  " : "") + d.game, cw = Math.min(W - 2 * PAD, x.measureText(chip).width + 72);
    x.fillStyle = "rgba(255,255,255,.18)"; round(x, PAD, y, cw, 92, 46); x.fill();
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#fff"; x.fillText(lines(x, chip, cw - 72, 1)[0], PAD + 36, y + 60);
    y += 150;

    /* the result */
    const h = d.hero, inner = W - 2 * PAD;
    x.fillStyle = "#fff";
    if (h.kind === "ring") {
      const cx = W / 2, cy = y + 260, R = 240, p = Math.max(0, Math.min(100, parseInt(h.big, 10) || 0)) / 100;
      x.lineWidth = 46; x.strokeStyle = "rgba(255,255,255,.22)"; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = "#fff"; x.lineCap = "round"; x.beginPath(); x.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); x.stroke(); x.lineCap = "butt";
      x.textAlign = "center"; x.fillStyle = "#fff"; x.font = "800 150px " + DISPLAY; x.fillText(h.big, cx, cy + 40);
      x.font = "700 34px " + BODY; x.fillText(String(h.word).toUpperCase(), cx, cy + 110);
      y = cy + R + 110;
      const t = fit(x, h.title, "800 #px " + DISPLAY, 64, 44, inner, 2);
      t.lines.forEach(l => { x.fillText(l, W / 2, y); y += t.size * 1.2; });
      /* the two names: a little smaller if they do not fit on one line, two lines only if still too long */
      let nm = fit(x, h.names, "700 #px " + BODY, 46, 34, inner, 1);
      if (x.measureText(nm.lines[0]).width > inner || nm.lines[0].endsWith("…")) nm = fit(x, h.names, "700 #px " + BODY, 34, 34, inner, 2);
      x.globalAlpha = 0.95; y += 20; nm.lines.forEach((l, k) => { if (k) y += nm.size * 1.25; x.fillText(l, W / 2, y); }); x.globalAlpha = 1; y += 70;
      x.textAlign = "left";
    } else if (h.kind === "podium") {
      x.font = "700 34px " + BODY; x.globalAlpha = 0.9; x.fillText(String(h.label).toUpperCase(), PAD, y + 20); x.globalAlpha = 1; y += 70;
      const base = y + 560, colW = (inner - 2 * 28) / 3, order = [[h.top[1], 300, 1], [h.top[0], 430, 0], [h.top[2], 220, 2]];
      order.forEach(([r, hh, place], i) => {
        if (!r) return;
        const l = PAD + i * (colW + 28);
        x.fillStyle = place === 0 ? "#fff" : "rgba(255,255,255,.22)"; round(x, l, base - hh, colW, hh, 30); x.fill();
        x.fillStyle = place === 0 ? m : "#fff"; x.textAlign = "center"; x.font = "800 72px " + DISPLAY; x.fillText(String(r.b), l + colW / 2, base - hh + 110);
        x.fillStyle = "#fff"; x.font = "700 40px " + BODY;
        const n = lines(x, r.p, colW, 2); n.forEach((t, k) => x.fillText(t, l + colW / 2, base - hh - 30 - (n.length - 1 - k) * 46));
        if (place === 0) { x.font = "64px " + BODY; x.fillText("👑", l + colW / 2, base - hh - 40 - n.length * 46); }
        x.textAlign = "left";
      });
      y = base + 70;
    } else {
      const label = h.kind === "name" ? h.label : "", text = h.kind === "name" ? h.name : h.title;
      y += 60;
      if (label) { x.font = "700 36px " + BODY; x.globalAlpha = 0.9; x.fillText(String(label).toUpperCase(), PAD, y); x.globalAlpha = 1; y += 110; }
      const t = fit(x, text, "800 #px " + DISPLAY, 120, 64, inner, 3);
      t.lines.forEach(l => { x.fillText(l, PAD, y); y += t.size * 1.12; });
      y += 50;
    }

    /* other titles: two per row */
    const rows = (d.rows || []).slice(0, 4);
    if (rows.length) {
      const cw2 = (inner - 24) / 2, ch = 170;
      rows.forEach(([k, v], i) => {
        const full = rows.length % 2 === 1 && i === rows.length - 1, l = PAD + (full ? 0 : (i % 2) * (cw2 + 24)), w = full ? inner : cw2, t = y + Math.floor(i / 2) * (ch + 24);
        x.fillStyle = "rgba(255,255,255,.15)"; round(x, l, t, w, ch, 34); x.fill();
        x.fillStyle = "#fff"; x.font = "700 26px " + BODY; x.globalAlpha = 0.85; x.fillText(lines(x, String(k).toUpperCase(), w - 56, 1)[0], l + 28, t + 52); x.globalAlpha = 1;
        const f = fit(x, v, "600 #px " + DISPLAY, 40, 28, w - 56, 2); f.lines.forEach((s, j) => x.fillText(s, l + 28, t + 104 + j * (f.size * 1.15)));
      });
      y += Math.ceil(rows.length / 2) * (ch + 24) + 10;
    }

    /* ranking, as many rows as fit above the foot */
    const r = d.rank, room = H - 230 - y;
    if (r && room > 200) {
      const rowH = 74, show = Math.max(1, Math.min(r.list.length, Math.floor((room - 110) / rowH)));
      const boxH = 90 + show * rowH;
      x.fillStyle = "rgba(255,255,255,.13)"; round(x, PAD, y, inner, boxH, 34); x.fill();
      const colX = i => W - PAD - 40 - (r.cols.length - 1 - i) * 130;
      x.fillStyle = "#fff"; x.font = "700 24px " + BODY; x.globalAlpha = 0.85; x.fillText(String(r.head).toUpperCase(), PAD + 32, y + 56);
      x.textAlign = "right"; r.cols.forEach((t, i) => x.fillText(String(t).toUpperCase(), colX(i), y + 56)); x.textAlign = "left"; x.globalAlpha = 1;
      r.list.slice(0, show).forEach((p, i) => {
        const t = y + 90 + i * rowH;
        x.fillStyle = i === 0 ? "#fff" : "rgba(255,255,255,.25)"; x.beginPath(); x.arc(PAD + 56, t + 36, 22, 0, 7); x.fill();
        x.fillStyle = i === 0 ? m : "#fff"; x.textAlign = "center"; x.font = "700 24px " + BODY; x.fillText(String(i + 1), PAD + 56, t + 45);
        x.fillStyle = "#fff"; x.textAlign = "left"; x.font = "700 36px " + BODY; x.fillText(lines(x, p.p, colX(0) - 130 - PAD - 100, 1)[0], PAD + 100, t + 49);
        x.textAlign = "right"; p.v.forEach((v, j) => x.fillText(String(v), colX(j), t + 49)); x.textAlign = "left";
      });
    }

    /* foot */
    x.textAlign = "center"; x.fillStyle = "#fff"; x.font = "500 38px " + BODY; x.globalAlpha = 0.95;
    x.fillText(d.foot, W / 2, H - 120); x.globalAlpha = 1; x.textAlign = "left";

    return new Promise(ok => c.toBlob(b => ok(b), "image/png"));
  }
  MEIVI.story = { make };
})();

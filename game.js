// 게임판 게임 (달리기·돌림판·사다리·폭탄). 서버 없이 휴대폰 안에서만 돈다.
// app.js가 게임을 처음 열 때 이 파일과 game.css를 불러온 뒤 OdGame.open(...)을 부른다.
(() => {
  const GAMES = {
    race: { icon: "🏁", name: "달리기", desc: "음식 캐릭터들이 달려요. 🔥부스터, 💫꽈당, 🐌달팽이가 랜덤으로 터지고, 꼴찌일수록 부스터가 잘 터져서 끝까지 몰라요.", go: "3, 2, 1 출발!" },
    wheel: { icon: "🎡", name: "돌림판", desc: "가운데 GO를 누르면 전구가 번쩍이며 돌아가요. 칸을 넘을 때마다 바늘이 딸깍!", go: "돌려!" },
    ladder: { icon: "🪜", name: "사다리", desc: "아래 칸은 모두 ❓ 카드예요. 한 명씩 내려가며 카드를 뒤집어요. 🍽️ 당첨은 딱 하나!", go: "사다리 타기!" },
    bomb: { icon: "💣", name: "폭탄", desc: "심지가 타는 동안 💣이 후보들 사이를 옮겨 다녀요. 펑! 터지면 탈락. 마지막까지 남으면 당첨!", go: "폭탄 돌리기!" },
  };
  const COLORS = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6", "--c7", "--c8"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const SOUND_KEY = "wmm.sound";

  let root = null, places = [], items = [], emojiFn = () => "🍽️", game = "race", busy = false, timers = [], raf = 0, opts = {};
  let wheelAngle = 0, bulbs = 0, ladder = null, ac = null, soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== "off"; } catch {}
  const $ = (s) => root && root.querySelector(s);
  const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const color = (i) => css(COLORS[i % 8]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const stopAll = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); busy = false; };

  function beep(f, d = .07, type = "square", vol = .05, slide = 0) {
    if (!soundOn) return;
    try {
      // 아이폰 무음 스위치를 따르도록(무음이면 소리 안 남). 사이트는 무음/진동 상태를 직접 읽을 수 없다
      try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch {}
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
    } catch {}
  }

  const MAX = 8;
  const sync = () => { places = items.map((p) => ({ name: p.place_name, e: emojiFn(p) })); };
  const menuItem = (name) => ({ id: `menu-${name}`, place_name: name, menu: true, typed: true });
  const has = (name) => items.some((p) => p.place_name === name);

  // o: { items, ideas, emojiOf, game, onChange(items), onGame(game), onPick(item, gameName, items) }
  function open(o) {
    close();
    opts = o; emojiFn = o.emojiOf || emojiFn; game = GAMES[o.game] ? o.game : "race"; ladder = null;
    items = (o.items || []).slice(0, MAX);
    sync();
    root = document.createElement("div");
    root.className = "od-arcade";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "게임으로 정하기");
    root.innerHTML = `<div class="ga-wrap">
      <div class="ga-top"><h2>🎮 게임으로 정하기</h2>
        <button class="ga-btn ga-sound" type="button" data-sound></button>
        <button class="ga-btn" type="button" data-close>✕ 닫기</button></div>
      <section class="ga-cands" aria-label="후보">
        <div class="ga-cands-head"><b>후보</b><small></small></div>
        <div class="ga-chips"></div>
        <form class="ga-add"><input name="q" maxlength="20" autocomplete="off" enterkeyhint="done" aria-label="메뉴나 가게 이름" placeholder="메뉴나 가게 이름 넣기" /><button class="ga-btn" type="submit">넣기</button></form>
        <div class="ga-ideas" aria-label="메뉴 빨리 넣기"></div>
      </section>
      <div class="ga-tabs" role="radiogroup" aria-label="게임 고르기">${Object.entries(GAMES).map(([k, g]) =>
        `<button type="button" role="radio" data-g="${k}"><b>${g.icon}</b>${g.name}</button>`).join("")}</div>
      <section class="ga-stage" aria-live="polite"><p class="ga-desc"></p><div class="ga-play"></div><button class="ga-btn hot ga-go" type="button"></button></section>
      <div class="ga-out"></div></div>
      <div class="ga-count" aria-hidden="true"></div><canvas class="ga-confetti" aria-hidden="true"></canvas>`;
    document.body.appendChild(root);
    document.documentElement.style.overflow = "hidden";
    $("[data-close]").onclick = close;
    $("[data-sound]").onclick = () => { soundOn = !soundOn; try { localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off"); } catch {} paintSound(); if (soundOn) beep(660); };
    $(".ga-tabs").onclick = (e) => {
      const b = e.target.closest("[data-g]"); if (!b || busy) return;
      game = b.dataset.g; beep(520, .05); $(".ga-out").innerHTML = ""; if (opts.onGame) opts.onGame(game); render();
    };
    $(".ga-chips").onclick = (e) => {
      const b = e.target.closest("[data-del]"); if (!b || busy) return;
      items.splice(Number(b.dataset.del), 1); edited();
    };
    $(".ga-add").onsubmit = (e) => {
      e.preventDefault(); if (busy) return;
      const f = e.currentTarget, name = f.q.value.trim().slice(0, 20);
      if (name && !has(name) && items.length < MAX) { items.push(menuItem(name)); edited(); }
      f.q.value = "";
    };
    $(".ga-ideas").onclick = (e) => {
      const b = e.target.closest("button"); if (!b || busy) return;
      if (b.hasAttribute("data-rand")) {
        // 누른 사람이 원할 때만: 없는 메뉴를 2개씩 더 넣는다
        const pool = (opts.ideas || []).filter((m) => !has(m)).sort(() => Math.random() - .5);
        for (const m of pool.slice(0, Math.min(2, MAX - items.length))) items.push(menuItem(m));
      } else {
        const m = b.dataset.menu, i = items.findIndex((p) => p.place_name === m);
        if (i >= 0) items.splice(i, 1); else if (items.length < MAX) items.push(menuItem(m));
      }
      edited();
    };
    $(".ga-go").onclick = start;
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    paintSound(); renderCands(); render();
    $("[data-close]").focus();
  }
  function changed() { if (opts.onChange) opts.onChange(items.slice()); }
  function edited() { beep(880, .05); sync(); changed(); $(".ga-out").innerHTML = ""; renderCands(); render(); }
  function renderCands() {
    $(".ga-cands-head small").textContent = `${items.length} / ${MAX}개`;
    $(".ga-chips").innerHTML = items.length ? items.map((p, i) => `<span class="ga-chip" style="--dot:${color(i)}"><span aria-hidden="true">${places[i].e}</span>${esc(p.place_name)}<button type="button" data-del="${i}" aria-label="${esc(p.place_name)} 빼기">✕</button></span>`).join("")
      : `<span class="ga-empty">아래에 메뉴를 쓰거나 메뉴 버튼을 눌러 2개 이상 넣어주세요.</span>`;
    $(".ga-ideas").innerHTML = `<button type="button" data-rand>🎲 아무 메뉴 2개</button>` + (opts.ideas || []).map((m) =>
      `<button type="button" data-menu="${esc(m)}" class="${has(m) ? "on" : ""}">${emojiFn({ place_name: m })} ${esc(m)}</button>`).join("");
    $(".ga-add button").disabled = items.length >= MAX;
  }
  function close() {
    stopAll();
    if (root) { root.remove(); root = null; document.documentElement.style.overflow = ""; if (opts.onClose) opts.onClose(); }
  }
  function paintSound() { const b = $("[data-sound]"); b.textContent = soundOn ? "🔊" : "🔇"; b.setAttribute("aria-label", soundOn ? "소리 끄기" : "소리 켜기"); }

  function render() {
    root.querySelectorAll(".ga-tabs [data-g]").forEach((b) => { b.setAttribute("aria-checked", String(b.dataset.g === game)); b.disabled = false; });
    root.querySelector(".ga-cands").classList.remove("locked");
    $(".ga-desc").textContent = GAMES[game].desc;
    if (places.length < 2) {
      $(".ga-play").innerHTML = `<p class="ga-empty">후보를 2개 이상 넣으면 시작할 수 있어요.</p>`;
      $(".ga-go").disabled = true; $(".ga-go").textContent = "후보를 2개 이상 넣어주세요"; return;
    }
    $(".ga-go").disabled = false; $(".ga-go").textContent = GAMES[game].go;
    ({ race: drawRace, wheel: drawWheel, ladder: () => drawLadder(true), bomb: drawBomb })[game]();
  }
  function start() {
    if (busy) return;
    if (places.length < 2) return;
    busy = true; $(".ga-out").innerHTML = "";
    root.querySelector(".ga-cands").classList.add("locked");
    $(".ga-stage").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    $(".ga-go").disabled = true; $(".ga-go").textContent = "두근두근…";
    root.querySelectorAll(".ga-tabs [data-g]").forEach((b) => (b.disabled = true));
    const hub = $(".ga-hub"); if (hub) hub.disabled = true;
    ({ race: playRace, wheel: playWheel, ladder: playLadder, bomb: playBomb })[game]();
  }
  const say = (m) => { const s = $(".say"); if (s) s.textContent = m; };
  const mc = (m) => `<div class="ga-mc"><span class="mic" aria-hidden="true">🎙️</span><div class="say">${esc(m)}</div></div>`;
  function countdown(then) {
    if (reduce) return then();
    ["3", "2", "1", "GO!"].forEach((t, i) => later(() => { $(".ga-count").innerHTML = `<b>${t}</b>`; beep(i < 3 ? 440 : 880, i < 3 ? .12 : .3); }, i * 600));
    later(() => { $(".ga-count").innerHTML = ""; then(); }, 2250);
  }
  function finish(i, line) {
    busy = false;
    [523, 659, 784, 1047].forEach((f, k) => later(() => beep(f, .16, "square", .06), k * 120));
    $(".ga-go").disabled = false; $(".ga-go").textContent = "🔁 한 판 더!";
    root.querySelectorAll(".ga-tabs [data-g]").forEach((b) => (b.disabled = false));
    const hub = $(".ga-hub"); if (hub) hub.disabled = false;
    const p = places[i];
    $(".ga-out").innerHTML = `<div class="ga-result"><div class="tro" aria-hidden="true">🏆</div><small>${esc(line)}</small>
      <strong>${p.e} 오늘은 ${esc(p.name)}!</strong>
      <div class="row"><button class="ga-btn hot" type="button" data-keep>채팅에 결과 남기기</button></div></div>`;
    root.querySelector(".ga-cands").classList.remove("locked");
    $("[data-keep]").onclick = () => { const cb = opts.onPick, g = game, all = items.slice(); opts.onClose = null; close(); if (cb) cb(all[i], GAMES[g].name, all); };
    $(".ga-out").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    confetti();
  }

  // ---------- 달리기 ----------
  function drawRace() {
    $(".ga-play").innerHTML = `${mc("선수 입장! 출발을 눌러주세요")}<div class="ga-track">${places.map((p, i) =>
      `<div class="ga-lane"><div class="ga-runner" id="ga-r${i}" style="transform:translate(6px,-50%)"><span class="fx"></span><span class="body">${p.e}<span class="crown">👑</span></span><span class="tagn" style="border-color:${color(i)}">${esc(p.name)}</span></div></div>`).join("")}</div><div class="ga-board"></div>`;
  }
  function playRace() {
    drawRace(); say("자리에… 준비…");
    countdown(() => {
      const n = places.length, goal = $(".ga-lane").clientWidth - 34 - 28, track = $(".ga-track");
      track.classList.add("running"); say("출발했습니다!!");
      const st = places.map(() => ({ x: 6, v: .9 + Math.random() * .3, boost: 1, fxT: 0 }));
      const rs = places.map((_, i) => $(`#ga-r${i}`));
      let last = performance.now(), leader = -1, t0 = last, done = false, lastSay = 0;
      const talk = (m, now) => { if (now - lastSay > 900) { say(m); lastSay = now; } };
      const step = (now) => {
        if (!root) return;
        const dt = Math.min(50, now - last) / 16.67; last = now;
        const lead = Math.max(...st.map((s) => s.x));
        st.forEach((s, i) => {
          const gap = (lead - s.x) / goal, fx = rs[i].querySelector(".fx");
          if (!s.fxT) {
            // 뒤처질수록 부스터가 잘 터져서 엎치락뒤치락
            if (Math.random() < .006 + gap * .06) { s.boost = 2.2; s.fxT = 40; fx.textContent = "💨"; if (gap > .08) { talk(`${places[i].name} 부스터 폭발! 🔥`, now); beep(300, .25, "sawtooth", .03, 600); } }
            else if (s.x === lead && Math.random() < .013) { s.boost = .1; s.fxT = 32; fx.textContent = "💫"; talk(`앗! 선두 ${places[i].name} 꽈당! 💫`, now); beep(400, .2, "triangle", .06, -300); }
            else if (Math.random() < .002) { s.boost = .4; s.fxT = 45; fx.textContent = "🐌"; talk(`${places[i].name} 갑자기 달팽이 모드 🐌`, now); }
          } else if (--s.fxT === 0) { s.boost = 1; fx.textContent = ""; }
          s.v = Math.max(.6, Math.min(1.35, s.v + (Math.random() - .5) * .12));
          s.x = Math.min(goal, s.x + s.v * s.boost * dt * (goal / 540));
          rs[i].style.transform = `translate(${s.x}px,-50%)`;
        });
        const ord = st.map((_, i) => i).sort((a, b) => st[b].x - st[a].x);
        if (ord[0] !== leader && now - t0 > 700) {
          if (leader !== -1) { talk(`역전!! ${places[ord[0]].name} 1등으로!`, now); beep(990, .07); rs[leader].classList.remove("lead"); }
          leader = ord[0]; rs[leader].classList.add("lead");
        }
        $(".ga-board").textContent = ord.slice(0, 3).map((i, k) => `${["🥇", "🥈", "🥉"][k]} ${places[i].name}`).join(" · ");
        const win = st.findIndex((s) => s.x >= goal);
        if (win >= 0 && !done) { done = true; track.classList.remove("running"); say(`🏁 ${places[win].name} 골인!!!`); later(() => finish(win, `${n}개 후보가 달린 경주 1등`), 600); return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }

  // ---------- 돌림판 ----------
  function drawWheel() {
    $(".ga-play").innerHTML = `<div class="ga-wheel"><div class="ga-pointer"><svg viewBox="0 0 34 44" aria-hidden="true"><path d="M17 42 L3 10 A14 14 0 1 1 31 10 Z" fill="${css("--c1")}" stroke="${css("--g-ink")}" stroke-width="3" stroke-linejoin="round"/><circle cx="17" cy="12" r="4" fill="${css("--g-panel")}" stroke="${css("--g-ink")}" stroke-width="2"/></svg></div>
      <canvas width="640" height="640"></canvas><button class="ga-hub" type="button" aria-label="돌림판 돌리기">GO</button></div>`;
    $(".ga-hub").onclick = start;
    paintWheel(wheelAngle);
  }
  function paintWheel(a) {
    const cv = $(".ga-wheel canvas"); if (!cv) return;
    const g = cv.getContext("2d"), R = cv.width / 2, n = places.length, ink = css("--g-ink"), seg = Math.PI * 2 / n, rr = R - 46;
    g.clearRect(0, 0, cv.width, cv.height);
    g.beginPath(); g.arc(R, R, R - 4, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
    g.beginPath(); g.arc(R, R, R - 15, 0, Math.PI * 2); g.fillStyle = css("--c1"); g.fill();
    for (let i = 0; i < 22; i++) {
      const t = i / 22 * Math.PI * 2;
      g.beginPath(); g.arc(R + Math.cos(t) * (R - 29), R + Math.sin(t) * (R - 29), 8.5, 0, Math.PI * 2);
      g.fillStyle = (i + bulbs) % 2 ? "#8a3a20" : "#fff6c2"; g.fill(); g.lineWidth = 3; g.strokeStyle = ink; g.stroke();
    }
    for (let i = 0; i < n; i++) {
      const s = a + i * seg - Math.PI / 2;
      g.beginPath(); g.moveTo(R, R); g.arc(R, R, rr, s, s + seg); g.closePath();
      g.fillStyle = color(i); g.fill(); g.lineWidth = 5; g.strokeStyle = ink; g.stroke();
      g.save(); g.translate(R, R); g.rotate(s + seg / 2);
      g.textAlign = "center"; g.textBaseline = "middle"; g.font = `${n > 6 ? 32 : 38}px sans-serif`; g.fillText(places[i].e, rr - 36, 0);
      g.textAlign = "right"; g.font = `${n > 6 ? 23 : 27}px ${css("--g-font")}`; g.lineWidth = 6; g.lineJoin = "round"; g.strokeStyle = "#1d1a16"; g.fillStyle = "#ffffff";
      let t = places[i].name; if ([...t].length > 6) t = [...t].slice(0, 5).join("") + "…";
      g.strokeText(t, rr - 70, 2); g.fillText(t, rr - 70, 2); g.restore();
    }
  }
  function playWheel() {
    const n = places.length, seg = Math.PI * 2 / n, win = Math.floor(Math.random() * n);
    // 바늘(위쪽)이 당첨 칸 안쪽 아무 곳을 가리키게 멈춘다
    const base = -(win * seg + (.15 + Math.random() * .7) * seg), s0 = wheelAngle;
    const target = s0 + Math.PI * 2 * (7 + Math.floor(Math.random() * 3)) + ((((base - s0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const dur = reduce ? 1 : 5400, t0 = performance.now();
    let lastSeg = -1, lb = 0;
    const step = (now) => {
      if (!root) return;
      const t = Math.min(1, (now - t0) / dur);
      wheelAngle = s0 + (target - s0) * (1 - Math.pow(1 - t, 4));
      if (now - lb > 120) { bulbs++; lb = now; }
      const cur = Math.floor((((-wheelAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / seg);
      if (cur !== lastSeg) { lastSeg = cur; beep(1200, .03, "square", .035); const p = $(".ga-pointer"); p.classList.remove("flick"); void p.offsetWidth; p.classList.add("flick"); }
      paintWheel(wheelAngle);
      if (t < 1) raf = requestAnimationFrame(step);
      else { wheelAngle %= Math.PI * 2; finish(win, "돌림판이 멈춘 곳은…"); }
    };
    raf = requestAnimationFrame(step);
  }

  // ---------- 사다리 ----------
  const geo = () => {
    const n = ladder.n, W = Math.max(320, n * 64), pad = 28;
    return { W, H: 330, X: (c) => pad + c * (W - pad * 2) / Math.max(1, n - 1), top: 58, bot: 262, Y: (r) => 58 + (r + 1) * (204 / (ladder.rows + 1)) };
  };
  function drawLadder(fresh) {
    const n = places.length;
    if (fresh || !ladder || ladder.n !== n) {
      const rows = 8, rungs = [];
      const free = (r, c) => !rungs.some((x) => x.r === r && Math.abs(x.c - c) < 2);
      for (let r = 0; r < rows; r++) for (let c = 0; c < n - 1; c++) if (Math.random() < .45 && free(r, c)) rungs.push({ r, c });
      for (let c = 0; c < n - 1; c++) if (!rungs.some((x) => x.c === c)) { const r = Math.floor(Math.random() * rows); if (free(r, c)) rungs.push({ r, c }); }
      ladder = { n, rows, rungs, prize: Math.floor(Math.random() * n) };
    }
    const { W, H, X, Y, top, bot } = geo(), ink = css("--g-ink"), font = esc(css("--g-font"));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="사다리">`;
    for (let c = 0; c < n; c++) s += `<line x1="${X(c)}" y1="${top}" x2="${X(c)}" y2="${bot}" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`;
    ladder.rungs.forEach(({ r, c }) => { s += `<line x1="${X(c)}" y1="${Y(r)}" x2="${X(c + 1)}" y2="${Y(r)}" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`; });
    s += `<g class="ga-trails"></g>`;
    places.forEach((p, c) => {
      const t = [...p.name].length > 4 ? [...p.name].slice(0, 3).join("") + "…" : p.name;
      s += `<text x="${X(c)}" y="14" text-anchor="middle" font-size="12" fill="${ink}" font-family="${font}">${esc(t)}</text>
        <circle cx="${X(c)}" cy="37" r="15" fill="${color(c)}" stroke="${ink}" stroke-width="3"/><text x="${X(c)}" y="43" text-anchor="middle" font-size="16">${p.e}</text>
        <g class="ga-slot" id="ga-s${c}" style="transform-origin:${X(c)}px ${bot + 31}px"><rect x="${X(c) - 21}" y="${bot + 11}" width="42" height="40" rx="9" fill="${css("--c4")}" stroke="${ink}" stroke-width="3"/>
        <text x="${X(c)}" y="${bot + 38}" text-anchor="middle" font-size="18" fill="#fff">❓</text></g>`;
    });
    $(".ga-play").innerHTML = `<div class="ga-ladder">${s}</svg></div>`;
  }
  function trace(st) {
    const { X, Y, top, bot } = geo(); let c = st; const pts = [[X(c), top]];
    for (let r = 0; r < ladder.rows; r++) {
      const R = ladder.rungs.find((x) => x.r === r && x.c === c), L = ladder.rungs.find((x) => x.r === r && x.c === c - 1);
      if (R || L) { pts.push([X(c), Y(r)]); c += R ? 1 : -1; pts.push([X(c), Y(r)]); }
    }
    pts.push([X(c), bot]); return { pts, end: c };
  }
  function playLadder() {
    drawLadder(true);
    const all = places.map((_, i) => i), winner = all.find((i) => trace(i).end === ladder.prize);
    // 당첨자는 맨 마지막에 내려간다
    const seq = all.filter((i) => i !== winner).sort(() => Math.random() - .5).concat(winner), NS = "http://www.w3.org/2000/svg";
    const run = (k) => {
      if (k >= seq.length) return later(() => finish(winner, "사다리 끝에서 🍽️ 카드를 뒤집었어요"), 500);
      const i = seq[k], { pts, end } = trace(i);
      const segs = pts.slice(1).map((p, j) => ({ a: pts[j], b: p, len: Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]) }));
      const total = segs.reduce((a, s) => a + s.len, 0), dur = reduce ? 1 : (k === seq.length - 1 ? 2100 : 900);
      const trail = document.createElementNS(NS, "polyline");
      [["fill", "none"], ["stroke", color(i)], ["stroke-width", "8"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"], ["opacity", ".85"]].forEach(([k2, v]) => trail.setAttribute(k2, v));
      $(".ga-trails").appendChild(trail);
      const ball = document.createElementNS(NS, "text"); ball.setAttribute("text-anchor", "middle"); ball.setAttribute("font-size", "24"); ball.textContent = places[i].e;
      $(".ga-ladder svg").appendChild(ball);
      const t0 = performance.now(); let turn = 0;
      const step = (now) => {
        if (!root) return;
        const t = Math.min(1, (now - t0) / dur); let d = t * total, si = 0; const got = [pts[0]]; let x = pts[0][0], y = pts[0][1];
        for (const s of segs) { if (d <= s.len) { const f = s.len ? d / s.len : 0; x = s.a[0] + (s.b[0] - s.a[0]) * f; y = s.a[1] + (s.b[1] - s.a[1]) * f; break; } d -= s.len; got.push(s.b); x = s.b[0]; y = s.b[1]; si++; }
        if (si !== turn) { turn = si; beep(700 + si * 40, .03, "square", .03); }
        trail.setAttribute("points", [...got, [x, y]].map((p) => p.join(",")).join(" "));
        ball.setAttribute("x", x); ball.setAttribute("y", y + 8);
        if (t < 1) { raf = requestAnimationFrame(step); return; }
        const slot = $(`#ga-s${end}`), hit = end === ladder.prize;
        slot.classList.add("flip");
        later(() => {
          slot.querySelector("rect").setAttribute("fill", hit ? css("--c2") : css("--g-panel"));
          const tx = slot.querySelector("text"); tx.textContent = hit ? "🍽️" : "꽝"; tx.setAttribute("fill", css("--g-ink")); tx.setAttribute("font-size", hit ? "20" : "14");
        }, 250);
        hit ? beep(1047, .25, "square", .06) : beep(196, .15, "triangle", .06, -60);
        if (k < seq.length - 1) ball.setAttribute("opacity", ".35");
        later(() => run(k + 1), reduce ? 0 : 420);
      };
      raf = requestAnimationFrame(step);
    };
    run(0);
  }

  // ---------- 폭탄 돌리기 ----------
  function drawBomb() {
    $(".ga-play").innerHTML = `${mc(`${places.length}개 중 하나만 살아남아요`)}<div class="ga-fuse" aria-hidden="true"><i></i></div><div class="ga-grid">${places.map((p, i) =>
      `<div class="ga-tile" id="ga-b${i}" style="border-top-width:8px;border-top-color:${color(i)}"><span class="bomb" aria-hidden="true">💣</span><span class="face">${p.e}</span><span class="nm">${esc(p.name)}</span></div>`).join("")}</div>`;
  }
  function playBomb() {
    drawBomb();
    const alive = places.map((_, i) => i);
    const round = () => {
      if (!root) return;
      if (alive.length === 1) { const w = alive[0]; $(`#ga-b${w}`).classList.add("champ"); say(`살아남았다!! ${places[w].name}`); later(() => finish(w, `${places.length}개 중 끝까지 살아남았어요`), 500); return; }
      const out = alive[Math.floor(Math.random() * alive.length)], fuseMs = reduce ? 0 : 2300 + Math.random() * 1500, t0 = performance.now();
      let k = Math.floor(Math.random() * alive.length), cur = -1;
      say(["불붙었다! 🔥", "째깍째깍…", "누구 손에서 터질까?", "빨리 넘겨!!"][Math.floor(Math.random() * 4)]);
      const hop = () => {
        if (!root) return;
        const left = 1 - (performance.now() - t0) / (fuseMs || 1);
        $(".ga-fuse i").style.transform = `scaleX(${Math.max(0, left)})`;
        if (cur >= 0) $(`#ga-b${cur}`).classList.remove("has");
        if (left <= 0) {
          const b = $(`#ga-b${out}`); b.classList.add("has", "boom");
          beep(160, .45, "sawtooth", .1, -120); beep(80, .5, "square", .08, -40);
          const stage = $(".ga-stage"); stage.classList.add("ga-shake"); later(() => stage.classList.remove("ga-shake"), 400);
          later(() => { b.classList.remove("has"); b.classList.add("out"); }, 120);
          alive.splice(alive.indexOf(out), 1);
          say(`펑!!! ${places[out].name} 탈락 💥${alive.length > 1 ? ` (${alive.length}개 남음)` : ""}`);
          later(round, reduce ? 0 : 1100); return;
        }
        // 마지막 순간엔 터질 가게 쪽으로 간다
        cur = left < .12 ? out : alive[(k += 1 + Math.floor(Math.random() * 2)) % alive.length];
        $(`#ga-b${cur}`).classList.add("has"); beep(left < .3 ? 1100 : 800, .03, "square", .035);
        later(hop, Math.max(70, 260 * left + 60));
      };
      hop();
    };
    say("두근두근…"); later(round, reduce ? 0 : 600);
  }

  // ---------- 꽃가루 ----------
  function confetti() {
    if (reduce || !root) return;
    const cv = $(".ga-confetti"), g = cv.getContext("2d"); cv.width = innerWidth; cv.height = innerHeight;
    const cols = COLORS.map(css), food = ["🍜", "🍗", "🍣", "🍔", "⭐"];
    const ps = Array.from({ length: 100 }, (_, i) => ({ x: innerWidth * (i % 2 ? .1 : .9), y: innerHeight * .7, vx: (i % 2 ? 1 : -1) * (Math.random() * 8 + 3), vy: -Math.random() * 16 - 7,
      r: Math.random() * 7 + 4, c: cols[i % 8], a: Math.random() * 6, e: i % 9 === 0 ? food[i % food.length] : "" }));
    let n = 0;
    const step = () => {
      if (!root) return;
      g.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => { p.vy += .4; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += .15; g.save(); g.translate(p.x, p.y); g.rotate(p.a);
        if (p.e) { g.font = "22px sans-serif"; g.fillText(p.e, -11, 8); } else { g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); } g.restore(); });
      if (++n < 130) requestAnimationFrame(step); else g.clearRect(0, 0, cv.width, cv.height);
    };
    step();
  }

  window.OdGame = { open, close, GAMES };
})();

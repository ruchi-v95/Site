// 오늘 뭐하지: 내 주변 놀거리를 하나 골라준다. 장소는 /api/places?kind=play (카카오 키워드 검색).
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const track = (e) => { try { navigator.sendBeacon && navigator.sendBeacon(`/api/stat?e=${e}`); } catch {} };
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // 버튼 → 카카오 검색어들 (여러 개면 섞어서 차례로)
  const INDOOR = ["방탈출", "보드게임카페", "코인노래방", "볼링장", "영화관", "만화카페", "오락실", "전시관", "실내클라이밍", "공방", "VR체험", "탁구장"];
  const OUTDOOR = ["공원", "산책로", "전망대", "수목원", "놀이공원", "자전거대여", "야구연습장"];
  const CHIPS = {
    "🎲 아무거나": [...INDOOR, ...OUTDOOR],
    "🏠 실내": INDOOR,
    "🌳 야외": OUTDOOR,
    "🔐 방탈출": ["방탈출"],
    "🎲 보드게임": ["보드게임카페"],
    "🎤 노래방": ["코인노래방", "노래방"],
    "🎳 볼링": ["볼링장"],
    "🎬 영화": ["영화관"],
    "🌿 산책·공원": ["공원", "산책로"],
    "🖼️ 전시": ["미술관", "전시관", "박물관"],
    "🕹️ 오락실": ["오락실"],
    "📚 만화카페": ["만화카페"],
    "🎨 공방": ["공방", "원데이클래스"],
  };

  const FALLBACK = { x: 127.0276, y: 37.4979, name: "강남역" };
  let loc = null, radius = 2000, rainy = false;
  let cur = null; // { chip, queries, shown:Set, pool:Map(query→places) }

  // ---------- 위치 ----------
  // 위치 허용 창에 답하지 않아도 화면이 멈추지 않게: 4초 안에 못 받으면 인터넷 접속 위치(없으면 강남역)로 먼저 찾고,
  // 나중에 허용하면 그때 내 위치로 바꾼다. 동네를 직접 입력했으면 그걸 우선한다.
  const locText = $("#p-loc-text"), locBtn = $("#p-loc-btn");
  let manual = false; // 동네를 직접 입력했는지
  let precise = false; // 기기 위치(GPS 등)를 쓰는 중인지
  let locName = "";
  function setLoc(next, label, opts = {}) {
    loc = next; locName = label || "내 위치";
    precise = !!opts.precise;
    locText.textContent = label ? `${opts.help ? "" : "📍 "}${label} 근처에서 찾고 있어요.` : "내 위치 근처에서 찾고 있어요.";
    if (opts.help) helpLink();
    if (!label) placeName(next);
    showBtn(!precise);
    showWhere(!(precise || manual));
    if (cur) { cur.shown.clear(); cur.pool.clear(); }
    loadWeather();
  }
  // 내 위치면 동 이름으로 보여준다: "📍 역삼1동에서 찾고 있어요"
  async function placeName(at) {
    try {
      const r = await fetch(`/api/where?x=${at.x.toFixed(3)}&y=${at.y.toFixed(3)}`);
      const d = r.ok ? await r.json() : null;
      if (!d || !d.name || loc !== at) return; // 그 사이 위치가 바뀌었으면 무시
      locName = d.name;
      locText.textContent = `📍 ${d.name}에서 찾고 있어요.`;
    } catch {}
  }
  // 위치 버튼은 정확한 내 위치를 쓰는 중이 아닐 때만 보인다 (크롬 새 버전은 브라우저가 그리는 버튼)
  function showBtn(on) {
    locBtn.hidden = !on || !!geoEl;
    if (geoEl) geoEl.style.display = on ? "" : "none";
  }
  // 동네 입력칸: 위치가 잡혀 있으면 숨기고 '다른 곳에서 찾기'를 눌렀을 때만 연다
  const whereForm = $("#p-where"), otherBtn = $("#p-other");
  function showWhere(open) {
    whereForm.hidden = !open;
    otherBtn.hidden = open;
  }
  otherBtn.onclick = () => { showWhere(true); $("#p-where-q").focus(); };
  function helpLink() {
    const a = document.createElement("a");
    a.href = "/guide/location.html"; a.target = "_blank"; a.rel = "noopener"; a.className = "help-link";
    a.textContent = "위치 켜는 법";
    locText.append(" ", a);
  }
  // 크롬 144+의 <geolocation> 버튼: 전에 '차단'했어도 누르면 다시 허용 창을 띄워준다. 없으면 일반 버튼.
  const geoEl = "HTMLGeolocationElement" in window ? document.createElement("geolocation") : null;
  if (geoEl) {
    geoEl.className = "geo-el";
    geoEl.addEventListener("location", () => {
      if (geoEl.position) { manual = false; setLoc({ x: geoEl.position.coords.longitude, y: geoEl.position.coords.latitude }, null, { precise: true }); }
      else if (geoEl.error) failMsg(geoEl.error.code === 1 ? "denied" : "unavailable");
    });
    locBtn.after(geoEl);
    locBtn.hidden = true;
  }

  function geo(timeout) {
    return new Promise((res) => {
      if (!navigator.geolocation) return res({ err: "unavailable" });
      navigator.geolocation.getCurrentPosition(
        (p) => res({ x: p.coords.longitude, y: p.coords.latitude }),
        async (e) => {
          let err = e && e.code === 1 ? "denied" : "unavailable";
          if (err === "denied") try { if ((await navigator.permissions.query({ name: "geolocation" })).state === "prompt") err = "dismissed"; } catch {}
          res({ err });
        },
        { timeout, maximumAge: 600000 }
      );
    });
  }
  const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
  async function ipLoc() {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
    try { const r = await fetch("/api/ipgeo", { signal: ctrl.signal }); const d = r.ok ? await r.json() : null; return d && d.x ? d : null; }
    catch { return null; } finally { clearTimeout(t); }
  }
  // why가 없으면 안내 문구는 그대로 두고 '지금은 어디 기준인지'만 덧붙인다
  async function roughLoc(why) {
    const ip = await ipLoc();
    if (manual || (precise && why)) return;
    const next = ip ? { x: ip.x, y: ip.y } : FALLBACK;
    const name = ip ? `인터넷 접속 위치(${ip.name || "대략"})` : "강남역";
    if (why) return setLoc(next, `${why} ${name}`, { help: true });
    loc = next; precise = false; locName = name;
    if (cur) { cur.shown.clear(); cur.pool.clear(); }
    locText.append(` 지금은 ${name} 근처에서 찾고 있어요.`);
    showWhere(true);
    loadWeather();
  }
  const WHY = { denied: "위치가 차단돼 있어서", dismissed: "위치 허용을 안 해서", unavailable: "이 기기에서 위치를 못 찾아서", wait: "위치 허용을 기다리는 동안" };
  function failMsg(err) {
    locText.textContent = err === "denied"
      ? (geoEl ? "위치가 차단돼 있어요. 위치 버튼을 누르면 다시 허용할 수 있어요. 동네 이름을 입력해도 돼요." : "브라우저에서 위치를 차단해 둔 상태예요. 주소창 왼쪽 아이콘에서 위치를 '허용'하면 바로 다시 찾아요. 동네 이름을 입력해도 돼요.")
      : err === "dismissed" ? "위치 허용 창이 닫혔어요. 위치 버튼을 누르면 다시 물어볼게요."
      : "이 기기에서 위치를 찾지 못했어요. PC라면 위치 서비스가 꺼져 있을 수 있어요. 동네 이름을 입력해 주세요.";
    if (err !== "dismissed") helpLink();
    showBtn(true);
    showWhere(true);
    if (!loc) roughLoc(null);
    else locText.append(` 지금은 ${locName} 근처에서 찾고 있어요.`);
  }

  async function initLoc() {
    const ask = geo(15000);
    const g = await within(ask, 4000);
    if (g && !g.err) return setLoc(g, null, { precise: true });
    if (g && g.err) return failMsg(g.err);
    // 허용 창이 떠 있는 채로 답이 없다: 일단 대략 위치로 찾고, 나중에 허용하면 바꾼다
    await roughLoc(WHY.wait);
    const late = await ask;
    if (manual || !late) return;
    if (late.err) failMsg(late.err);
    else setLoc(late, null, { precise: true });
  }

  locBtn.addEventListener("click", async () => {
    locBtn.disabled = true;
    locText.textContent = "위치를 확인하는 중…";
    const g = await geo(15000);
    locBtn.disabled = false;
    if (g && !g.err) { manual = false; setLoc(g, null, { precise: true }); }
    else failMsg(g ? g.err : "unavailable");
  });

  // 주소창에서 권한을 바꾸면 새로고침 없이 반영
  (async () => {
    try {
      const st = await navigator.permissions.query({ name: "geolocation" });
      st.onchange = async () => {
        if (st.state !== "granted" || manual) return;
        const g = await geo(15000);
        if (g && !g.err) setLoc(g, null, { precise: true });
      };
    } catch {}
  })();

  $("#p-where").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#p-where-q").value.trim();
    if (!q) return;
    locText.textContent = "찾는 중…";
    try {
      const r = await fetch(`/api/where?q=${encodeURIComponent(q)}`);
      const d = r.ok ? await r.json() : null;
      if (!d || !d.x) throw 0;
      manual = true;
      setLoc({ x: Number(d.x), y: Number(d.y) }, d.name);
      $("#p-where-q").value = "";
    } catch { locText.textContent = `"${q}"을(를) 찾지 못했어요. 역이나 동 이름으로 다시 입력해 보세요.`; }
  });

  // ---------- 날씨: 비·눈 오면 실내 위주 ----------
  async function loadWeather() {
    try {
      const r = await fetch(`/api/weather?x=${loc.x.toFixed(2)}&y=${loc.y.toFixed(2)}`);
      if (!r.ok) return;
      const { temp, pty } = await r.json();
      rainy = [1, 2, 3, 4, 5, 6, 7].includes(pty) || temp <= 0;
      if (rainy) {
        $("#p-lead").textContent = `${[3, 6, 7].includes(pty) ? "눈이 와요" : temp <= 0 ? "많이 추워요" : "비가 와요"}. 오늘은 실내 놀거리 어때요? (지금 ${Math.round(temp)}°)`;
        renderChips();
      }
    } catch {}
  }

  // ---------- 버튼 ----------
  function renderChips() {
    const box = $("#p-chips");
    box.innerHTML = "";
    for (const name of Object.keys(CHIPS)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip" + (rainy && name === "🏠 실내" ? " chip-weather" : "");
      b.textContent = name;
      b.onclick = () => start(name);
      if (cur && cur.chip === name) b.classList.add("on");
      box.appendChild(b);
    }
  }
  document.querySelectorAll(".p-mode button").forEach((b) => (b.onclick = () => {
    radius = Number(b.dataset.r);
    document.querySelectorAll(".p-mode button").forEach((x) => { x.setAttribute("aria-checked", String(x === b)); x.classList.toggle("on", x === b); });
    if (cur) { cur.shown.clear(); cur.pool.clear(); }
  }));

  // ---------- 뽑기 ----------
  async function search(query) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`/api/places?kind=play&q=${encodeURIComponent(query)}&x=${loc.x}&y=${loc.y}&radius=${radius}`, { signal: ctrl.signal });
      if (!r.ok) throw 0;
      return (await r.json()).places || [];
    } finally { clearTimeout(t); }
  }

  function start(chip) {
    let queries = CHIPS[chip];
    if (chip === "🎲 아무거나" && rainy) queries = INDOOR; // 비 오는 날 '아무거나'는 실내에서
    cur = { chip, queries, shown: new Set(), pool: new Map() };
    // 결과 화면으로 넘어갈 때 기록을 하나 남겨서, 휴대폰 뒤로가기로 첫 화면에 돌아오게 한다
    if (!$("main").classList.contains("talking")) try { history.pushState({ playResult: 1 }, ""); } catch {}
    $("main").classList.add("talking");
    document.querySelectorAll("#p-chips .chip").forEach((b) => b.classList.toggle("on", b.textContent === chip));
    pick();
  }

  const COUNT = 5;
  async function pick() {
    const out = $("#p-out");
    out.innerHTML = `<p class="p-wait">고르는 중…</p>`;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!loc) await within(initLocPromise, 6000);
    if (!loc) setLoc(FALLBACK, "위치를 몰라 강남역", { help: true });
    try {
      // 종류가 여러 개면 섞어서 최대 5종류를 한 번에 검색하고, 종류별로 돌아가며 한 곳씩 뽑는다
      const qs = shuffle(cur.queries).slice(0, COUNT);
      await Promise.all(qs.filter((q) => !cur.pool.has(q)).map(async (q) => cur.pool.set(q, await search(q))));
      const picks = [];
      const taken = new Set(cur.shown);
      for (let round = 0; picks.length < COUNT && round < COUNT; round++) {
        for (const q of qs) {
          if (picks.length >= COUNT) break;
          const fresh = cur.pool.get(q).filter((p) => !taken.has(p.id));
          if (!fresh.length) continue;
          const near = fresh.slice(0, 8); // 카카오 정확도순 앞쪽(많이 찾는 곳)에서
          const p = near[Math.floor(Math.random() * near.length)];
          taken.add(p.id);
          picks.push({ p, q });
        }
      }
      if (!picks.length) {
        out.innerHTML = `<p class="p-wait">근처 ${radius / 1000}km 안에서 더 찾을 곳이 없어요. ${radius < 5000 ? "'멀리 5km'로 바꾸거나 " : ""}다른 버튼을 눌러보세요.</p>`;
        return;
      }
      picks.forEach(({ p }) => cur.shown.add(p.id));
      picks.sort((x, y) => (Number(x.p.distance) || 1e9) - (Number(y.p.distance) || 1e9));
      await spin(out, qs.flatMap((q) => cur.pool.get(q).map((x) => x.place_name)));
      render(picks);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
      track("play_pick");
    } catch {
      out.innerHTML = `<p class="p-wait">지금 장소 정보를 불러오지 못했어요. 잠시 후 다시 눌러주세요.</p>`;
    }
  }

  async function spin(out, names) {
    const list = shuffle(names).slice(0, 8);
    for (let i = 0; i < Math.min(8, list.length * 2); i++) {
      out.innerHTML = `<p class="p-wait p-spin">🎡 ${esc(list[i % list.length])}</p>`;
      await new Promise((r) => setTimeout(r, 60 + i * 25));
    }
  }

  const lastCat = (p) => (p.category_name || "").split(">").map((s) => s.trim()).filter(Boolean).pop() || "";
  const meta = (p) => {
    const m = Number(p.distance);
    if (!m) return "";
    return m < 1500 ? `걸어서 ${Math.max(1, Math.round(m / 67))}분 · ${m}m` : `${(m / 1000).toFixed(1)}km`;
  };
  function routeUrl(p) {
    if (!p.x || !p.y) return `https://map.kakao.com/?q=${encodeURIComponent(p.place_name)}`;
    return `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
  }

  function render(picks) {
    const out = $("#p-out");
    const items = picks.map(({ p, q }) => ({ p, cat: lastCat(p) || q }));
    out.innerHTML = `
      <p class="p-count">${esc(cur.chip.replace(/^\S+\s/, ""))} · 근처 ${items.length}곳을 골랐어요</p>
      <ol class="p-list">${items.map(({ p, cat }) => `
        <li class="pick p-pick">
          <p class="food">${esc(cat)}${meta(p) ? ` · ${esc(meta(p))}` : ""}</p>
          <h2>${esc(p.place_name)}</h2>
          <p class="meta">${esc(p.road_address_name || p.address_name || "")}</p>
          <div class="actions">
            <a class="primary" href="${esc(routeUrl(p))}" target="_blank" rel="noopener">길찾기</a>
            <a href="${esc(p.place_url || routeUrl(p))}" target="_blank" rel="noopener">상세 보기</a>
          </div>
        </li>`).join("")}
      </ol>
      <div class="p-more">
        <button type="button" data-again>🎲 다른 ${COUNT}곳 보기</button>
        <button type="button" data-share>공유하기</button>
      </div>`;
    out.querySelector("[data-again]").onclick = pick;
    out.querySelector("[data-share]").onclick = async (e) => {
      const list = items.map(({ p, cat }, i) => `${i + 1}. ${p.place_name} (${cat})\n${p.place_url || routeUrl(p)}`).join("\n");
      const text = `오늘 여기 중에 어때?\n${list}\n\n오땡뭐!에서 골랐어요 👉 https://odaengmwo.com/play.html?from=share`;
      track("play_share");
      try { if (navigator.share) return await navigator.share({ text }); } catch (err) { if (err && err.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(text); e.target.textContent = "복사했어요"; } catch { prompt("이 내용을 복사해 주세요", text); }
    };
  }

  // ---------- 처음으로 ----------
  function reset() {
    $("main").classList.remove("talking");
    $("#p-out").innerHTML = "";
    cur = null;
    document.querySelectorAll("#p-chips .chip.on").forEach((b) => b.classList.remove("on"));
    $("#p-chips").scrollLeft = 0;
    window.scrollTo({ top: 0 });
  }
  $("#p-home").onclick = () => { if (history.state && history.state.playResult) history.back(); else reset(); };
  window.addEventListener("popstate", () => { if ($("main").classList.contains("talking")) reset(); });

  renderChips();
  OdChips.row($("#p-chips"));
  const initLocPromise = initLoc();
  try { if (new URLSearchParams(location.search).get("from") === "share") track("from_share"); } catch {}
})();

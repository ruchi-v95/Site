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
  const locText = $("#p-loc-text");
  function setLoc(next, label) {
    loc = next;
    locText.textContent = label ? `${label} 근처에서 찾고 있어요. 다른 곳이면 아래에 입력하세요.` : "내 위치 근처에서 찾고 있어요.";
    if (cur) { cur.shown.clear(); cur.pool.clear(); }
    loadWeather();
  }
  function geo() {
    return new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res({ x: p.coords.longitude, y: p.coords.latitude }), () => res(null), { timeout: 12000, maximumAge: 600000 });
    });
  }
  async function ipLoc() {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
    try { const r = await fetch("/api/ipgeo", { signal: ctrl.signal }); const d = r.ok ? await r.json() : null; return d && d.x ? d : null; }
    catch { return null; } finally { clearTimeout(t); }
  }
  async function initLoc() {
    const g = await geo();
    if (g) return setLoc(g);
    const ip = await ipLoc();
    if (ip) return setLoc({ x: ip.x, y: ip.y }, `${ip.name || "인터넷 접속 위치"}(대략)`);
    setLoc(FALLBACK, "위치를 몰라 강남역");
  }
  $("#p-where").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#p-where-q").value.trim();
    if (!q) return;
    locText.textContent = "찾는 중…";
    try {
      const r = await fetch(`/api/where?q=${encodeURIComponent(q)}`);
      const d = r.ok ? await r.json() : null;
      if (!d || !d.x) throw 0;
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
    pick();
  }

  async function pick() {
    const out = $("#p-out");
    out.innerHTML = `<p class="p-wait">고르는 중…</p>`;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (!loc) await initLocPromise;
    try {
      for (const query of shuffle(cur.queries).slice(0, 6)) {
        if (!cur.pool.has(query)) cur.pool.set(query, await search(query));
        const fresh = cur.pool.get(query).filter((p) => !cur.shown.has(p.id));
        if (!fresh.length) continue;
        const near = fresh.slice(0, 6); // 카카오 정확도순 앞쪽(많이 찾는 곳)에서
        const p = near[Math.floor(Math.random() * near.length)];
        cur.shown.add(p.id);
        await spin(out, fresh.map((q) => q.place_name));
        render(p, query);
        track("play_pick");
        return;
      }
      out.innerHTML = `<p class="p-wait">근처 ${radius / 1000}km 안에서 더 찾을 곳이 없어요. ${radius < 5000 ? "'멀리 5km'로 바꾸거나 " : ""}다른 버튼을 눌러보세요.</p>`;
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

  function render(p, query) {
    const out = $("#p-out");
    const cat = lastCat(p) || query;
    out.innerHTML = `
      <article class="pick p-pick">
        <p class="food">오늘은 ${esc(cat)}</p>
        <h2>${esc(p.place_name)}</h2>
        ${meta(p) ? `<p class="meta">${esc(meta(p))}</p>` : ""}
        <p class="meta">${esc(p.road_address_name || p.address_name || "")}</p>
        ${p.phone ? `<p class="meta"><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></p>` : ""}
        <div class="actions">
          <a class="primary" href="${esc(routeUrl(p))}" target="_blank" rel="noopener">길찾기</a>
          <a href="${esc(p.place_url || routeUrl(p))}" target="_blank" rel="noopener">상세 보기</a>
          <button type="button" data-again>다시 뽑기</button>
          <button type="button" data-share>공유하기</button>
        </div>
      </article>`;
    out.querySelector("[data-again]").onclick = pick;
    out.querySelector("[data-share]").onclick = async (e) => {
      const text = `오늘 여기 어때? ${p.place_name} (${cat})\n${p.place_url || routeUrl(p)}\n\n오땡뭐!에서 골랐어요 👉 https://odaengmwo.com/play.html?from=share`;
      track("play_share");
      try { if (navigator.share) return await navigator.share({ text }); } catch (err) { if (err && err.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(text); e.target.textContent = "복사했어요"; } catch { prompt("이 내용을 복사해 주세요", text); }
    };
  }

  renderChips();
  const initLocPromise = initLoc();
  try { if (new URLSearchParams(location.search).get("from") === "share") track("from_share"); } catch {}
})();

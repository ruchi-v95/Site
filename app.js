// 오땡뭐!: 카테고리/상황 버튼으로 카카오 장소 검색(무료)만 사용한다. 유료 AI는 쓰지 않는다.
(() => {
  // 음식 종류 버튼: 카카오 음식점 카테고리 이름으로 그대로 검색
  const CATEGORIES = {
    한식: "한식", 중식: "중식", 일식: "일식", 양식: "양식", 분식: "분식",
    치킨: "치킨", 고기: "고기", 아시안: "아시아음식", 패스트푸드: "패스트푸드",
  };
  // 상황 버튼: 어울리는 메뉴 이름 목록에서 하나를 뽑아 검색
  const SITUATIONS = {
    점심: ["국밥", "김치찌개", "돈까스", "제육볶음", "칼국수", "냉면", "비빔밥", "쌀국수", "초밥", "햄버거", "덮밥", "순두부찌개"],
    저녁: ["삼겹살", "치킨", "파스타", "마라탕", "족발", "곱창", "부대찌개", "감자탕", "초밥", "갈비", "양꼬치"],
    야식: ["치킨", "떡볶이", "족발", "보쌈", "피자", "라멘", "닭발", "순대"],
    혼밥: ["국밥", "라멘", "돈까스", "김밥", "햄버거", "덮밥", "우동", "쌀국수"],
    국물: ["국밥", "칼국수", "마라탕", "짬뽕", "쌀국수", "부대찌개", "김치찌개", "감자탕", "순두부찌개"],
    가볍게: ["샐러드", "샌드위치", "김밥", "포케", "쌀국수", "우동"],
  };
  const SITUATION_CHIPS = ["점심", "저녁", "야식", "혼밥", "국물", "가볍게", "아무거나"];
  const RECENT_KEY = "wmm.recent";
  const RECENT_MAX = 5;
  const MAX_PAGE = 3;
  // 이동 방법: 걸어서는 1km, 차로는 3km 안에서 찾는다
  const MODES = {
    walk: { label: "걸어서", radius: 1000, perMin: 67, word: "도보",   // 약 4km/h
      icon: '<circle cx="13" cy="4" r="2"/><path d="M8 21l3-7 3 3v5M10 10l-3 4M10 10l3-3 3 4 3 1M11 14l-1-4"/>' },
    car: { label: "차로", radius: 3000, perMin: 400, word: "차로",     // 시내 약 24km/h
      icon: '<path d="M5 17h14v-5l-2-5H7l-2 5z"/><path d="M5 12h14"/><circle cx="8" cy="17" r="1.8"/><circle cx="16" cy="17" r="1.8"/>' },
  };
  const MODE_KEY = "wmm.mode";
  // 카카오는 거리순일 때 이름·분류에 검색어가 없는 가게도 섞어 준다. 이름이나 분류에 이 말이 있는 가게만 고른다.
  const ALIASES = {
    라면: ["라면", "라멘"], 라멘: ["라멘", "라면"], 고기: ["고기", "육류", "삼겹", "갈비"],
    피자: ["피자"], 버거: ["버거"], 햄버거: ["햄버거", "버거"], 초밥: ["초밥", "스시", "회"],
    족발: ["족발"], 보쌈: ["보쌈", "족발"], 순대: ["순대"], 곱창: ["곱창", "막창"], 우동: ["우동"],
  };

  const $ = (s) => document.querySelector(s);
  const app = $("#app"), chat = $("#chat"), form = $("#ask"), input = $("#q"), notice = $("#notice");

  let loc = null;      // {x: 경도, y: 위도}
  let current = null;  // {queries, mode: "category"|"food", shown:Set, used:Set, pages:Map}
  let travel = "walk";
  try { if (MODES[localStorage.getItem(MODE_KEY)]) travel = localStorage.getItem(MODE_KEY); } catch {}
  const km = (m) => `${m / 1000}km`;

  // ---------- 저장소 (실패해도 동작) ----------
  const recent = {
    get() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } },
    add(v) {
      try {
        const list = [v, ...this.get().filter((f) => f !== v)].slice(0, RECENT_MAX);
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      } catch {}
    },
  };

  // ---------- 화면 ----------
  function timeSlot(d = new Date()) {
    const h = d.getHours();
    if (h >= 5 && h < 15) return "점심";
    if (h >= 15 && h < 21) return "저녁";
    return "야식";
  }

  function renderChips() {
    const slot = timeSlot();
    const situations = [slot, ...SITUATION_CHIPS.filter((c) => c !== slot)];
    fillChips($("#chips-cat"), Object.keys(CATEGORIES), (c) => ask(c, { category: c }));
    fillChips($("#chips-sit"), situations, (c) => ask(c, { situation: c }));
  }

  function fillChips(el, labels, onPick) {
    el.innerHTML = "";
    for (const c of labels) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = c;
      b.onclick = () => onPick(c);
      el.appendChild(b);
    }
  }

  function bubble(text, who = "bot", extra = "") {
    const el = document.createElement("div");
    el.className = `msg ${who} ${extra}`.trim();
    el.textContent = text;
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
    return el;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function lastCategory(p) {
    return (p.category_name || "").split(" > ").slice(-1)[0];
  }

  function metaLine(p, skip) {
    const cat = lastCategory(p);
    const dist = p.distance ? `${travelMinutes(p.distance)} · ${Number(p.distance).toLocaleString()}m` : "";
    return [dist, cat && cat !== skip ? cat : ""].filter(Boolean).join(" · ");
  }

  function routeUrl(p) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
  }

  function renderPick(label, p, query) {
    const el = document.createElement("article");
    el.className = "pick";
    const cat = lastCategory(p);
    const meta = metaLine(p, label);
    const route = routeUrl(p);
    const moreWord = cat || query;
    el.innerHTML = `
      <p class="food">오늘은 ${esc(label)}${p.demo ? '<span class="demo-tag">예시</span>' : ""}</p>
      <h2>${esc(p.place_name)}</h2>
      ${meta ? `<p class="meta">${esc(meta)}</p>` : ""}
      <p class="meta">${esc(p.road_address_name || p.address_name || "")}</p>
      ${p.phone ? `<p class="meta"><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></p>` : ""}
      <div class="actions">
        <a class="primary" href="${esc(route)}" target="_blank" rel="noopener">길찾기</a>
        <a href="${esc(p.place_url || route)}" target="_blank" rel="noopener">메뉴 보기</a>
        <button type="button" data-more>${esc(moreWord)} 더보기</button>
        <button type="button" data-again>다시 뽑기</button>
      </div>
      <ul class="more" hidden></ul>`;
    el.querySelector("[data-again]").onclick = () => pick();
    const moreBtn = el.querySelector("[data-more]");
    moreBtn.onclick = () => showMore(el, moreBtn, moreWord, p);
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // 같은 종류 가게를 거리순으로 5곳씩 보여준다. 누르면 5곳 더.
  async function showMore(card, btn, word, first) {
    const st = card._more || (card._more = { page: 0, end: false, list: [], seen: new Set([first.id]), idx: 0, radius: MODES[travel].radius });
    const ul = card.querySelector(".more");
    btn.disabled = true;
    btn.textContent = "찾는 중…";
    const here = await getLocation();
    while (st.list.length - st.idx < 5 && !st.end && st.page < MAX_PAGE) {
      st.page += 1;
      const { places, end } = await searchPlaces(word, here, st.page, st.radius);
      for (const q of places) if (!st.seen.has(q.id) && matches(q, word)) { st.seen.add(q.id); st.list.push(q); }
      st.end = end;
    }
    const batch = st.list.slice(st.idx, st.idx + 5);
    st.idx += batch.length;
    for (const q of batch) {
      const li = document.createElement("li");
      const meta = metaLine(q, word);
      li.innerHTML = `
        <div class="more-info">
          <a class="more-name" href="${esc(q.place_url || routeUrl(q))}" target="_blank" rel="noopener">${esc(q.place_name)}</a>
          ${meta ? `<span class="more-meta">${esc(meta)}</span>` : ""}
        </div>
        <a class="more-go" href="${esc(routeUrl(q))}" target="_blank" rel="noopener" aria-label="${esc(q.place_name)} 길찾기">길찾기</a>`;
      ul.appendChild(li);
    }
    ul.hidden = ul.children.length === 0;
    const left = st.idx < st.list.length || (!st.end && st.page < MAX_PAGE);
    if (!ul.children.length) {
      btn.textContent = `근처 ${km(st.radius)} 안에 다른 ${word} 가게가 없어요`;
    } else if (left) {
      btn.disabled = false;
      btn.textContent = `${word} 5곳 더`;
    } else {
      btn.textContent = "더 없어요";
    }
    if (batch.length) ul.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 가게 이름이나 카카오 분류에 검색어(또는 같은 뜻의 말)가 들어 있는지
  function matches(p, query) {
    const hay = `${p.place_name || ""} ${p.category_name || ""}`.replace(/\s/g, "");
    const terms = ALIASES[query] || [String(query).replace(/\s/g, "")];
    return terms.some((t) => hay.includes(t));
  }

  function travelMinutes(m) {
    const md = MODES[travel];
    return `${md.word} ${Math.max(1, Math.round(Number(m) / md.perMin))}분`;
  }

  // ---------- 이동 방법 (걸어서 / 차로) ----------
  function renderModes() {
    const box = $("#mode");
    box.innerHTML = "";
    for (const [key, md] of Object.entries(MODES)) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(key === travel));
      b.setAttribute("aria-label", `${md.label} ${km(md.radius)}`);
      b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${md.icon}</svg><small>${km(md.radius)}</small>`;
      b.onclick = () => setTravel(key);
      box.appendChild(b);
    }
  }

  function setTravel(key) {
    if (key === travel) return;
    travel = key;
    try { localStorage.setItem(MODE_KEY, key); } catch {}
    renderModes();
    if (current) { current.pages.clear(); current.used.clear(); }
    if (app.classList.contains("talking")) bubble(`이제 ${MODES[key].label} 갈 수 있는 ${km(MODES[key].radius)} 안에서 찾을게요.`);
  }

  // ---------- 위치 ----------
  // 첫 화면에서 위치 허용을 먼저 묻는다. 거절하면 강남역 기준으로 추천하고, 언제든 다시 허용할 수 있다.
  const FALLBACK = { x: 127.0276, y: 37.4979 }; // 강남역
  const locbar = $("#locbar"), locText = $("#loc-text"), locBtn = $("#loc-btn");
  let usingFallback = false;

  function showLocbar(state) {
    locbar.hidden = false;
    if (state === "denied") {
      locText.textContent = "위치가 꺼져 있어 강남역 기준으로 추천해요. 브라우저 설정에서 위치를 허용한 뒤 다시 시도를 눌러주세요.";
      locBtn.textContent = "다시 시도";
    } else {
      locText.textContent = "내 주변 가게를 찾으려면 위치 정보가 필요해요.";
      locBtn.textContent = "위치 허용";
    }
  }

  function requestLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { showLocbar("denied"); return resolve(null); }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          loc = { x: pos.coords.longitude, y: pos.coords.latitude };
          usingFallback = false;
          locbar.hidden = true;
          notice.hidden = true;
          resolve(loc);
        },
        () => { showLocbar("denied"); resolve(null); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  async function getLocation() {
    if (loc && !usingFallback) return loc;
    const got = await requestLocation();
    if (got) return got;
    usingFallback = true;
    loc = FALLBACK;
    notice.hidden = false;
    notice.textContent = "위치 권한이 없어 강남역 기준으로 추천하고 있어요.";
    return loc;
  }

  async function initLocation() {
    let state = "prompt";
    try {
      if (navigator.permissions) state = (await navigator.permissions.query({ name: "geolocation" })).state;
    } catch {}
    if (state === "granted") requestLocation(); // 이미 허용됨: 조용히 미리 가져온다
    else showLocbar(state);
  }

  locBtn.addEventListener("click", async () => {
    locBtn.disabled = true;
    locText.textContent = "위치를 확인하는 중…";
    await requestLocation();
    locBtn.disabled = false;
  });

  // ---------- 검색 (서버가 없으면 예시 데이터) ----------
  async function searchPlaces(query, { x, y }, page = 1, radius = MODES[travel].radius) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`/api/places?q=${encodeURIComponent(query)}&x=${x}&y=${y}&page=${page}&radius=${radius}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return { places: data.places || [], end: !!data.is_end };
    } catch {
      return { places: page === 1 ? demoPlaces(query, { x, y }) : [], end: true };
    } finally { clearTimeout(t); }
  }

  function demoPlaces(query, { x, y }) {
    const names = ["골목", "본점", "든든", "한그릇", "단골"];
    return names.map((n, i) => ({
      id: `demo-${query}-${i}`,
      place_name: `${query} ${n}집`,
      category_name: `음식점 > ${query}`,
      distance: String(150 + i * 170),
      road_address_name: "예시 주소 (실제 가게 아님)",
      phone: "",
      x: x + (i - 2) * 0.0012,
      y: y + (i % 2 ? 1 : -1) * 0.0009,
      place_url: "",
      demo: true,
    }));
  }

  // ---------- 입력 해석 (무료 규칙) ----------
  function interpret(text) {
    const cat = Object.keys(CATEGORIES).find((k) => text.includes(k));
    if (cat) return { mode: "category", queries: [CATEGORIES[cat]] };
    const foods = allFoods().filter((f) => text.includes(f));
    if (foods.length) return { mode: "food", queries: foods };
    const sit = Object.keys(SITUATIONS).find((k) => text.includes(k));
    if (sit) return { mode: "food", queries: SITUATIONS[sit] };
    if (/뜨끈|따뜻|해장|비\s?오/.test(text)) return { mode: "food", queries: SITUATIONS.국물 };
    if (/가볍|다이어트/.test(text)) return { mode: "food", queries: SITUATIONS.가볍게 };
    if (/혼자/.test(text)) return { mode: "food", queries: SITUATIONS.혼밥 };
    // 모르는 말이면 입력한 그대로 카카오에서 검색하고, 없으면 시간대 메뉴로
    return { mode: "food", queries: [text.slice(0, 20)], fallback: SITUATIONS[timeSlot()] };
  }

  function allFoods() { return [...new Set(Object.values(SITUATIONS).flat())]; }

  function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

  // ---------- 추천 ----------
  async function ask(text, { category, situation } = {}) {
    text = text.trim();
    if (!text) return;
    app.classList.add("talking");
    bubble(text, "me");
    let plan;
    if (category) plan = { mode: "category", queries: [CATEGORIES[category]] };
    else if (situation === "아무거나") plan = { mode: "category", queries: shuffle(Object.values(CATEGORIES)) };
    else if (situation) plan = { mode: "food", queries: SITUATIONS[situation] };
    else plan = interpret(text);
    current = { ...plan, shown: new Set(), used: new Set(), pages: new Map() };
    await pick();
  }

  async function pick() {
    if (!current) return;
    chat.querySelectorAll("[data-again]").forEach((b) => b.remove()); // 마지막 카드에만 남김
    const typing = bubble("고르는 중…", "bot", "typing");
    const here = await getLocation();

    const avoid = new Set(recent.get());
    let order = shuffle(current.queries.filter((q) => !current.used.has(q)));
    order = [...order.filter((q) => !avoid.has(q)), ...order.filter((q) => avoid.has(q))];
    if (!order.length) { current.used.clear(); order = shuffle(current.queries); }
    if (current.fallback) order = [...order, ...shuffle(current.fallback)];

    for (const query of order.slice(0, 5)) {
      const p = await nextPlace(query, here);
      if (!p) { current.used.add(query); continue; }
      const label = current.mode === "category" ? lastCategory(p) || query : query;
      if (current.mode === "food") current.used.add(query); // 다음엔 다른 메뉴
      recent.add(label);
      typing.remove();
      renderPick(label, p, query);
      return;
    }
    typing.remove();
    bubble(`근처 ${km(MODES[travel].radius)} 안에서 더 찾을 곳이 없어요. ${travel === "walk" ? "차로를 눌러 더 넓게 찾거나 " : ""}다른 버튼을 눌러보세요.`);
  }

  // 거리순 결과 앞쪽에서 아직 안 보여준 곳을 무작위로 하나. 다 보여줬으면 다음 페이지.
  async function nextPlace(query, here) {
    let page = current.pages.get(query) || 1;
    while (page <= MAX_PAGE) {
      const { places, end } = await searchPlaces(query, here, page);
      const fresh = places.filter((p) => !current.shown.has(p.id) && (p.demo || matches(p, query)));
      if (fresh.length) {
        const near = fresh.slice(0, 5);
        const p = near[Math.floor(Math.random() * near.length)];
        current.shown.add(p.id);
        current.pages.set(query, page);
        return p;
      }
      if (end) break;
      page += 1;
    }
    current.pages.set(query, MAX_PAGE + 1);
    return null;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    input.blur();
    ask(v);
  });

  // ---------- 배너 단어 순환 ----------
  function startRotator() {
    const words = ["점심", "저녁", "야식", "간식"];
    const el = $("#rot-word"), sr = $("#rot-sr");
    let i = Math.max(0, words.indexOf(timeSlot()));
    el.textContent = sr.textContent = words[i];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // 움직임 줄이기: 지금 시간대 단어로 고정
    setInterval(() => {
      if (document.hidden) return;
      el.classList.add("out");
      setTimeout(() => {
        i = (i + 1) % words.length;
        el.textContent = words[i];
        el.classList.remove("out");
        el.classList.add("pre");
        void el.offsetWidth; // 아래에서 올라오도록 위치를 먼저 적용
        el.classList.remove("pre");
      }, 350);
    }, 2200);
  }

  renderModes();
  renderChips();
  initLocation();
  startRotator();
})();

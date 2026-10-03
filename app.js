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
  // 날씨 맞춤: 지금 날씨에 어울리는 메뉴를 상황 버튼 맨 앞에 보여준다 (기상청 초단기실황)
  const WEATHER = {
    비: { chip: "☔ 비 오는 날", line: "비가 오네요. 뜨끈한 국물이나 전 어때요?", foods: ["칼국수", "짬뽕", "파전", "부대찌개", "감자탕", "국밥", "수제비"] },
    눈: { chip: "❄️ 눈 오는 날", line: "눈이 와요. 따끈한 걸로 골라볼까요?", foods: ["국밥", "김치찌개", "감자탕", "칼국수", "순두부찌개", "마라탕"] },
    추위: { chip: "🥶 추운 날", line: "날이 차요. 뜨끈한 거 어때요?", foods: ["국밥", "김치찌개", "감자탕", "순두부찌개", "칼국수", "마라탕", "샤브샤브"] },
    더위: { chip: "🥵 더운 날", line: "덥네요. 시원한 거 어때요?", foods: ["냉면", "막국수", "콩국수", "물회", "초밥", "샐러드", "밀면"] },
  };
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
    // 카카오는 메뉴 정보를 주지 않아서, 분식집처럼 대부분 그 메뉴를 파는 분류를 함께 넣는다
    라면: ["라면", "라멘", "분식"], 라멘: ["라멘", "라면"], 김밥: ["김밥", "분식"], 떡볶이: ["떡볶이", "분식"], 고기: ["고기", "육류", "삼겹", "갈비"],
    피자: ["피자"], 버거: ["버거"], 햄버거: ["햄버거", "버거"], 초밥: ["초밥", "스시", "참치", "오마카세"],
    파전: ["파전", "전집", "빈대떡", "부침"], 수제비: ["수제비", "칼국수"], 샤브샤브: ["샤브"],
    막국수: ["막국수", "메밀"], 콩국수: ["콩국수"], 물회: ["물회", "횟집"], 밀면: ["밀면", "냉면"],
    // 상황 버튼 메뉴: 가게 이름이나 카카오 분류에 흔히 쓰이는 말
    국밥: ["국밥", "해장국", "설렁탕", "곰탕", "순대국"], 김치찌개: ["김치찌개", "찌개", "김치찜"],
    돈까스: ["돈까스", "돈가스", "카츠"], 제육볶음: ["제육", "백반", "기사식당"], 칼국수: ["칼국수", "국수"],
    냉면: ["냉면", "막국수", "면옥"], 비빔밥: ["비빔밥", "비빔", "백반"], 쌀국수: ["쌀국수", "베트남"],
    덮밥: ["덮밥", "돈부리", "규동"], 순두부찌개: ["순두부"], 삼겹살: ["삼겹", "돼지고기"],
    파스타: ["파스타", "이탈리", "양식"], 마라탕: ["마라"], 부대찌개: ["부대"], 감자탕: ["감자탕", "뼈해장국"],
    갈비: ["갈비"], 양꼬치: ["양꼬치", "양고기"], 짬뽕: ["짬뽕", "중식", "중국"], 샐러드: ["샐러드", "포케"],
    샌드위치: ["샌드위치", "서브웨이", "토스트"], 포케: ["포케", "샐러드"], 닭발: ["닭발"],
    족발: ["족발"], 보쌈: ["보쌈", "족발"], 순대: ["순대", "분식"], 곱창: ["곱창", "막창"], 우동: ["우동"],
  };

  const $ = (s) => document.querySelector(s);
  const app = $("#app"), chat = $("#chat"), form = $("#ask"), input = $("#q"), notice = $("#notice");

  let loc = null;      // {x: 경도, y: 위도}
  let current = null;  // {queries, mode: "category"|"food", shown:Set, used:Set, pages:Map}
  let weather = null; // WEATHER의 키 (비·눈·추위·더위) 또는 null
  let excluded = new Set(); // "한식 빼고"처럼 이번에 뺀 종류·메뉴 (처음으로 가면 초기화)
  let run = 0;         // 마지막 추천 요청 번호. 빠르게 여러 번 누르면 마지막 것만 보여준다
  // 로컬에서 서버 없이 열 때만 예시 가게를 쓴다. 실제 사이트에서는 실패를 그대로 알린다
  const DEMO_OK = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
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
    const w = weather && WEATHER[weather];
    fillChips($("#chips-cat"), Object.keys(CATEGORIES), (c) => ask(c, { category: c }));
    fillChips($("#chips-sit"), w ? [w.chip, ...situations] : situations, (c) =>
      w && c === w.chip ? ask(c, { foods: w.foods }) : ask(c, { situation: c }));
    if (w) $("#chips-sit").firstElementChild.classList.add("chip-weather");
  }

  // 위치를 알면 그 동네 날씨를 한 번 가져온다. 키가 없거나 실패하면 조용히 넘어간다.
  async function loadWeather() {
    if (!loc || usingFallback) return;
    try {
      const r = await fetch(`/api/weather?x=${loc.x.toFixed(2)}&y=${loc.y.toFixed(2)}`);
      if (!r.ok) return;
      const { temp, pty } = await r.json();
      const next = [1, 2, 4, 5].includes(pty) ? "비" : [3, 6, 7].includes(pty) ? "눈"
        : temp <= 5 ? "추위" : temp >= 27 ? "더위" : null;
      if (next === weather) return;
      weather = next;
      renderChips();
      const tag = $(".tagline");
      if (tag && next) tag.textContent = `${WEATHER[next].line} (지금 ${Math.round(temp)}°)`;
    } catch {}
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

  // 도착지만 있는 카카오맵 링크 (공유용: 보내는 사람 위치를 넣지 않는다)
  function destUrl(p) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
  }

  // 길찾기: 출발지를 함께 넣어야 카카오맵에서 출발지가 비지 않는다. 위치를 모르면(강남역 대체) 도착지만.
  function routeUrl(p) {
    if (!loc || usingFallback) return destUrl(p);
    const from = `${encodeURIComponent(locName || "내 위치")},${loc.y},${loc.x}`;
    return `https://map.kakao.com/link/from/${from}/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
  }

  function renderPick(label, p, query, pool = []) {
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
        <button type="button" data-share>공유하기</button>
        <button type="button" data-again>다시 뽑기</button>
        <button type="button" data-again data-skip>${esc(skipWord(p, query))} 빼고</button>
      </div>
      <ul class="more" hidden></ul>`;
    el.querySelector("[data-again]").onclick = () => pick();
    el.querySelector("[data-skip]").onclick = () => skipAndPick(skipWord(p, query));
    const moreBtn = el.querySelector("[data-more]");
    moreBtn.onclick = () => showMore(el, moreBtn, moreWord, p);
    const shareBtn = el.querySelector("[data-share]");
    shareBtn.onclick = () => sharePick(shareBtn, label, p);
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // 이 카드에서 "빼고"를 누를 때 뺄 말: 메뉴로 찾았으면 그 메뉴, 종류로 찾았으면 큰 분류(한식·중식…)
  function skipWord(p, query) {
    if (current && current.mode === "food") return query;
    return (p.category_name || "").split(" > ")[1] || lastCategory(p) || query;
  }

  function isExcluded(p) {
    if (!excluded.size) return false;
    const hay = `${p.place_name || ""} ${p.category_name || ""}`;
    return [...excluded].some((w) => hay.includes(w));
  }

  function skipAndPick(word) {
    excluded.add(word);
    bubble(`${word} 빼고`, "me");
    pick();
  }

  // 결과를 보여주기 전 가게 이름이 슬롯처럼 돌아가는 연출 (움직임 줄이기 설정이면 생략)
  async function spin(el, names, stale) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || names.length < 2) return;
    el.classList.add("slot");
    let delay = 60;
    for (let i = 0; delay < 260; i++) {
      if (stale()) return;
      el.textContent = names[i % names.length];
      await new Promise((r) => setTimeout(r, delay));
      delay *= 1.18;
    }
  }

  // 카톡·문자 등 휴대폰 공유 창으로 보내기. 공유 창이 없는 PC에서는 글을 복사한다.
  async function sharePick(btn, label, p) {
    const link = p.place_url || destUrl(p);
    const text = `오늘은 ${label}! "${p.place_name}" 어때?\n${link}\n\n오땡뭐!에서 골랐어요 👉 https://odaengmwo.com`;
    try {
      if (navigator.share) { await navigator.share({ title: "오땡뭐!", text }); return; }
      await navigator.clipboard.writeText(text);
      btn.textContent = "복사했어요";
    } catch (e) {
      if (e && e.name === "AbortError") return; // 공유 창을 닫은 경우
      btn.textContent = "공유하지 못했어요";
    }
    setTimeout(() => { btn.textContent = "공유하기"; }, 2000);
  }

  // 같은 종류 가게를 거리순으로 5곳씩 보여준다. 누르면 5곳 더.
  async function showMore(card, btn, word, first) {
    const st = card._more || (card._more = { page: 0, end: false, list: [], seen: new Set([first.id]), idx: 0, radius: MODES[travel].radius });
    const ul = card.querySelector(".more");
    btn.disabled = true;
    btn.textContent = "찾는 중…";
    const here = await getLocation();
    while (st.list.length - st.idx < 5 && !st.end && st.page < MAX_PAGE) {
      const { places, end, failed } = await searchPlaces(word, here, st.page + 1, st.radius);
      if (failed) { btn.disabled = false; btn.textContent = "불러오지 못했어요 · 다시"; return; }
      st.page += 1;
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
          <a class="more-name" href="${esc(q.place_url || destUrl(q))}" target="_blank" rel="noopener">${esc(q.place_name)}</a>
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
    if (!app.classList.contains("talking")) return;
    // 방금 찾을 곳이 없었다면 넓힌 반경으로 같은 내용을 바로 다시 찾는다
    if (current && current.empty) {
      bubble(`${MODES[key].label} ${km(MODES[key].radius)} 안에서 다시 찾아볼게요.`);
      pick();
    } else {
      bubble(`이제 ${MODES[key].label} 갈 수 있는 ${km(MODES[key].radius)} 안에서 찾을게요.`);
    }
  }

  // ---------- 위치 ----------
  // 첫 화면에서 위치 허용을 먼저 묻는다. 거절하면 강남역 기준으로 추천하고, 언제든 다시 허용할 수 있다.
  const FALLBACK = { x: 127.0276, y: 37.4979 }; // 강남역
  const locbar = $("#locbar"), locText = $("#loc-text"), locBtn = $("#loc-btn");
  let usingFallback = false;
  let locName = null; // 길찾기 출발지 이름 (내 위치 또는 입력한 동네)

  function showLocbar(state) {
    locbar.hidden = false;
    locBtn.hidden = false;
    if (state === "denied") {
      locText.textContent = "위치 권한이 꺼져 있어요. 주소창 왼쪽 아이콘에서 위치를 허용한 뒤 다시 시도를 누르거나, 아래에 동네 이름을 입력하세요.";
      locBtn.textContent = "다시 시도";
    } else if (state === "unavailable") {
      // 권한은 있는데 기기가 위치를 못 찾는 경우 (PC에서 흔함: Windows/맥 위치 서비스 꺼짐, 유선 인터넷)
      locText.textContent = "이 기기에서 위치를 찾지 못했어요. PC라면 Windows 설정 > 개인 정보 > 위치(맥은 시스템 설정 > 개인정보 보호 > 위치 서비스)를 켜거나, 아래에 동네 이름을 입력하세요.";
      locBtn.textContent = "다시 시도";
    } else if (state === "change") {
      locText.textContent = "다른 동네 이름을 입력하거나, 내 위치로 다시 찾을 수 있어요.";
      locBtn.textContent = "내 위치로";
    } else {
      locText.textContent = "내 주변 가게를 찾으려면 위치 정보가 필요해요.";
      locBtn.textContent = "위치 허용";
    }
  }

  function setLoc(next, label) {
    loc = next;
    locName = label || "내 위치";
    usingFallback = false;
    locbar.hidden = true;
    if (label) showNotice(`${label} 근처에서 추천하고 있어요.`);
    else notice.hidden = true;
    loadWeather();
  }

  // 아래 안내 줄: 지금 어느 위치 기준인지 + 위치 바꾸기
  function showNotice(text) {
    notice.hidden = false;
    notice.textContent = text + " ";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "notice-btn";
    b.textContent = "위치 바꾸기";
    b.onclick = () => {
      showLocbar("change");
      locbar.scrollIntoView({ behavior: "smooth", block: "center" });
      $("#where-q").focus({ preventScroll: true });
    };
    notice.appendChild(b);
  }

  function requestLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { showLocbar("unavailable"); return resolve(null); }
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLoc({ x: pos.coords.longitude, y: pos.coords.latitude }); resolve(loc); },
        (err) => { showLocbar(err && err.code === 1 ? "denied" : "unavailable"); resolve(null); },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
      );
    });
  }

  // 동네·역 이름으로 위치 정하기 (카카오 키워드 검색의 첫 결과 좌표)
  $("#where").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#where-q").value.trim();
    if (!q) return;
    locText.textContent = "찾는 중…";
    try {
      const r = await fetch(`/api/where?q=${encodeURIComponent(q)}`);
      const d = r.ok ? await r.json() : null;
      if (!d || !d.x) throw new Error("none");
      setLoc({ x: Number(d.x), y: Number(d.y) }, d.name);
      if (current) { current.pages.clear(); current.used.clear(); }
      $("#where-q").value = "";
      if (app.classList.contains("talking")) bubble(`이제 ${d.name} 근처에서 찾을게요.`);
    } catch {
      locText.textContent = `"${q}"을(를) 찾지 못했어요. 역이나 동 이름으로 다시 입력해 보세요.`;
    }
  });

  async function getLocation() {
    if (loc && !usingFallback) return loc;
    const got = await requestLocation();
    if (got) return got;
    usingFallback = true;
    loc = FALLBACK;
    showNotice("위치를 알 수 없어 강남역 기준으로 추천하고 있어요.");
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
      if (DEMO_OK) return { places: page === 1 ? demoPlaces(query, { x, y }) : [], end: true };
      return { places: [], end: true, failed: true };
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
    // "한식 말고 중식", "국밥 빼고"처럼 뺄 말을 먼저 떼어낸다
    const skip = [...text.matchAll(/(\S+?)\s*(?:은|는|이|가)?\s*(?:말고|빼고|제외)/g)].map((m) => m[1]);
    if (skip.length) {
      for (const w of skip) excluded.add(CATEGORIES[w] || w);
      text = text.replace(/(\S+?)\s*(?:은|는|이|가)?\s*(?:말고|빼고|제외)(?:하고)?/g, " ").trim();
      if (!text) return { mode: "category", queries: shuffle(Object.values(CATEGORIES)) };
    }
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
  async function ask(text, { category, situation, foods } = {}) {
    text = text.trim();
    if (!text) return;
    app.classList.add("talking");
    bubble(text, "me");
    let plan;
    if (foods) plan = { mode: "food", queries: foods };
    else if (category) plan = { mode: "category", queries: [CATEGORIES[category]] };
    else if (situation === "아무거나") plan = { mode: "category", queries: shuffle(Object.values(CATEGORIES)) };
    else if (situation) plan = { mode: "food", queries: SITUATIONS[situation] };
    else plan = interpret(text);
    current = { ...plan, shown: new Set(), used: new Set(), pages: new Map() };
    await pick();
  }

  async function pick() {
    if (!current) return;
    const ctx = current, id = ++run;
    chat.querySelectorAll("[data-again], .typing").forEach((b) => b.remove()); // 마지막 카드에만 남김
    const typing = bubble("고르는 중…", "bot", "typing");
    const stale = () => id !== run; // 그사이 다른 버튼을 눌렀으면 이 요청은 버린다
    const here = await getLocation();
    if (stale()) return typing.remove();

    const avoid = new Set(recent.get());
    // 뺀 종류는 검색어에서도 제외. 다 빠지면 나머지 종류 전체에서 고른다
    let queries = ctx.queries.filter((q) => !excluded.has(q));
    if (!queries.length) {
      ctx.mode = "category";
      ctx.queries = queries = shuffle(Object.values(CATEGORIES).filter((q) => !excluded.has(q)));
    }
    let order = shuffle(queries.filter((q) => !ctx.used.has(q)));
    order = [...order.filter((q) => !avoid.has(q)), ...order.filter((q) => avoid.has(q))];
    if (!order.length) { ctx.used.clear(); order = shuffle(queries); }
    if (ctx.fallback) order = [...order, ...shuffle(ctx.fallback)];

    ctx.failed = false;
    ctx.empty = false;
    for (const query of order.slice(0, 5)) {
      const p = await nextPlace(ctx, query, here);
      if (stale()) return typing.remove();
      if (ctx.failed) break;
      if (!p) { ctx.used.add(query); continue; }
      const label = ctx.mode === "category" ? lastCategory(p) || query : query;
      if (ctx.mode === "food") ctx.used.add(query); // 다음엔 다른 메뉴
      recent.add(label);
      await spin(typing, shuffle([...(ctx.pool || []), p.place_name]), stale);
      if (stale()) return typing.remove();
      typing.remove();
      renderPick(label, p, query);
      return;
    }
    typing.remove();
    if (ctx.failed) {
      const el = bubble("지금 가게 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      const b = document.createElement("button");
      b.type = "button"; b.className = "retry"; b.textContent = "다시 시도"; b.setAttribute("data-again", "");
      b.onclick = () => pick();
      el.appendChild(b);
      return;
    }
    ctx.empty = true;
    const msg = bubble(`근처 ${km(MODES[travel].radius)} 안에서 더 찾을 곳이 없어요. ${travel === "walk" ? "차로 넓혀서 찾거나 " : ""}다른 버튼을 눌러보세요.`);
    if (travel === "walk") {
      const b = document.createElement("button");
      b.type = "button"; b.className = "retry"; b.setAttribute("data-again", "");
      b.textContent = `차로 ${km(MODES.car.radius)}까지 넓혀서 찾기`;
      b.onclick = () => setTravel("car");
      msg.appendChild(b);
    }
  }

  // 거리순 결과 앞쪽에서 아직 안 보여준 곳을 무작위로 하나. 다 보여줬으면 다음 페이지.
  async function nextPlace(ctx, query, here) {
    let page = ctx.pages.get(query) || 1;
    while (page <= MAX_PAGE) {
      const { places, end, failed } = await searchPlaces(query, here, page);
      if (failed) { ctx.failed = true; return null; }
      const fresh = places.filter((p) => !ctx.shown.has(p.id) && !isExcluded(p) && (p.demo || matches(p, query)));
      if (fresh.length) {
        const near = fresh.slice(0, 5);
        ctx.pool = fresh.slice(0, 8).map((q) => q.place_name);
        const p = near[Math.floor(Math.random() * near.length)];
        ctx.shown.add(p.id);
        ctx.pages.set(query, page);
        return p;
      }
      if (end) break;
      page += 1;
    }
    ctx.pages.set(query, MAX_PAGE + 1);
    return null;
  }

  // 처음 화면으로: 진행 중인 추천은 버리고 대화를 지운다
  $("#home").addEventListener("click", () => {
    run += 1;
    current = null;
    excluded = new Set();
    chat.innerHTML = "";
    input.value = "";
    app.classList.remove("talking");
    window.scrollTo({ top: 0 });
  });

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

  // 테스트 단계 안내 문구를 장난스럽게 바꿔가며 보여준다
  function startBeta() {
    const el = $("#beta-msg");
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = ["열심히 고치는 중", "개발자 삽질 중 ⛏️", "버그 잡는 중 🐛", "맛집 데이터 닦는 중 🧽", "커피 수혈 중 ☕", "야근 중 🌙"];
    let i = 0;
    setInterval(() => {
      if (document.hidden || app.classList.contains("talking")) return;
      el.classList.add("swap");
      setTimeout(() => { i = (i + 1) % lines.length; el.textContent = lines[i]; el.classList.remove("swap"); }, 250);
    }, 2600);
  }

  renderModes();
  startBeta();
  renderChips();
  initLocation();
  startRotator();
})();

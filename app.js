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
  const SITUATION_CHIPS = ["점심", "저녁", "야식", "혼밥", "국물", "가볍게"];
  const ANY_CHIP = "아무거나"; // 맨 위 줄 맨 앞
  const CHEAP_CHIP = "💰 착한가격";
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
  // 게임판: 가게를 담아 게임(달리기·돌림판·사다리·폭탄)으로 하나를 고른다
  const TRAY_KEY = "wmm.tray";
  const TRAY_MAX = 8;
  const GAME_KEY = "wmm.game";
  const EMOJI = [[/돈까스|돈가스|카츠/, "🐷"], [/마라/, "🌶️"], [/칼국수|우동|냉면|라멘|라면|국수|소바|쌀국수/, "🍜"], [/중식|중국|반점|짜장|짬뽕|만두|마라|양꼬치/, "🥟"], [/김밥|도시락/, "🍱"], [/치킨|닭/, "🍗"],
    [/버거|햄버거/, "🍔"], [/피자/, "🍕"], [/일식|초밥|스시|회/, "🍣"], [/떡볶이|분식/, "🍢"], [/죽/, "🥣"], [/고기|삼겹|돼지|갈비|보쌈|족발|곱창/, "🥩"],
    [/국밥|탕|찌개|해장|설렁/, "🍲"], [/카페|커피|다방|디저트/, "🧋"], [/양식|파스타|스테이크/, "🍝"], [/술집|호프|포차/, "🍺"], [/한식|백반|식당/, "🍚"]];
  const emojiOf = (p) => (EMOJI.find(([r]) => r.test(`${p.place_name || ""} ${p.category_name || ""} ${p.cat || ""}`)) || [0, "🍽️"])[1];
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
  // 사용 횟수 세기 (api/stat.js). 실패해도 화면에는 영향 없다
  const track = (e) => { try { navigator.sendBeacon && navigator.sendBeacon(`/api/stat?e=${e}`); } catch {} };
  const app = $("#app"), chat = $("#chat"), form = $("#ask"), input = $("#q"), notice = $("#notice");

  let loc = null;      // {x: 경도, y: 위도}
  let current = null;  // {queries, mode: "category"|"food", shown:Set, used:Set, pages:Map}
  let weather = null; // WEATHER의 키 (비·눈·추위·더위) 또는 null
  let excluded = new Set(); // "한식 빼고"처럼 이번에 뺀 종류·메뉴 (처음으로 가면 초기화)
  let run = 0;         // 마지막 추천 요청 번호. 빠르게 여러 번 누르면 마지막 것만 보여준다
  // 로컬에서 서버 없이 열 때만 예시 가게를 쓴다. 실제 사이트에서는 실패를 그대로 알린다
  const DEMO_OK = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
  let tray = [];
  try {
    tray = (JSON.parse(localStorage.getItem(TRAY_KEY)) || []).filter((q) => q && q.place_name).slice(0, TRAY_MAX);
    // 예전에 게임 화면이 저절로 넣었던 메뉴(typed 없음)는 한 번 비운다
    if (!localStorage.getItem("wmm.tray.v2")) { tray = tray.filter((q) => !q.menu || q.typed); localStorage.setItem(TRAY_KEY, JSON.stringify(tray)); localStorage.setItem("wmm.tray.v2", "1"); }
  } catch {}
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
    fillChips($("#chips-cat"), [ANY_CHIP, ...Object.keys(CATEGORIES)], (c) => c === ANY_CHIP ? ask(c, { situation: c }) : ask(c, { category: c }));
    $("#chips-cat").firstElementChild.classList.add("chip-any");
    const sit = [...(w ? [w.chip] : []), situations[0], CHEAP_CHIP, ...situations.slice(1)];
    fillChips($("#chips-sit"), sit, (c) =>
      w && c === w.chip ? ask(c, { foods: w.foods }) : c === CHEAP_CHIP ? ask(c, { cheap: true }) : ask(c, { situation: c }));
    if (w) $("#chips-sit").firstElementChild.classList.add("chip-weather");
    [...$("#chips-sit").children].find((b) => b.textContent === CHEAP_CHIP)?.classList.add("chip-cheap");
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

  // 칩 줄: PC에서도 한 줄 가로 스크롤. 마우스 휠(세로)을 가로로 바꾸고, 끌어서 넘길 수 있게 한다.
  function scrollRow(el) {
    const fade = () => {
      const max = el.scrollWidth - el.clientWidth;
      el.classList.toggle("fade-l", el.scrollLeft > 2);
      el.classList.toggle("fade-r", max - el.scrollLeft > 2);
    };
    el.addEventListener("scroll", fade, { passive: true });
    new ResizeObserver(fade).observe(el);
    new MutationObserver(fade).observe(el, { childList: true });
    el.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }, { passive: false });
    let down = null, moved = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = { x: e.clientX, left: el.scrollLeft }; moved = false;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 5) { moved = true; el.classList.add("dragging"); }
      if (moved) el.scrollLeft = down.left - dx;
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = null;
      if (moved) setTimeout(() => el.classList.remove("dragging"), 0);
    });
    // 끌다가 놓은 자리의 칩이 눌리지 않게
    el.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    fade();
  }
  document.querySelectorAll(".chips").forEach(scrollRow);

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
    if (!p.x || !p.y) return `https://map.kakao.com/?q=${encodeURIComponent(p.place_name)}`;
    return `https://map.kakao.com/link/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
  }

  // 길찾기: 출발지를 함께 넣어야 카카오맵에서 출발지가 비지 않는다. 위치를 모르면(강남역 대체) 도착지만.
  function routeUrl(p) {
    if (!loc || usingFallback || !p.x || !p.y) return destUrl(p);
    const from = `${encodeURIComponent(locName || "내 위치")},${loc.y},${loc.x}`;
    return `https://map.kakao.com/link/from/${from}/to/${encodeURIComponent(p.place_name)},${p.y},${p.x}`;
  }

  function renderPick(label, p, query, others = []) {
    const el = document.createElement("article");
    el.className = "pick";
    const cat = lastCategory(p);
    const meta = metaLine(p, label);
    const route = routeUrl(p);
    const moreWord = p.cheap ? "착한가격" : cat || query;
    el.innerHTML = `
      <p class="food">오늘은 ${esc(label)}${p.demo ? '<span class="demo-tag">예시</span>' : ""}${p.cheap ? '<span class="cheap-tag">착한가격업소</span>' : ""}${p.hot ? '<span class="cheap-tag hot-tag">🔥 리뷰 많은 집</span>' : ""}</p>
      <h2>${esc(p.place_name)}</h2>
      ${p.menus && p.menus.length ? `<p class="menus">${p.menus.map(([m, won]) => `${esc(m)} <b>${Number(won).toLocaleString()}원</b>`).join(" · ")}</p>` : ""}
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
        <button type="button" class="tray-add wide${inTray(p) ? " on" : ""}" data-tray>${inTray(p) ? TRAY_ON : TRAY_OFF}</button>
        ${p.demo ? "" : `<button type="button" class="wide" data-tray-poll hidden></button>`}
      </div>
      <ul class="more" hidden></ul>`;
    el.querySelector("[data-again]").onclick = () => pick();
    el.querySelector("[data-skip]").onclick = () => skipAndPick(skipWord(p, query));
    const moreBtn = el.querySelector("[data-more]");
    moreBtn.onclick = () => showMore(el, moreBtn, moreWord, p);
    const shareBtn = el.querySelector("[data-share]");
    shareBtn.onclick = () => sharePick(shareBtn, label, p);
    const trayBtn = el.querySelector("[data-tray]");
    trayBtn.onclick = () => { if (addTray(p)) markAdded(trayBtn, TRAY_ON); };
    chat.appendChild(el);
    paintPollBtns();
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // 같이 고르기: 후보를 저장하고 투표 링크를 단톡방 등으로 보낸다
  async function startPoll(btn, label, places) {
    btn.disabled = true;
    btn.textContent = "투표 만드는 중…";
    try {
      const r = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: label,
          places: places.map((q) => ({ name: q.place_name, cat: q.menu ? "메뉴" : lastCategory(q), addr: q.road_address_name || q.address_name, x: q.x, y: q.y, url: q.place_url })),
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const { id } = await r.json();
      const link = `${location.origin}/vote.html?id=${id}`;
      track("poll");
      const ask = places.every((q) => q.menu) ? "오늘 뭐 먹을까?" : label ? `오늘 ${label} 어디서 먹을까?` : "오늘 어디서 먹을까?";
      const text = `${ask} 투표해줘 🗳️\n${places.map((q) => "· " + q.place_name).join("\n")}\n${link}`;
      btn.disabled = false;
      btn.textContent = "투표 결과 보기";
      btn.onclick = () => window.open(link, "_blank", "noopener");
      try {
        if (navigator.share) await navigator.share({ title: "오땡뭐! 같이 고르기", text });
        else { await navigator.clipboard.writeText(text); bubble("투표 링크를 복사했어요. 단톡방에 붙여넣어 보내세요."); }
      } catch (e) {
        if (!e || e.name !== "AbortError") bubble(`이 링크를 보내주세요: ${link}`);
      }
    } catch {
      btn.disabled = false;
      btn.textContent = "투표를 만들지 못했어요 · 다시";
    }
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
    track("share");
    const link = p.place_url || destUrl(p);
    const text = `오늘은 ${label}! "${p.place_name}" 어때?\n${link}\n\n오땡뭐!에서 골랐어요 👉 https://odaengmwo.com/?from=share`;
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
    if (first.cheap && !st.cheapLoaded) {
      // 착한가격업소는 이미 받아 둔 동네 목록에서 가까운 순으로
      st.cheapLoaded = true;
      st.end = true;
      st.page = MAX_PAGE;
      try {
        const all = await cheapPlaces(await getLocation());
        st.list = all.filter((q) => q.id !== first.id && Number(q.distance) <= st.radius).sort((a, b) => a.distance - b.distance);
      } catch { st.list = []; }
    }
    const ul = card.querySelector(".more");
    btn.disabled = true;
    btn.textContent = "찾는 중…";
    const here = await getLocation();
    while (st.list.length - st.idx < 5 && !st.end && st.page < MAX_PAGE) {
      const { places, end, failed } = await searchPlaces(word, here, st.page + 1, st.radius, "distance");
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
          ${meta ? `<span class="more-meta">${esc(meta)}${q.menus && q.menus[0] ? ` · ${esc(q.menus[0][0])} <b>${Number(q.menus[0][1]).toLocaleString()}원</b>` : ""}</span>` : ""}
        </div>
        <button type="button" class="more-add${inTray(q) ? " on" : ""}" aria-label="${esc(q.place_name)} 게임·투표 후보에 담기">${inTray(q) ? "✓ 담음" : "+ 담기"}</button>
        <a class="more-go" href="${esc(routeUrl(q))}" target="_blank" rel="noopener" aria-label="${esc(q.place_name)} 길찾기">길찾기</a>`;
      const add = li.querySelector(".more-add");
      add.onclick = () => { if (addTray(q)) markAdded(add, "✓ 담음"); };
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
  let geoFailed = false; // 한 번 못 찾았으면 검색할 때마다 다시 기다리게 하지 않는다 (다시 시도 버튼으로만)
  let locName = null; // 길찾기 출발지 이름 (내 위치 또는 입력한 동네)

  function showLocbar(state) {
    locbar.hidden = false;
    locBtn.hidden = false;
    if (state === "denied") {
      locText.textContent = "위치 권한이 꺼져 있어요. 주소창 왼쪽 아이콘에서 위치를 허용한 뒤 다시 시도를 누르거나, 아래에 동네 이름을 입력하세요.";
      locBtn.textContent = "다시 시도";
    } else if (state === "unavailable") {
      // 권한은 있는데 기기가 위치를 못 찾는 경우 (PC에서 흔함: Windows/맥 위치 서비스 꺼짐, 유선 인터넷)
      locText.textContent = "이 기기에서 위치를 찾지 못했어요. PC라면 Windows나 맥의 위치 서비스가 꺼져 있을 수 있어요. 아래에 동네 이름을 입력하면 바로 찾을 수 있어요.";
      locBtn.textContent = "다시 시도";
    } else if (state === "change") {
      locText.textContent = "다른 동네 이름을 입력하거나, 내 위치로 다시 찾을 수 있어요.";
      locBtn.textContent = "내 위치로";
    } else {
      locText.textContent = "내 주변 가게를 찾으려면 위치 정보가 필요해요.";
      locBtn.textContent = "위치 허용";
    }
    if (state === "denied" || state === "unavailable") helpLink(locText);
  }

  // 위치 켜는 법 안내 글로 가는 링크
  function helpLink(el) {
    const a = document.createElement("a");
    a.href = "/guide/location.html"; a.target = "_blank"; a.rel = "noopener"; a.className = "help-link";
    a.textContent = "위치 켜는 법 보기";
    el.append(" ", a);
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
        (pos) => { geoFailed = false; setLoc({ x: pos.coords.longitude, y: pos.coords.latitude }); resolve(loc); },
        (err) => { geoFailed = true; showLocbar(err && err.code === 1 ? "denied" : "unavailable"); resolve(null); },
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
    if (usingFallback && geoFailed) return loc;
    const got = await requestLocation();
    if (got) return got;
    usingFallback = true;
    // 기기가 위치를 못 주면(PC에서 흔함) 접속한 인터넷 위치로 대략 잡고, 그것도 없으면 강남역
    const ip = await ipLocation();
    if (ip) {
      loc = { x: ip.x, y: ip.y };
      showNotice(`정확한 위치를 몰라 인터넷 접속 위치(${ip.name || "대략"}) 기준으로 추천하고 있어요. 실제와 다르면 동네 이름을 입력해 주세요.`);
      helpLink(notice);
    } else {
      loc = FALLBACK;
      showNotice("위치를 알 수 없어 강남역 기준으로 추천하고 있어요.");
      helpLink(notice);
    }
    return loc;
  }

  async function ipLocation() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    try {
      const r = await fetch("/api/ipgeo", { signal: ctrl.signal });
      const d = r.ok ? await r.json() : null;
      return d && d.x && d.y ? d : null;
    } catch { return null; } finally { clearTimeout(t); }
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
  // 네이버 리뷰 많은 순 인기 가게. 키가 없거나 실패하면 빈 목록 (카카오 결과만 쓴다)
  const hotCache = new Map();
  async function popularPlaces(query, { x, y }, radius = MODES[travel].radius) {
    const key = `${query}|${x.toFixed(3)}|${y.toFixed(3)}|${radius}`;
    if (!hotCache.has(key)) {
      hotCache.set(key, (async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        try {
          const r = await fetch(`/api/popular?q=${encodeURIComponent(query)}&x=${x.toFixed(4)}&y=${y.toFixed(4)}&radius=${radius}`, { signal: ctrl.signal });
          return r.ok ? (await r.json()).places || [] : [];
        } catch { return []; } finally { clearTimeout(t); }
      })());
    }
    return hotCache.get(key);
  }

  async function searchPlaces(query, { x, y }, page = 1, radius = MODES[travel].radius, sort = "accuracy") {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`/api/places?q=${encodeURIComponent(query)}&x=${x}&y=${y}&page=${page}&radius=${radius}&sort=${sort}`, { signal: ctrl.signal });
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
    if (/착한\s?가격|가성비|싼\s?곳|저렴|만원/.test(text)) return { mode: "cheap", queries: ["착한가격"] };
    if (/뜨끈|따뜻|해장|비\s?오/.test(text)) return { mode: "food", queries: SITUATIONS.국물 };
    if (/가볍|다이어트/.test(text)) return { mode: "food", queries: SITUATIONS.가볍게 };
    if (/혼자/.test(text)) return { mode: "food", queries: SITUATIONS.혼밥 };
    // 모르는 말이면 입력한 그대로 카카오에서 검색하고, 없으면 시간대 메뉴로
    return { mode: "food", queries: [text.slice(0, 20)], fallback: SITUATIONS[timeSlot()] };
  }

  function allFoods() { return [...new Set(Object.values(SITUATIONS).flat())]; }

  function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

  // ---------- 추천 ----------
  async function ask(text, { category, situation, foods, cheap } = {}) {
    text = text.trim();
    if (!text) return;
    app.classList.add("talking");
    bubble(text, "me");
    let plan;
    if (cheap) plan = { mode: "cheap", queries: ["착한가격"] };
    else if (foods) plan = { mode: "food", queries: foods };
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
    track("pick");
    chat.querySelectorAll("[data-again], .typing").forEach((b) => b.remove()); // 마지막 카드에만 남김
    const typing = bubble("고르는 중…", "bot", "typing");
    const stale = () => id !== run; // 그사이 다른 버튼을 눌렀으면 이 요청은 버린다
    const here = await getLocation();
    if (stale()) return typing.remove();

    if (ctx.mode === "cheap") return pickCheap(ctx, here, typing, stale);

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
      renderPick(label, p, query, (ctx.fresh || []).filter((q) => q.id !== p.id).slice(0, 2));
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

  // ---------- 가성비 모드 (행정안전부 착한가격업소) ----------
  const cheapCache = { region: undefined, at: "", places: null };

  async function cheapPlaces(here) {
    const at = `${here.x.toFixed(3)},${here.y.toFixed(3)}`;
    if (cheapCache.at !== at) {
      const r = await fetch(`/api/cheap?x=${here.x}&y=${here.y}`);
      if (!r.ok) throw new Error("region");
      const { region } = await r.json();
      if (region !== cheapCache.region) cheapCache.places = null;
      Object.assign(cheapCache, { region, at });
    }
    if (!cheapCache.region) return [];
    if (!cheapCache.places) {
      const r = await fetch(`/api/cheap?region=${encodeURIComponent(cheapCache.region)}`);
      if (!r.ok) throw new Error("places");
      cheapCache.places = (await r.json()).places || [];
    }
    return cheapCache.places.map((p) => ({
      ...p,
      cheap: true,
      category_name: `음식점 > ${p.cat}`,
      distance: String(Math.round(distM(here, p))),
      place_url: `https://map.kakao.com/?q=${encodeURIComponent(p.place_name + " " + (p.road_address_name || ""))}`,
    }));
  }

  // 두 좌표 사이 거리(m)
  function distM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.y - a.y) * rad, dLon = (b.x - a.x) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.y * rad) * Math.cos(b.y * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  async function pickCheap(ctx, here, typing, stale) {
    ctx.failed = false;
    ctx.empty = false;
    let all;
    try { all = await cheapPlaces(here); } catch { all = null; }
    if (stale()) return typing.remove();
    const radius = MODES[travel].radius;
    const near = (all || []).filter((p) => Number(p.distance) <= radius && !isExcluded(p)).sort((a, b) => a.distance - b.distance);
    const fresh = near.filter((p) => !ctx.shown.has(p.id));
    if (fresh.length) {
      const p = fresh.slice(0, 5)[Math.floor(Math.random() * Math.min(5, fresh.length))];
      ctx.shown.add(p.id);
      ctx.fresh = fresh;
      await spin(typing, shuffle(fresh.slice(0, 8).map((q) => q.place_name)), stale);
      if (stale()) return typing.remove();
      typing.remove();
      renderPick(p.cat, p, "착한가격", fresh.filter((q) => q.id !== p.id).slice(0, 2));
      return;
    }
    typing.remove();
    if (all === null) {
      const el = bubble("지금 착한가격업소 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
      const b = document.createElement("button");
      b.type = "button"; b.className = "retry"; b.textContent = "다시 시도"; b.setAttribute("data-again", "");
      b.onclick = () => pick();
      el.appendChild(b);
      return;
    }
    ctx.empty = true;
    const what = near.length ? "더 보여드릴 착한가격업소가 없어요" : "착한가격업소가 없어요";
    const msg = bubble(`근처 ${km(radius)} 안에는 ${what}. 착한가격업소는 지자체가 지정한 곳만 있어서 동네마다 수가 달라요.`);
    if (travel === "walk") {
      const b = document.createElement("button");
      b.type = "button"; b.className = "retry"; b.setAttribute("data-again", "");
      b.textContent = `차로 ${km(MODES.car.radius)}까지 넓혀서 찾기`;
      b.onclick = () => setTravel("car");
      msg.appendChild(b);
    }
  }

  // 카카오 정확도순(많이 찾는 가게가 앞) 결과 앞쪽에서 아직 안 보여준 곳을 무작위로 하나. 다 보여줬으면 다음 페이지.
  async function nextPlace(ctx, query, here) {
    // 동네에서 리뷰 많은 집(네이버)이 반경 안에 있으면 그중에서 먼저 뽑는다
    const hot = (await popularPlaces(query, here)).filter((p) => !ctx.shown.has(p.id) && !isExcluded(p) && matches(p, query));
    if (hot.length) {
      const p = hot[Math.floor(Math.random() * hot.length)];
      ctx.shown.add(p.id);
      ctx.pool = hot.map((q) => q.place_name);
      ctx.fresh = hot;
      return p;
    }
    let page = ctx.pages.get(query) || 1;
    while (page <= MAX_PAGE) {
      const { places, end, failed } = await searchPlaces(query, here, page);
      if (failed) { ctx.failed = true; return null; }
      const fresh = places.filter((p) => !ctx.shown.has(p.id) && !isExcluded(p) && (p.demo || matches(p, query)));
      if (fresh.length) {
        const near = fresh.slice(0, 5);
        ctx.pool = fresh.slice(0, 8).map((q) => q.place_name);
        ctx.fresh = fresh;
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


  // ---------- 게임으로 정하기 ----------
  // 검색창 위 버튼으로 바로 게임 화면을 연다. 후보는 게임 화면에서 메뉴를 넣거나, 카드·더보기에서 가게를 담는다. 이 기기에만 저장한다.
  const trayBtn = $("#tray");
  const POLL_MAX = 8, TRAY_ON = "✓ 후보에 담았어요 (게임·투표)", TRAY_OFF = "➕ 게임·투표 후보에 담기";
  const inTray = (p) => tray.some((q) => (p.id && q.id === p.id) || q.place_name === p.place_name);
  function saveTray() { try { localStorage.setItem(TRAY_KEY, JSON.stringify(tray)); } catch {} }
  function slim(p) {
    return { id: p.id, place_name: p.place_name, category_name: p.category_name || (p.cat ? `음식점 > ${p.cat}` : ""), x: p.x, y: p.y,
      distance: p.distance, place_url: p.place_url, road_address_name: p.road_address_name || p.address_name || "", phone: p.phone, menu: p.menu, typed: p.typed };
  }
  function addTray(p) {
    if (inTray(p)) return true;
    if (tray.length >= TRAY_MAX) { bubble(`게임 후보는 ${TRAY_MAX}개까지예요. "🎮 게임으로 정하기"를 눌러 몇 개를 빼주세요.`); return false; }
    tray.push(slim(p));
    saveTray(); renderTray(true);
    return true;
  }
  function markAdded(btn, text) { btn.textContent = text; btn.classList.add("on"); }
  // 친구랑 투표: 사용자가 직접 담은 후보(가게·메뉴)로만 만든다. 2개 이상 담으면 카드에 버튼이 나타난다.
  function paintPollBtns() {
    document.querySelectorAll("[data-tray-poll]").forEach((b) => {
      if (b.dataset.made) return;
      b.hidden = false;
      b.disabled = tray.length < 2;
      b.textContent = tray.length < 2 ? "👥 후보를 2개 담으면 친구랑 투표할 수 있어요" : `👥 담은 후보 ${Math.min(tray.length, POLL_MAX)}개로 친구랑 투표하기`;
      b.onclick = () => { b.dataset.made = "1"; startPoll(b, "", tray.slice(0, POLL_MAX)); };
    });
  }
  function pollFrom(list) {
    app.classList.add("talking");
    const el = bubble(`담은 후보 ${Math.min(list.length, POLL_MAX)}개로 투표를 만들어요.`);
    const b = document.createElement("button");
    b.type = "button"; b.className = "retry";
    el.appendChild(b);
    startPoll(b, "", list.slice(0, POLL_MAX));
  }
  function renderTray(bump) {
    if (!trayBtn) return;
    trayBtn.innerHTML = `<span aria-hidden="true">🎮</span> 게임으로 정하기${tray.length ? `<span class="tray-n">${tray.length}</span>` : ""}`;
    trayBtn.setAttribute("aria-label", tray.length ? `게임으로 정하기 (후보 ${tray.length}개 담김)` : "게임으로 정하기");
    if (bump) { trayBtn.classList.remove("bump"); void trayBtn.offsetWidth; trayBtn.classList.add("bump"); }
    paintPollBtns();
  }
  trayBtn && trayBtn.addEventListener("click", startGame);

  let lastGame = "race";
  try { if (["race", "wheel", "ladder", "bomb"].includes(localStorage.getItem(GAME_KEY))) lastGame = localStorage.getItem(GAME_KEY); } catch {}
  const MENU_IDEAS = ["라면", "김밥", "짜장면", "짬뽕", "돈까스", "국밥", "치킨", "피자", "햄버거", "초밥", "떡볶이", "마라탕", "냉면", "제육볶음"];

  // 게임 파일은 처음 열 때만 불러온다
  let gameLoad = null;
  function loadGame() {
    if (window.OdGame) return Promise.resolve();
    if (gameLoad) return gameLoad;
    // 글꼴은 기다리지 않고(없으면 기본 글꼴), 게임 화면 모양(css)과 코드(js)는 다 받은 뒤 연다
    const font = document.createElement("link");
    font.rel = "stylesheet"; font.href = "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Jua&display=swap";
    document.head.appendChild(font);
    const get = (el) => new Promise((ok, fail) => { el.onload = ok; el.onerror = fail; document.head.appendChild(el); });
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/game.css" });
    const js = Object.assign(document.createElement("script"), { src: "/game.js" });
    return (gameLoad = Promise.all([get(css), get(js)]).catch((e) => { gameLoad = null; throw e; }));
  }
  async function startGame() {
    track("game");
    trayBtn.disabled = true;
    try { await loadGame(); } catch { trayBtn.disabled = false; bubble("게임을 불러오지 못했어요. 잠시 후 다시 눌러주세요."); return; }
    trayBtn.disabled = false;
    window.OdGame.open({
      items: tray.slice(), ideas: MENU_IDEAS, emojiOf, game: lastGame,
      onChange: (list) => { tray = list.map(slim); saveTray(); renderTray(); },
      onGame: (g) => { lastGame = g; try { localStorage.setItem(GAME_KEY, g); } catch {} },
      onPick: (p, gameName, list) => renderGameResult(p, gameName, list),
      onPoll: (list) => pollFrom(list),
    });
  }

  function renderGameResult(p, gameName, list) {
    app.classList.add("talking");
    bubble(`🎮 ${gameName} 게임 결과`, "me");
    if (p.menu) return renderMenuResult(p, gameName, list);
    const el = document.createElement("article");
    el.className = "pick pick-trophy";
    const meta = metaLine(p), shops = list.slice(0, POLL_MAX);
    el.innerHTML = `
      <p class="food">🏆 ${esc(gameName)} 게임으로 뽑았어요 · ${list.length}개 중 1등</p>
      <h2>${emojiOf(p)} ${esc(p.place_name)}</h2>
      ${meta ? `<p class="meta">${esc(meta)}</p>` : ""}
      <p class="meta">${esc(p.road_address_name || (p.x ? "" : "직접 넣은 가게예요. 길찾기는 카카오맵 검색으로 열려요."))}</p>
      <div class="actions">
        <a class="primary" href="${esc(routeUrl(p))}" target="_blank" rel="noopener">길찾기</a>
        <a href="${esc(p.place_url || destUrl(p))}" target="_blank" rel="noopener">메뉴 보기</a>
        <button type="button" data-share>공유하기</button>
        <button type="button" data-replay>🔁 한 판 더</button>
        ${shops.length >= 2 ? `<button type="button" class="wide" data-poll>👥 이 후보 ${shops.length}개로 친구랑 투표하기</button>` : ""}
      </div>`;
    const shareBtn = el.querySelector("[data-share]");
    shareBtn.onclick = () => sharePick(shareBtn, `${gameName} 게임 1등`, p);
    el.querySelector("[data-replay]").onclick = startGame;
    const pollBtn = el.querySelector("[data-poll]");
    if (pollBtn) pollBtn.onclick = () => startPoll(pollBtn, "", shops);
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  // 메뉴가 뽑히면 근처에서 그 메뉴 가게를 찾을지 묻는다
  function renderMenuResult(p, gameName, list) {
    const name = p.place_name;
    const el = document.createElement("article");
    el.className = "pick pick-trophy";
    el.innerHTML = `
      <p class="food">🏆 ${esc(gameName)} 게임으로 뽑았어요 · ${list.length}개 중 1등</p>
      <h2>${emojiOf(p)} 오늘은 ${esc(name)}!</h2>
      <p class="meta">근처 ${esc(name)} 가게를 찾아드릴까요?</p>
      <div class="actions">
        <button type="button" class="primary wide" data-find>📍 근처 ${esc(name)} 가게 찾기</button>
        <button type="button" data-share>공유하기</button>
        <button type="button" data-replay>🔁 한 판 더</button>
      </div>`;
    el.querySelector("[data-find]").onclick = (e) => { e.currentTarget.disabled = true; ask(name); };
    const shareBtn = el.querySelector("[data-share]");
    shareBtn.onclick = () => shareText(shareBtn, `오늘 메뉴는 ${name}! 🎮 ${gameName} 게임으로 정했어요\n\n오땡뭐!에서 골랐어요 👉 https://odaengmwo.com/?from=share`);
    el.querySelector("[data-replay]").onclick = startGame;
    chat.appendChild(el);
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  }
  async function shareText(btn, text) {
    track("share");
    try {
      if (navigator.share) { await navigator.share({ title: "오땡뭐!", text }); return; }
      await navigator.clipboard.writeText(text);
      btn.textContent = "복사했어요";
    } catch (e) {
      if (e && e.name === "AbortError") return;
      btn.textContent = "공유하지 못했어요";
    }
    setTimeout(() => { btn.textContent = "공유하기"; }, 2000);
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

  // 배너 아래 "일하는 중" 문구를 장난스럽게 바꿔가며 보여준다
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
  renderTray();
  startBeta();
  renderChips();
  initLocation();
  startRotator();
  // 공유 글·투표 화면·안내 글에서 들어온 횟수 (?from=share|vote|guide|sns, guide-글이름·sns-채널도 앞 단어로 센다)
  try {
    const from = (new URLSearchParams(location.search).get("from") || "").split("-")[0]; // guide-dinner → guide
    if (["share", "vote", "guide", "sns"].includes(from)) track(`from_${from}`);
  } catch {}
  // 안내 글 등에서 ?pick=야식 처럼 들어오면 그 버튼을 바로 눌러준다
  try {
    const want = (new URLSearchParams(location.search).get("pick") || "").trim().slice(0, 20);
    if (want) {
      const chip = [...document.querySelectorAll(".chip")].find((b) => b.textContent === want || b.textContent.replace(/^\S+\s/, "") === want);
      setTimeout(() => (chip ? chip.click() : ask(want)), 300);
    }
  } catch {}
})();

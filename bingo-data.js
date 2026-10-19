// 제철 빙고 데이터와 저장: bingo.html과 첫 화면(app.js)이 같이 쓴다. 기록은 이 브라우저에만 남는다.
window.OdBingo = (() => {
  // 시즌마다 9칸: 동네 가게에서 찾을 수 있는 제철 메뉴 (guide/seasonal-food.html과 맞춤)
  const SEASONS = {
    spring: { name: "봄", months: [3, 4, 5], foods: [["🐙", "주꾸미볶음"], ["🐟", "도다리쑥국"], ["🍜", "바지락칼국수"], ["🍚", "멍게비빔밥"], ["🥬", "봄동비빔밥"], ["🥓", "미나리삼겹살"], ["🍲", "냉이된장찌개"], ["🐟", "병어조림"], ["🍣", "회덮밥"]] },
    summer: { name: "여름", months: [6, 7, 8], foods: [["🐔", "삼계탕"], ["🐍", "장어구이"], ["🥣", "콩국수"], ["🐟", "물회"], ["🍜", "냉면"], ["🐟", "민어회"], ["🍲", "전복죽"], ["🍜", "밀면"], ["🍜", "막국수"]] },
    autumn: { name: "가을", months: [9, 10, 11], foods: [["🦐", "대하구이"], ["🐟", "전어구이"], ["🦀", "꽃게탕"], ["🦀", "간장게장"], ["🍲", "추어탕"], ["🐟", "고등어구이"], ["🍄", "버섯전골"], ["🦪", "굴국밥"], ["🐟", "방어회"]] },
    winter: { name: "겨울", months: [12, 1, 2], foods: [["🐟", "방어회"], ["🦪", "굴국밥"], ["🐟", "과메기"], ["🦀", "대게"], ["🍚", "꼬막비빔밥"], ["🍲", "매생이국"], ["🍲", "대구탕"], ["🥬", "굴보쌈"], ["🥣", "팥죽"]] },
  };
  function current(now = new Date()) {
    const m = now.getMonth() + 1;
    const key = Object.keys(SEASONS).find((k) => SEASONS[k].months.includes(m));
    const year = m <= 2 ? now.getFullYear() - 1 : now.getFullYear(); // 겨울은 12월의 해로 묶는다
    return { key, season: SEASONS[key], store: `wmm.bingo.${year}-${key}` };
  }
  const load = (store) => { try { return new Set(JSON.parse(localStorage.getItem(store) || "[]")); } catch { return new Set(); } };
  const save = (store, set) => { try { localStorage.setItem(store, JSON.stringify([...set])); } catch {} };
  return { SEASONS, current, load, save };
})();

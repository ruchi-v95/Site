// 위치 공통 저장: 오늘 뭐 먹지·오늘 뭐하지가 한 번 잡은 위치를 같이 쓴다.
// 탭을 옮기거나 다시 들어와도 30분 안에는 위치를 다시 묻지 않는다. (이 기기에만 저장)
//   { x, y, label }  label이 있으면 직접 입력한 동네·역, 없으면 기기 위치
window.OdLoc = (() => {
  const KEY = "odm.loc", TTL = 30 * 60 * 1000;
  return {
    get() {
      try {
        const v = JSON.parse(localStorage.getItem(KEY) || "null");
        if (!v || !(v.x > 124 && v.x < 132) || !(v.y > 33 && v.y < 39) || Date.now() - v.t > TTL) return null;
        return { x: v.x, y: v.y, label: v.label || null };
      } catch { return null; }
    },
    save(at, label) {
      try { localStorage.setItem(KEY, JSON.stringify({ x: at.x, y: at.y, label: label || null, t: Date.now() })); } catch {}
    },
  };
})();

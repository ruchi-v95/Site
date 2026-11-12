// 동네·역 이름을 좌표로 바꾼다 (위치 권한이 없거나 PC에서 위치를 못 찾을 때)
//   /api/where?q=홍대입구역 → { name, x, y }
// 반대로 좌표를 동 이름으로 바꾼다 (화면에 "역삼1동에서 찾고 있어요" 표시용)
//   /api/where?x=127.03&y=37.50 → { name: "역삼1동", gu: "강남구" }
const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const REGION_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return res.status(503).json({ error: "KAKAO_REST_API_KEY not set" });
  const x = Number(req.query.x), y = Number(req.query.y);
  if (!req.query.q && x > 124 && x < 132 && y > 33 && y < 39) {
    try {
      const r = await fetch(`${REGION_URL}?${new URLSearchParams({ x: x.toFixed(3), y: y.toFixed(3) })}`, { headers: { Authorization: `KakaoAK ${key}` } });
      if (!r.ok) return res.status(502).json({ error: `kakao ${r.status}` });
      const docs = (await r.json()).documents || [];
      const d = docs.find((d) => d.region_type === "H") || docs[0];
      if (!d) return res.status(404).json({ error: "not found" });
      res.setHeader("Cache-Control", "s-maxage=604800");
      return res.status(200).json({ name: d.region_3depth_name || d.region_2depth_name, gu: d.region_2depth_name });
    } catch {
      return res.status(502).json({ error: "kakao fetch failed" });
    }
  }
  const q = String(req.query.q || "").trim().slice(0, 30);
  if (!q) return res.status(400).json({ error: "bad query" });
  try {
    const r = await fetch(`${KAKAO_URL}?${new URLSearchParams({ query: q, size: "1" })}`, {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!r.ok) return res.status(502).json({ error: `kakao ${r.status}` });
    const d = (await r.json()).documents?.[0];
    if (!d) return res.status(404).json({ error: "not found" });
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json({ name: d.place_name, x: d.x, y: d.y });
  } catch {
    return res.status(502).json({ error: "kakao fetch failed" });
  }
}

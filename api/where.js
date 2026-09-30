// 동네·역 이름을 좌표로 바꾼다 (위치 권한이 없거나 PC에서 위치를 못 찾을 때)
const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return res.status(503).json({ error: "KAKAO_REST_API_KEY not set" });
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

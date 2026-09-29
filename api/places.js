// 카카오 로컬 API로 주변 음식점을 거리순으로 찾는다. 키는 서버에만 둔다.
const KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

export default async function handler(req, res) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return res.status(503).json({ error: "KAKAO_REST_API_KEY not set" });

  const q = String(req.query.q || "").trim().slice(0, 30);
  const x = Number(req.query.x);
  const y = Number(req.query.y);
  const page = Math.min(3, Math.max(1, parseInt(req.query.page, 10) || 1));
  // 대한민국 대략 범위 밖 좌표는 거절
  if (!q || !(x > 124 && x < 132) || !(y > 33 && y < 39)) {
    return res.status(400).json({ error: "bad query" });
  }

  const params = new URLSearchParams({
    query: q,
    category_group_code: "FD6", // 음식점
    x: String(x),
    y: String(y),
    radius: "1000",
    sort: "distance",
    size: "15",
    page: String(page),
  });

  try {
    const r = await fetch(`${KAKAO_URL}?${params}`, {
      headers: { Authorization: `KakaoAK ${key}` },
    });
    if (!r.ok) return res.status(502).json({ error: `kakao ${r.status}` });
    const data = await r.json();
    const places = (data.documents || []).map((d) => ({
      id: d.id,
      place_name: d.place_name,
      category_name: d.category_name,
      distance: d.distance,
      road_address_name: d.road_address_name,
      address_name: d.address_name,
      phone: d.phone,
      x: d.x,
      y: d.y,
      place_url: d.place_url,
    }));
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    return res.status(200).json({ places, is_end: !!data.meta?.is_end });
  } catch (e) {
    return res.status(502).json({ error: "kakao fetch failed" });
  }
}

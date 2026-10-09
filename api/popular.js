// 동네 인기 가게: 네이버 지역검색을 블로그 리뷰 많은 순(sort=comment)으로 받아, 같은 가게를 카카오에서 찾아 붙인다.
// 네이버 키(NAVER_CLIENT_ID/SECRET)가 없으면 503을 돌려주고, 화면은 카카오 결과만 쓴다.
//   /api/popular?q=국밥&x=&y=&radius=1000 → { places: [...] } (반경 안에 있는 곳만, 카카오 장소 모양)
const KAKAO = "https://dapi.kakao.com/v2/local";
const NAVER = "https://openapi.naver.com/v1/search/local.json";

const clean = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").trim();
const norm = (s) => clean(s).replace(/[\s()\-·.,]/g, "").toLowerCase();

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!kakaoKey || !id || !secret) return res.status(503).json({ error: "keys not set" });

  const q = String(req.query.q || "").trim().slice(0, 30);
  const x = Number(req.query.x), y = Number(req.query.y);
  const radius = Math.min(5000, Math.max(500, parseInt(req.query.radius, 10) || 1000));
  if (!q || !(x > 124 && x < 132) || !(y > 33 && y < 39)) return res.status(400).json({ error: "bad query" });

  const kakao = (p, params) => fetch(`${KAKAO}/${p}?${new URLSearchParams(params)}`, { headers: { Authorization: `KakaoAK ${kakaoKey}` } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);

  try {
    // 네이버는 좌표 검색이 없어서 "동 이름 + 검색어"로 찾는다 (예: 봉천동 국밥)
    const region = (await kakao("geo/coord2regioncode.json", { x: String(x), y: String(y) }))?.documents?.find((d) => d.region_type === "H");
    if (!region) return res.status(502).json({ error: "region failed" });
    const area = region.region_3depth_name || region.region_2depth_name;
    const nr = await fetch(`${NAVER}?${new URLSearchParams({ query: `${area} ${q}`, display: "5", sort: "comment" })}`, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    });
    if (!nr.ok) return res.status(502).json({ error: `naver ${nr.status}` });
    const items = (await nr.json()).items || [];

    // 같은 가게를 카카오에서 찾는다: 이름이 맞고 내 위치 반경 안에 있는 곳만 (길찾기·메뉴 보기·후보 담기를 그대로 쓰려고)
    const found = await Promise.all(items.map(async (it, rank) => {
      const name = clean(it.title);
      const docs = (await kakao("search/keyword.json", {
        query: name, category_group_code: "FD6", x: String(x), y: String(y), radius: String(radius), sort: "accuracy", size: "5",
      }))?.documents || [];
      const n = norm(name), road = norm(it.roadAddress);
      const d = docs.find((d) => norm(d.place_name) === n)
        || docs.find((d) => (norm(d.place_name).includes(n) || n.includes(norm(d.place_name))) && (!road || norm(d.road_address_name) === road || norm(d.road_address_name).includes(road.slice(0, 8))));
      if (!d) return null;
      return {
        id: d.id, place_name: d.place_name, category_name: d.category_name, distance: d.distance,
        road_address_name: d.road_address_name, address_name: d.address_name, phone: d.phone,
        x: d.x, y: d.y, place_url: d.place_url, hot: true, hot_rank: rank + 1,
      };
    }));
    const seen = new Set();
    const places = found.filter((p) => p && !seen.has(p.id) && seen.add(p.id));
    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");
    return res.status(200).json({ places, area });
  } catch {
    return res.status(502).json({ error: "popular failed" });
  }
}

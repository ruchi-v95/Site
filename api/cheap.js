// 가성비 모드: 행정안전부 착한가격업소(data/cheap.json, 분기마다 갱신)를 내 동네(시군) 단위로 돌려준다.
// 원본에 좌표가 없어서 카카오 주소 검색으로 좌표를 붙인다. 동네별 결과는 CDN에 오래 캐시한다.
//   /api/cheap?x=&y=       → { region }  (좌표 → "시도|시군")
//   /api/cheap?region=...  → { places: [...] }
import fs from "fs";
import path from "path";

const KAKAO = "https://dapi.kakao.com/v2/local";
let DATA = null;
const load = () => DATA || (DATA = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "cheap.json"), "utf8")));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return res.status(503).json({ error: "KAKAO_REST_API_KEY not set" });
  const kakao = (p, q) => fetch(`${KAKAO}/${p}?${new URLSearchParams(q)}`, { headers: { Authorization: `KakaoAK ${key}` } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);

  try {
    if (req.query.region) {
      const region = String(req.query.region).slice(0, 40);
      const rows = load()[region];
      if (!rows) return res.status(404).json({ error: "no region" });
      const places = [];
      // 카카오 호출이 몰리지 않게 8개씩
      for (let i = 0; i < rows.length; i += 8) {
        const got = await Promise.all(rows.slice(i, i + 8).map(async ([name, phone, addr, cat, menus], j) => {
          // "OO로 12 210호"처럼 뒤에 붙은 호수 때문에 못 찾으면 도로명+번지까지만 다시 찾는다
          const short = (addr.match(/^.*?\d+(-\d+)?(?=\s|,|$)/) || [addr])[0];
          const d = (await kakao("search/address.json", { query: addr, size: "1" }))?.documents?.[0]
            || (short !== addr ? (await kakao("search/address.json", { query: short, size: "1" }))?.documents?.[0] : null);
          if (!d) return null;
          return { id: `cheap-${region}-${i + j}`, place_name: name, phone, road_address_name: addr, cat, menus, x: d.x, y: d.y };
        }));
        places.push(...got.filter(Boolean));
      }
      res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=2592000");
      return res.status(200).json({ places });
    }

    const x = Number(req.query.x), y = Number(req.query.y);
    if (!(x > 124 && x < 132) || !(y > 33 && y < 39)) return res.status(400).json({ error: "bad query" });
    const d = (await kakao("geo/coord2regioncode.json", { x: String(x), y: String(y) }))?.documents?.find((r) => r.region_type === "H") ;
    if (!d) return res.status(502).json({ error: "region failed" });
    const data = load();
    const sido = d.region_1depth_name, sigungu = (d.region_2depth_name || "").split(" ")[0];
    // 카카오와 원본의 시도 이름이 다를 수 있어 앞 두 글자로도 맞춰본다 (예: 강원도 ↔ 강원특별자치도)
    const region = Object.keys(data).find((k) => k === `${sido}|${sigungu}`)
      || Object.keys(data).find((k) => k.split("|")[0].slice(0, 2) === sido.slice(0, 2) && k.split("|")[1] === sigungu)
      || null;
    res.setHeader("Cache-Control", "s-maxage=86400");
    return res.status(200).json({ region });
  } catch {
    return res.status(502).json({ error: "cheap failed" });
  }
}

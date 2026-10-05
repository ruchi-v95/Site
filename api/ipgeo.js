// PC처럼 기기가 위치를 못 찾을 때 쓰는 대략 위치: Vercel이 붙여 주는 접속 IP 기준 좌표(무료).
// 동네 단위로는 틀릴 수 있어서 화면에서 "대략"이라고 알리고 동네 입력을 권한다.
const REGION_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const h = (k) => req.headers[k] || "";
  const y = Number(h("x-vercel-ip-latitude")), x = Number(h("x-vercel-ip-longitude"));
  if (!x || !y || h("x-vercel-ip-country") !== "KR") return res.status(404).json({ error: "no ip location" });
  let name = "";
  const key = process.env.KAKAO_REST_API_KEY;
  if (key) {
    try {
      const r = await fetch(`${REGION_URL}?${new URLSearchParams({ x: String(x), y: String(y) })}`, { headers: { Authorization: `KakaoAK ${key}` } });
      const d = r.ok ? (await r.json()).documents || [] : [];
      const g = d.find((v) => v.region_type === "H") || d[0];
      if (g) name = [g.region_1depth_name, g.region_2depth_name].filter(Boolean).join(" ");
    } catch {}
  }
  if (!name) { try { name = decodeURIComponent(h("x-vercel-ip-city")); } catch {} }
  return res.status(200).json({ x, y, name });
}

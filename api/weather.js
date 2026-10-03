// 지금 위치의 날씨(기상청 초단기실황). 키는 Vercel 환경변수 KMA_SERVICE_KEY에만 둔다.
const KMA_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) return res.status(503).json({ error: "KMA_SERVICE_KEY not set" });
  const x = Number(req.query.x), y = Number(req.query.y);
  if (!(x > 124 && x < 132) || !(y > 33 && y < 39)) return res.status(400).json({ error: "bad query" });

  const { nx, ny } = toGrid(y, x);
  const { date, time } = baseTime(new Date());
  const params = new URLSearchParams({
    serviceKey: key, pageNo: "1", numOfRows: "20", dataType: "JSON",
    base_date: date, base_time: time, nx: String(nx), ny: String(ny),
  });
  try {
    const r = await fetch(`${KMA_URL}?${params}`);
    if (!r.ok) return res.status(502).json({ error: `kma ${r.status}` });
    const items = (await r.json())?.response?.body?.items?.item || [];
    const get = (c) => items.find((i) => i.category === c)?.obsrValue;
    const temp = Number(get("T1H"));
    const pty = Number(get("PTY") || 0); // 0 없음, 1 비, 2 비/눈, 3 눈, 5 빗방울, 6 빗방울눈날림, 7 눈날림
    if (!Number.isFinite(temp)) return res.status(502).json({ error: "no data" });
    res.setHeader("Cache-Control", "s-maxage=1200, stale-while-revalidate=1800");
    return res.status(200).json({ temp, pty });
  } catch {
    return res.status(502).json({ error: "kma fetch failed" });
  }
}

// 초단기실황은 매시 정각 자료가 40분쯤 뒤에 나온다. 한국 시간 기준으로 계산.
function baseTime(now) {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000 - 45 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}`,
    time: `${p(kst.getUTCHours())}00`,
  };
}

// 위경도 → 기상청 격자(Lambert Conformal Conic). 기상청 공개 변환식.
function toGrid(lat, lon) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180.0;
  const re = RE / GRID, slat1 = SLAT1 * D, slat2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * D - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

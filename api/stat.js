// 날짜별 사용 횟수 세기 (투표와 같은 Upstash Redis). 누가 했는지는 저장하지 않고 "오늘 공유 12번" 같은 합계만 남긴다.
//   POST /api/stat?e=share            → 오늘(한국 시간) share 횟수 +1
//   GET  /api/stat?days=14 + Authorization: Bearer STATS_TOKEN → { days: [{ date, pick: 3, share: 1, ... }] }
// 무료 Vercel 분석은 버튼 클릭과 공유 링크 유입을 구분하지 못해서, 성장 지표는 여기서 본다.
const EVENTS = new Set([
  "pick",        // 추천 하나 뽑기
  "share",       // 추천·게임 결과 공유하기
  "poll",        // 투표 만들기
  "vote_view",   // 투표 링크 열기 (친구가 들어온 횟수)
  "vote",        // 투표하기
  "game",        // 게임 열기
  "from_share",  // 공유 글의 링크로 들어옴
  "from_vote",   // 투표 화면에서 들어옴
  "from_guide",  // 메뉴 추천 글에서 들어옴
  "from_sns",    // SNS 게시물 링크로 들어옴 (?from=sns-instagram 등)
]);
const KEEP = 400 * 24 * 3600; // 1년 넘게 보관해서 작년 같은 달과 비교한다

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = env("KV_REST_API_URL", "REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN", "REDIS_REST_TOKEN");
  if (!url || !token) return res.status(503).json({ error: "storage not set" });
  const redis = (cmds) => fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  }).then((r) => { if (!r.ok) throw new Error(`redis ${r.status}`); return r.json(); });

  try {
    if (req.method === "POST") {
      const e = String(req.query.e || "");
      if (!EVENTS.has(e)) return res.status(400).json({ error: "bad event" });
      const key = `stat:${day(0)}`;
      await redis([["HINCRBY", key, e, "1"], ["EXPIRE", key, String(KEEP)]]);
      return res.status(204).end();
    }

    if (req.method === "GET") {
      // 합계 보기는 비밀 토큰이 있을 때만 (Vercel 환경변수 STATS_TOKEN)
      const want = process.env.STATS_TOKEN;
      if (!want || req.headers.authorization !== `Bearer ${want}`) return res.status(404).json({ error: "not found" });
      const n = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
      const dates = Array.from({ length: n }, (_, i) => day(i));
      const out = await redis(dates.map((d) => ["HGETALL", `stat:${d}`]));
      const days = dates.map((date, i) => {
        const flat = out[i].result || [];
        const row = { date };
        for (let j = 0; j < flat.length; j += 2) row[flat[j]] = Number(flat[j + 1]);
        return row;
      });
      return res.status(200).json({ days });
    }

    return res.status(405).json({ error: "method" });
  } catch {
    return res.status(502).json({ error: "storage failed" });
  }
}

// 한국 시간 기준 오늘에서 back일 전 날짜 (YYYY-MM-DD)
function day(back) {
  return new Date(Date.now() + 9 * 3600e3 - back * 864e5).toISOString().slice(0, 10);
}

function env(...names) {
  for (const n of names) if (process.env[n]) return process.env[n];
  return "";
}

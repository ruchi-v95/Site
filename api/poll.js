// 같이 고르기(투표). 저장소는 Vercel에 연결한 Upstash Redis(무료)의 REST API를 쓴다. 투표는 24시간 뒤 사라진다.
const TTL = 24 * 3600;

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
    // 만들기: 후보 2~4곳
    if (req.method === "POST" && !req.query.id) {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const places = (Array.isArray(body.places) ? body.places : []).slice(0, 4).map(clean).filter((p) => p.name);
      if (places.length < 2) return res.status(400).json({ error: "need 2+ places" });
      const id = Math.random().toString(36).slice(2, 10);
      await redis([
        ["SET", `poll:${id}`, JSON.stringify({ title: String(body.title || "").slice(0, 30), places }), "EX", TTL],
      ]);
      return res.status(200).json({ id });
    }

    const id = String(req.query.id || "").replace(/[^a-z0-9]/g, "").slice(0, 12);
    if (!id) return res.status(400).json({ error: "bad id" });

    // 투표하기
    if (req.method === "POST") {
      const i = parseInt(req.query.vote, 10);
      const [g] = await redis([["GET", `poll:${id}`]]);
      const raw = g.result;
      if (!raw) return res.status(404).json({ error: "not found" });
      const poll = JSON.parse(raw);
      if (!(i >= 0 && i < poll.places.length)) return res.status(400).json({ error: "bad vote" });
      await redis([["HINCRBY", `votes:${id}`, String(i), "1"], ["EXPIRE", `votes:${id}`, String(TTL)]]);
    }

    // 결과 보기
    const [p, v] = await redis([["GET", `poll:${id}`], ["HGETALL", `votes:${id}`]]);
    if (!p.result) return res.status(404).json({ error: "not found" });
    const poll = JSON.parse(p.result);
    const flat = v.result || [];
    const votes = poll.places.map(() => 0);
    for (let k = 0; k < flat.length; k += 2) votes[Number(flat[k])] = Number(flat[k + 1]) || 0;
    return res.status(200).json({ ...poll, votes });
  } catch {
    return res.status(502).json({ error: "storage failed" });
  }
}

function clean(p) {
  const s = (v, n) => String(v ?? "").slice(0, n);
  return { name: s(p.name, 40), cat: s(p.cat, 20), addr: s(p.addr, 60), x: s(p.x, 20), y: s(p.y, 20), url: /^https:\/\/place\.map\.kakao\.com\//.test(p.url || "") ? s(p.url, 80) : "" };
}

// Vercel 연동 시 붙는 접두사(STORAGE_ 등)와 상관없이 찾기
function env(...suffixes) {
  for (const sfx of suffixes) {
    if (process.env[sfx]) return process.env[sfx];
    const key = Object.keys(process.env).find((k) => k.endsWith(sfx) && !k.includes("READ_ONLY"));
    if (key) return process.env[key];
  }
}

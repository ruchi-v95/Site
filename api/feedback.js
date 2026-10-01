// 사이트의 의견 보내기 → GitHub 이슈로 등록. 토큰은 Vercel 환경변수 GITHUB_TOKEN에만 둔다.
const REPO = "ruchi-v95/Site";
const TYPES = { bug: "버그", place: "가게정보", idea: "제안", etc: "기타" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(503).json({ error: "GITHUB_TOKEN not set" });

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const type = TYPES[body.type] ? body.type : "etc";
  const text = String(body.text || "").trim().slice(0, 1000);
  // 스팸 방지: 숨은 칸이 채워졌거나 너무 빨리 보낸 경우는 조용히 무시
  if (body.website || Number(body.elapsed) < 2000) return res.status(200).json({ ok: true });
  if (text.length < 5) return res.status(400).json({ error: "too short" });

  const firstLine = text.split("\n")[0].slice(0, 40);
  const ua = String(req.headers["user-agent"] || "").slice(0, 200);
  const issue = {
    title: `[${TYPES[type]}] ${firstLine}`,
    body: `${text}\n\n---\n사이트 의견 보내기로 접수됨\n- 브라우저: ${ua}\n- 시각: ${new Date().toISOString()}`,
    labels: ["사이트 의견", TYPES[type]],
  };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "odaengmwo-feedback",
      },
      body: JSON.stringify(issue),
    });
    if (!r.ok) return res.status(502).json({ error: `github ${r.status}` });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: "github fetch failed" });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

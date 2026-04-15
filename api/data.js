const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  return await res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    if (req.method === 'GET' && action === 'load') {
      const [pendingRaw, historyRaw, teamRaw] = await Promise.all([
        redisGet('pending'),
        redisGet('history'),
        redisGet('team')
      ]);
      const parse = (v) => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        try { return JSON.parse(v); } catch { return []; }
      };
      return res.status(200).json({
        pending: parse(pendingRaw),
        history: parse(historyRaw),
        team: parse(teamRaw)
      });
    }

    if (req.method === 'POST' && action === 'save') {
      const { pending, history, team } = req.body;
      const ops = [];
      if (pending !== undefined) ops.push(redisSet('pending', pending));
      if (history !== undefined) ops.push(redisSet('history', history));
      if (team !== undefined) ops.push(redisSet('team', team));
      await Promise.all(ops);
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${REDIS_URL}/${command}/${args.map(a => encodeURIComponent(JSON.stringify(a))).join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    if (req.method === 'GET' && action === 'load') {
      const pending = await redis('get', 'pending') || '[]';
      const history = await redis('get', 'history') || '[]';
      const team = await redis('get', 'team') || '[]';
      return res.status(200).json({
        pending: JSON.parse(pending),
        history: JSON.parse(history),
        team: JSON.parse(team)
      });
    }

    if (req.method === 'POST' && action === 'save') {
      const { pending, history, team } = req.body;
      if (pending !== undefined) await redis('set', 'pending', JSON.stringify(pending));
      if (history !== undefined) await redis('set', 'history', JSON.stringify(history));
      if (team !== undefined) await redis('set', 'team', JSON.stringify(team));
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

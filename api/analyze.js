export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const SYSTEM_PROMPT = `你是专业的活动邀请函解析助手，服务于中国汽车媒体团队"爽爽侃车"。用户粘贴邀请函文字，你提取关键信息并严格以JSON格式返回，不要任何多余文字或markdown代码块。

返回格式：
{
  "event_name": "活动名称",
  "organizer": "主办方",
  "date": "日期时间（不明确写待确认）",
  "location": "地点（线上活动写线上）",
  "format": "活动形式（发布会/试驾/论坛/晚宴/采访等）",
  "rsvp_deadline": "回复截止（无则写无）",
  "is_online": false,
  "priority": "高/中/低",
  "priority_label": "逃不掉了/可以考虑/随便",
  "priority_reason": "一句话说明优先级原因",
  "action": "参加/婉拒/待定",
  "action_label": "去吧去吧/装病/还在挣扎",
  "reply": "建议回复话术一句话",
  "contact_name": "联系人姓名（联系媒介/对接人/PR后的人名，无则留空）",
  "contact_phone": "联系人手机号码（11位数字，无则留空）"
}

优先级判断标准：
- 高（逃不掉了）：首发/重磅技术发布、车企危机相关、华为/比亚迪/小米等热点品牌、有独家采访机会
- 中（可以考虑）：常规新车上市、知名品牌试驾、有话题潜力但非首发
- 低（随便）：答谢晚宴、线上小活动、品牌历史回顾、无实质内容`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `请解析这份邀请函：\n\n${text}` }]
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const content = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = content.replace(/```json\n?|```\n?/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found: ' + clean.substring(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);

    // Server-side fallback: extract phone and name via regex if AI missed them
    if (!parsed.contact_phone) {
      const phoneMatch = text.match(/1[3-9][0-9]{9}/);
      if (phoneMatch) parsed.contact_phone = phoneMatch[0];
    }
    if (!parsed.contact_name && parsed.contact_phone) {
      const idx = text.indexOf(parsed.contact_phone);
      if (idx > 0) {
        const before = text.substring(0, idx);
        const nameMatch = before.match(/[一-龥]{2,3}\s*$/);
        if (nameMatch) parsed.contact_name = nameMatch[0].trim();
      }
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: '解析失败：' + e.message });
  }
}

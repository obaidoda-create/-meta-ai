const hits = new Map();
const SYSTEM = 'أنت META AI، مساعد ذكاء اصطناعي عربي ودود ومفيد. رد دائماً بالعربية الواضحة، بأسلوب مهذب ومختصر ومنظّم.';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_api_key' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= 20) return res.status(429).json({ error: 'rate_limited' });
  recent.push(now); hits.set(ip, recent);

  let messages = (req.body && req.body.messages) || [];
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'bad_request' });
  messages = messages.slice(-30).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 6000)
  }));
  if (messages[0].role !== 'user') messages.shift();

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.MODEL || 'claude-sonnet-5-5', max_tokens: 1500, system: SYSTEM, messages })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'upstream_error' });
    const text = (j.content || []).map(c => c.text || '').join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};

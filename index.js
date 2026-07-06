const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const keys = {};

function generateKey() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return `ares-${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`;
}

function validateKey(key) {
  const entry = keys[key];
  if (!entry) return { valid: false, reason: 'Invalid key' };
  if (entry.expiry < Date.now()) return { valid: false, reason: 'Key expired' };
  entry.used_count = (entry.used_count || 0) + 1;
  return { valid: true, expiry: entry.expiry };
}

app.post('/api/validate', async (req, res) => {
  const { key } = req.body;
  const result = validateKey(key);
  res.json(result);
});

app.post('/api/predict', async (req, res) => {
  const { key, mines, seed } = req.body;
  const validation = validateKey(key);
  if (!validation.valid) {
    return res.json({ valid: false, reason: validation.reason });
  }
  const total = 25;
  const safe = mines <= 3 ? 5 : mines <= 6 ? 4 : mines <= 9 ? 3 : mines <= 12 ? 2 : 1;
  const tiles = Array.from({ length: total }, (_, i) => {
    const hash = (seed + i * 999 + 777) % 100;
    let score = 50 + (hash / 100) * 45;
    const row = Math.floor(i / 5), col = i % 5;
    const centerDist = Math.abs(row - 2) + Math.abs(col - 2);
    if (centerDist <= 2) score += 5 - centerDist;
    if (row === 0 || row === 4 || col === 0 || col === 4) score -= 3;
    return { index: i, score: Math.min(95, Math.max(50, score)) };
  });
  tiles.sort((a, b) => b.score - a.score);
  const result = {
    safe: tiles.slice(0, safe).map(t => t.index),
    bombs: tiles.slice(safe, safe + mines).map(t => t.index),
    scores: tiles.map(t => ({ index: t.index, score: Math.round(t.score) }))
  };
  res.json({ valid: true, ...result });
});

app.post('/admin/generate', (req, res) => {
  const { days = 365 } = req.body;
  const key = generateKey();
  keys[key] = { expiry: Date.now() + days * 86400000, used_count: 0 };
  res.json({ key, expiry: new Date(keys[key].expiry).toISOString() });
});

app.listen(3000, () => console.log('✅ Ares server running'));

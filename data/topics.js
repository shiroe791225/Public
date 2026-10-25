// Topic registry + loader for word files.
// Each word file calls addWords(topicId, raw) with one word per line:
//   level|word|pos|中文|example with *target* marked|例句中文
// level: 1 = 基礎 (~450 分), 2 = 核心 (~550 分), 3 = 進階 (600+)
window.TOPICS = [
  { id: 'office',     name: '辦公室日常', icon: '🏢' },
  { id: 'personnel',  name: '人事招募',   icon: '🧑‍💼' },
  { id: 'meetings',   name: '會議簡報',   icon: '📊' },
  { id: 'marketing',  name: '行銷業務',   icon: '📣' },
  { id: 'finance',    name: '財務會計',   icon: '💰' },
  { id: 'purchasing', name: '採購訂單',   icon: '🧾' },
  { id: 'logistics',  name: '製造物流',   icon: '🏭' },
  { id: 'travel',     name: '旅遊交通',   icon: '✈️' },
  { id: 'dining',     name: '餐飲飯店',   icon: '🍽️' },
  { id: 'shopping',   name: '購物客服',   icon: '🛍️' },
  { id: 'legal',      name: '合約法務',   icon: '📜' },
  { id: 'general',    name: '通用高頻',   icon: '⭐' },
];
window.LEVELS = { 1: '基礎', 2: '核心', 3: '進階' };
window.WORDS = [];

window.addWords = function (topic, raw) {
  const seen = window.__seenWords || (window.__seenWords = new Set());
  raw.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const [level, word, pos, zh, ex, exZh] = line.split('|').map(s => (s || '').trim());
    const id = word.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    window.WORDS.push({ id, word, pos, zh, ex, exZh, topic, level: Number(level) });
  });
};

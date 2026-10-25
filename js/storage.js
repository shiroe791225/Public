// localStorage wrapper with in-memory fallback (private mode / blocked storage).
(function () {
  const KEY = 'toeic600:v1';
  const memory = {};

  const defaults = () => ({
    settings: { newPerDay: 20, reviewLimit: 100, rate: 0.9, autoSpeak: true, theme: 'auto' },
    cards: {},          // id -> { reps, interval, ease, due, lapses, last }
    starred: {},        // id -> true
    daily: {},          // 'YYYY-MM-DD' -> { new, reviews }
  });

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = memory[KEY] || null; }
    if (!raw) return defaults();
    try {
      const data = JSON.parse(raw);
      const d = defaults();
      return {
        settings: Object.assign(d.settings, data.settings),
        cards: data.cards || {},
        starred: data.starred || {},
        daily: data.daily || {},
      };
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    const raw = JSON.stringify(state);
    try { localStorage.setItem(KEY, raw); } catch (e) { memory[KEY] = raw; }
  }

  function today(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.Store = { load, save, defaults, today, KEY };
})();

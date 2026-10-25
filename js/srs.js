// Simplified SM-2 spaced repetition.
// grade: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
(function () {
  const DAY = 86400000;
  const MATURE_DAYS = 21;

  function newCard() {
    return { reps: 0, interval: 0, ease: 2.5, due: 0, lapses: 0, last: 0 };
  }

  // Returns the next interval in days (fractional = minutes for relearning steps).
  function nextInterval(card, grade) {
    if (grade === 1) return 10 / 1440;               // 10 minutes
    if (card.reps === 0) return grade === 2 ? 1 : grade === 3 ? 1 : 4;
    if (card.reps === 1) return grade === 2 ? 2 : grade === 3 ? 3 : 7;
    const base = Math.max(card.interval, 1);
    if (grade === 2) return Math.max(base * 1.2, base + 1);
    if (grade === 3) return base * card.ease;
    return base * card.ease * 1.3;
  }

  function review(card, grade, now = Date.now()) {
    const c = Object.assign(newCard(), card);
    const ivl = nextInterval(c, grade);
    if (grade === 1) {
      c.lapses += 1;
      c.reps = 0;
      c.ease = Math.max(1.3, c.ease - 0.2);
    } else {
      c.reps += 1;
      if (grade === 2) c.ease = Math.max(1.3, c.ease - 0.15);
      if (grade === 4) c.ease = Math.min(3.0, c.ease + 0.15);
    }
    c.interval = grade === 1 ? 0 : Math.round(ivl * 10) / 10;
    c.due = now + ivl * DAY;
    c.last = now;
    return c;
  }

  function label(days) {
    if (days < 1) return Math.round(days * 1440) + ' 分';
    if (days < 30) return Math.round(days) + ' 天';
    if (days < 365) return Math.round(days / 30) + ' 月';
    return (days / 365).toFixed(1) + ' 年';
  }

  function preview(card, grade) {
    return label(nextInterval(Object.assign(newCard(), card), grade));
  }

  function status(card) {
    if (!card) return 'new';
    return card.interval >= MATURE_DAYS ? 'mature' : 'learning';
  }

  window.SRS = { review, preview, status, newCard, MATURE_DAYS };
})();

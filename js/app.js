(function () {
  const WORDS = window.WORDS;
  const TOPICS = window.TOPICS;
  const LEVELS = window.LEVELS;
  const byId = new Map(WORDS.map(w => [w.id, w]));
  const topicName = id => (TOPICS.find(t => t.id === id) || {}).name || id;

  let state = Store.load();
  const app = document.getElementById('app');

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hl = ex => esc(ex).replace(/\*(.+?)\*/g, '<mark>$1</mark>');
  const plain = ex => String(ex || '').replace(/\*/g, '');
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const save = () => Store.save(state);

  function todayLog() {
    const k = Store.today();
    return state.daily[k] || (state.daily[k] = { new: 0, reviews: 0 });
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  function streak() {
    let n = 0;
    for (let i = 0; ; i++) {
      const d = state.daily[Store.today(-i)];
      if (d && (d.new + d.reviews) > 0) n++;
      else if (i === 0) continue;       // today not started yet doesn't break the streak
      else break;
    }
    return n;
  }

  function counts() {
    const now = Date.now();
    let learned = 0, mature = 0, due = 0;
    for (const id in state.cards) {
      if (!byId.has(id)) continue;
      const c = state.cards[id];
      learned++;
      if (SRS.status(c) === 'mature') mature++;
      if (c.due <= now) due++;
    }
    return { learned, mature, due, total: WORDS.length };
  }

  function speakBtn(text, label = '🔊') {
    if (!Speech.supported) return '';
    return `<button class="icon-btn" data-speak="${esc(text)}" title="發音" aria-label="發音">${label}</button>`;
  }

  // ---------- views ----------
  function viewHome() {
    const c = counts();
    const log = todayLog();
    const newLeft = Math.max(0, state.settings.newPerDay - log.new);
    const remaining = c.total - c.learned;
    const days = Math.ceil(remaining / Math.max(1, state.settings.newPerDay));

    const topicRows = TOPICS.map(t => {
      const ws = WORDS.filter(w => w.topic === t.id);
      const learned = ws.filter(w => state.cards[w.id]).length;
      const pct = ws.length ? Math.round(learned / ws.length * 100) : 0;
      return `<a class="topic-row" href="#/study?topic=${t.id}" style="text-decoration:none;color:inherit">
        <span>${t.icon} ${esc(t.name)}</span><span class="meta">${learned} / ${ws.length}</span>
        <div class="bar"><i style="width:${pct}%"></i></div></a>`;
    }).join('');

    const levelRows = [1, 2, 3].map(l => {
      const ws = WORDS.filter(w => w.level === l);
      const learned = ws.filter(w => state.cards[w.id]).length;
      const pct = ws.length ? Math.round(learned / ws.length * 100) : 0;
      return `<div class="topic-row"><span>Lv${l} ${LEVELS[l]}</span><span class="meta">${learned} / ${ws.length}</span>
        <div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('');

    app.innerHTML = `
      <h1>多益 600 分單字計畫</h1>
      <p class="sub">核心 ${c.total.toLocaleString()} 字・間隔重複記憶・發音・測驗</p>

      <div class="callout">
        <strong>結論：</strong>多益 600 分約需 <strong>3,000–4,000</strong> 個總詞彙量，其中多益情境高頻字約 <strong>2,000</strong> 個。
        本站先收錄最常考的 <strong>${c.total.toLocaleString()}</strong> 字（Lv1 基礎 → Lv3 進階），
        每天 ${state.settings.newPerDay} 個新字，約 <strong>${days}</strong> 天可學完剩餘單字。
      </div>

      <div class="grid stats">
        <div class="card stat"><div class="num">${c.learned}</div><div class="lbl">已學單字</div></div>
        <div class="card stat"><div class="num">${c.mature}</div><div class="lbl">熟記（間隔 ≥ ${SRS.MATURE_DAYS} 天）</div></div>
        <div class="card stat"><div class="num">${c.due}</div><div class="lbl">待複習</div></div>
        <div class="card stat"><div class="num">${streak()}</div><div class="lbl">連續天數</div></div>
      </div>

      <h2>今日任務</h2>
      <div class="card row">
        <div>複習 <b>${Math.min(c.due, Math.max(0, state.settings.reviewLimit - log.reviews))}</b> 張・新字 <b>${Math.min(newLeft, remaining)}</b> 個
          <div class="sub" style="margin:0">今日已完成：新字 ${log.new}、複習 ${log.reviews}</div></div>
        <span class="spacer"></span>
        <a class="btn primary" href="#/study">開始背單字</a>
        <a class="btn" href="#/quiz">測驗</a>
      </div>

      <h2>主題進度</h2>
      <div class="card">${topicRows}</div>

      <h2>等級進度</h2>
      <div class="card">${levelRows}</div>
    `;
  }

  // ----- study (flashcards) -----
  let session = null;

  function buildQueue(topic) {
    const now = Date.now();
    const log = todayLog();
    const reviewQuota = Math.max(0, state.settings.reviewLimit - log.reviews);
    const newQuota = Math.max(0, state.settings.newPerDay - log.new);

    const due = Object.keys(state.cards)
      .filter(id => byId.has(id) && state.cards[id].due <= now && (!topic || byId.get(id).topic === topic))
      .sort((a, b) => state.cards[a].due - state.cards[b].due)
      .slice(0, reviewQuota);

    const fresh = WORDS
      .filter(w => !state.cards[w.id] && (!topic || w.topic === topic))
      .sort((a, b) => a.level - b.level)
      .slice(0, newQuota)
      .map(w => w.id);

    // interleave: one new card after every 3 reviews
    const q = [];
    let i = 0, j = 0;
    while (i < due.length || j < fresh.length) {
      for (let k = 0; k < 3 && i < due.length; k++) q.push(due[i++]);
      if (j < fresh.length) q.push(fresh[j++]);
    }
    return q;
  }

  function viewStudy(params) {
    const topic = params.get('topic') || '';
    if (!session || session.topic !== topic) {
      session = { topic, queue: buildQueue(topic), flipped: false, done: 0 };
    }
    renderStudy();
  }

  function topicSelect(current, name = 'topic') {
    return `<select id="${name}-select" aria-label="主題">
      <option value="">全部主題</option>
      ${TOPICS.map(t => `<option value="${t.id}" ${t.id === current ? 'selected' : ''}>${t.icon} ${esc(t.name)}</option>`).join('')}
    </select>`;
  }

  function renderStudy() {
    const s = session;
    const head = `<div class="row" style="margin-bottom:12px">
      <h1 style="margin:0">背單字</h1><span class="spacer"></span>
      <div style="min-width:180px">${topicSelect(s.topic)}</div></div>`;

    if (!s.queue.length) {
      const c = counts();
      app.innerHTML = head + `<div class="card empty">
        <p style="font-size:40px;margin:0">🎉</p>
        <p>${s.done ? `本輪完成 ${s.done} 張！` : ''}今日${s.topic ? '此主題' : ''}的複習與新字已完成。</p>
        <p>目前待複習 ${c.due} 張。可以去做個測驗鞏固記憶，或到「設定」調高每日新字數。</p>
        <div class="row" style="justify-content:center">
          <a class="btn primary" href="#/quiz">去測驗</a>
          <button class="btn" id="more-new">再加 10 個新字</button>
        </div></div>`;
      bindTopicSelect('study');
      document.getElementById('more-new').onclick = () => {
        state.settings.newPerDay += 10; save();
        session = null; route();
        toast('今日新字上限 +10');
      };
      return;
    }

    const id = s.queue[0];
    const w = byId.get(id);
    const card = state.cards[id];
    const isNew = !card;
    const remainingNew = s.queue.filter(x => !state.cards[x]).length;
    const remainingRev = s.queue.length - remainingNew;

    app.innerHTML = head + `
      <div class="row sub" style="margin-bottom:8px">
        <span>剩餘：複習 ${remainingRev}・新字 ${remainingNew}</span><span class="spacer"></span>
        <span class="tag">${esc(topicName(w.topic))}</span>
        <span class="tag">Lv${w.level} ${LEVELS[w.level]}</span>
        ${isNew ? '<span class="tag" style="color:var(--primary)">NEW</span>' : ''}
      </div>
      <div class="card flash" id="flash">
        <div class="word">${esc(w.word)} ${speakBtn(w.word)}</div>
        <div class="pos">${esc(w.pos)}</div>
        ${s.flipped ? `
          <div class="zh">${esc(w.zh)}</div>
          <div class="ex">${hl(w.ex)} ${speakBtn(plain(w.ex), '🔈')}</div>
          <div class="exzh">${esc(w.exZh)}</div>
        ` : `<div style="margin-top:20px"><button class="btn primary" id="flip">顯示答案</button></div>`}
      </div>
      ${s.flipped ? `
        <div class="grades">
          ${[1, 2, 3, 4].map(g => `<button class="btn g${g}" data-grade="${g}">
            ${['', '忘記', '困難', '記得', '簡單'][g]}<small>${SRS.preview(card, g)}</small></button>`).join('')}
        </div>
        <div class="kbd">快捷鍵：1 忘記・2 困難・3 記得・4 簡單・P 發音</div>
      ` : `<div class="kbd">快捷鍵：空白鍵 翻面・P 發音</div>`}
    `;

    bindTopicSelect('study');
    const flip = document.getElementById('flip');
    if (flip) flip.onclick = () => { s.flipped = true; renderStudy(); };
    app.querySelectorAll('[data-grade]').forEach(b => b.onclick = () => grade(Number(b.dataset.grade)));
    if (!s.flipped && state.settings.autoSpeak && s.lastSpoken !== id) {
      s.lastSpoken = id;
      Speech.speak(w.word, state.settings.rate);
    }
  }

  function grade(g) {
    const s = session;
    const id = s.queue.shift();
    const wasNew = !state.cards[id];
    const log = todayLog();
    if (wasNew) log.new++; else log.reviews++;
    state.cards[id] = SRS.review(state.cards[id], g);
    if (g === 1) s.queue.splice(Math.min(s.queue.length, 5), 0, id);   // see it again soon
    s.flipped = false;
    s.done++;
    save();
    renderStudy();
  }

  function bindTopicSelect(route) {
    const sel = document.getElementById('topic-select');
    if (sel) sel.onchange = () => { location.hash = '#/' + route + (sel.value ? '?topic=' + sel.value : ''); };
  }

  // ----- quiz -----
  let quiz = null;

  function viewQuiz() {
    if (!quiz || quiz.finished === 'reset') return renderQuizSetup();
    renderQuiz();
  }

  function renderQuizSetup() {
    const learned = Object.keys(state.cards).filter(id => byId.has(id)).length;
    app.innerHTML = `
      <h1>測驗</h1>
      <p class="sub">答錯的字會自動排入複習。</p>
      <div class="card grid">
        <label>題型
          <select id="q-mode">
            <option value="en2zh">英 → 中（看英文選中文）</option>
            <option value="zh2en">中 → 英（看中文選英文）</option>
            <option value="cloze">例句填空（模擬 Part 5）</option>
          </select></label>
        <label>範圍
          <select id="q-scope">
            <option value="learned" ${learned >= 4 ? '' : 'disabled'}>已學過的字（${learned}）</option>
            <option value="starred">標記的難字（${Object.keys(state.starred).length}）</option>
            <option value="all" ${learned >= 4 ? '' : 'selected'}>全部字庫</option>
            ${TOPICS.map(t => `<option value="t:${t.id}">${t.icon} ${esc(t.name)}</option>`).join('')}
          </select></label>
        <label>題數
          <select id="q-count"><option>10</option><option selected>20</option><option>30</option><option>50</option></select></label>
        <button class="btn primary" id="q-start">開始測驗</button>
      </div>`;
    document.getElementById('q-start').onclick = () => {
      const mode = document.getElementById('q-mode').value;
      const scope = document.getElementById('q-scope').value;
      const n = Number(document.getElementById('q-count').value);
      let pool;
      if (scope === 'learned') pool = WORDS.filter(w => state.cards[w.id]);
      else if (scope === 'starred') pool = WORDS.filter(w => state.starred[w.id]);
      else if (scope.startsWith('t:')) pool = WORDS.filter(w => w.topic === scope.slice(2));
      else pool = WORDS.slice();
      if (pool.length < 1) return toast('這個範圍目前沒有單字');
      const items = shuffle(pool.slice()).slice(0, n);
      quiz = { mode, items, idx: 0, score: 0, answered: null, wrong: [], choices: null };
      renderQuiz();
    };
  }

  function makeChoices(w) {
    // prefer distractors with the same part of speech
    const posKey = w.pos.split(/[ /,]/)[0];
    let cands = WORDS.filter(x => x.id !== w.id && x.pos.split(/[ /,]/)[0] === posKey && x.zh !== w.zh);
    if (cands.length < 3) cands = WORDS.filter(x => x.id !== w.id && x.zh !== w.zh);
    return shuffle([w].concat(shuffle(cands.slice()).slice(0, 3)));
  }

  function renderQuiz() {
    const q = quiz;
    if (q.idx >= q.items.length) return renderQuizResult();
    const w = q.items[q.idx];
    if (!q.choices) q.choices = makeChoices(w);

    let prompt, label;
    if (q.mode === 'en2zh') { prompt = `<div class="q-prompt">${esc(w.word)} ${speakBtn(w.word)}</div><p class="sub" style="text-align:center">${esc(w.pos)}</p>`; label = x => esc(x.zh); }
    else if (q.mode === 'zh2en') { prompt = `<div class="q-prompt">${esc(w.zh)}</div><p class="sub" style="text-align:center">${esc(w.pos)}</p>`; label = x => esc(x.word); }
    else {
      const blank = esc(w.ex).replace(/\*(.+?)\*/, '<b>________</b>');
      prompt = `<div class="q-prompt sentence">${blank}</div><p class="sub">提示：${esc(w.zh)}（${esc(w.pos)}）</p>`;
      label = x => esc(x.word);
    }

    const answered = q.answered;
    app.innerHTML = `
      <div class="row" style="margin-bottom:8px"><h1 style="margin:0">測驗</h1><span class="spacer"></span>
        <span class="sub" style="margin:0">${q.idx + 1} / ${q.items.length}・得分 ${q.score}</span></div>
      <div class="bar" style="margin-bottom:12px"><i style="width:${q.idx / q.items.length * 100}%"></i></div>
      <div class="card">
        ${prompt}
        <div class="choices">
          ${q.choices.map((c, i) => {
            let cls = '';
            if (answered) { if (c.id === w.id) cls = 'correct'; else if (c.id === answered) cls = 'wrong'; }
            return `<button class="btn choice ${cls}" data-choice="${esc(c.id)}" ${answered ? 'disabled' : ''}>${i + 1}. ${label(c)}</button>`;
          }).join('')}
        </div>
        ${answered ? `
          <div style="margin-top:14px">
            <div><b>${esc(w.word)}</b> <span class="sub">${esc(w.pos)}</span> ${esc(w.zh)} ${speakBtn(w.word)}</div>
            <div>${hl(w.ex)}</div><div class="sub" style="margin:0">${esc(w.exZh)}</div>
          </div>
          <div class="row" style="margin-top:12px"><span class="spacer"></span>
            <button class="btn primary" id="q-next">${q.idx + 1 < q.items.length ? '下一題 →' : '看結果'}</button></div>
          <div class="kbd">快捷鍵：Enter 下一題</div>` : `<div class="kbd">快捷鍵：1–4 選答案</div>`}
      </div>`;

    app.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => answer(b.dataset.choice));
    const next = document.getElementById('q-next');
    if (next) next.onclick = nextQuestion;
  }

  function answer(choiceId) {
    const q = quiz;
    if (q.answered) return;
    const w = q.items[q.idx];
    q.answered = choiceId;
    if (choiceId === w.id) q.score++;
    else {
      q.wrong.push(w);
      state.cards[w.id] = SRS.review(state.cards[w.id], 1);   // schedule for review soon
      save();
    }
    if (q.mode !== 'en2zh' && state.settings.autoSpeak) Speech.speak(w.word, state.settings.rate);
    renderQuiz();
  }

  function nextQuestion() {
    quiz.idx++; quiz.answered = null; quiz.choices = null;
    renderQuiz();
  }

  function renderQuizResult() {
    const q = quiz;
    const pct = Math.round(q.score / q.items.length * 100);
    app.innerHTML = `
      <h1>測驗結果</h1>
      <div class="card" style="text-align:center">
        <div style="font-size:48px;font-weight:700">${pct}%</div>
        <p>答對 ${q.score} / ${q.items.length}${pct >= 85 ? '・表現很好！' : pct >= 60 ? '・持續加油！' : '・建議先回到背單字複習'}</p>
        <div class="row" style="justify-content:center">
          <button class="btn primary" id="q-again">再測一次</button>
          <a class="btn" href="#/study">去複習</a>
        </div>
      </div>
      ${q.wrong.length ? `<h2>答錯的字（已排入複習）</h2>
        <div class="card"><ul class="wlist">${q.wrong.map(listItem).join('')}</ul></div>` : ''}`;
    document.getElementById('q-again').onclick = () => { quiz = null; renderQuizSetup(); };
    bindListActions();
  }

  // ----- word list -----
  const listState = { q: '', topic: '', level: '', status: '', limit: 100 };

  function listItem(w) {
    const st = SRS.status(state.cards[w.id]);
    const star = !!state.starred[w.id];
    return `<li>
      <div class="w"><span class="status-dot ${st}" title="${{ new: '未學', learning: '學習中', mature: '熟記' }[st]}"></span>${esc(w.word)} <span class="sub" style="font-weight:400">${esc(w.pos)}</span> ${esc(w.zh)}</div>
      <div class="d">${hl(w.ex)}<br>${esc(w.exZh)}</div>
      <div class="acts">${speakBtn(w.word)}<button class="icon-btn ${star ? 'on' : ''}" data-star="${esc(w.id)}" title="標記難字" aria-label="標記難字">${star ? '★' : '☆'}</button></div>
    </li>`;
  }

  function filteredWords() {
    const q = listState.q.trim().toLowerCase();
    return WORDS.filter(w =>
      (!listState.topic || w.topic === listState.topic) &&
      (!listState.level || w.level === Number(listState.level)) &&
      (!listState.status || (listState.status === 'starred' ? state.starred[w.id] : SRS.status(state.cards[w.id]) === listState.status)) &&
      (!q || w.word.toLowerCase().includes(q) || w.zh.includes(q)));
  }

  function viewList() {
    app.innerHTML = `
      <h1>字庫</h1>
      <p class="sub">共 ${WORDS.length} 字。點 ☆ 標記難字，可在測驗中單獨練習。</p>
      <div class="filters">
        <input type="search" id="l-q" placeholder="搜尋英文或中文…" value="${esc(listState.q)}">
        ${topicSelect(listState.topic, 'l-topic').replace('id="l-topic-select"', 'id="l-topic"')}
        <select id="l-level"><option value="">全部等級</option>${[1, 2, 3].map(l => `<option value="${l}" ${String(l) === listState.level ? 'selected' : ''}>Lv${l} ${LEVELS[l]}</option>`).join('')}</select>
        <select id="l-status">
          <option value="">全部狀態</option>
          <option value="new">未學</option><option value="learning">學習中</option>
          <option value="mature">熟記</option><option value="starred">★ 難字</option>
        </select>
      </div>
      <div class="card"><div id="l-count" class="sub"></div><ul class="wlist" id="l-items"></ul>
        <div class="row" style="justify-content:center;margin-top:8px"><button class="btn" id="l-more">顯示更多</button></div></div>`;
    document.getElementById('l-status').value = listState.status;
    const rerender = () => {
      const list = filteredWords();
      document.getElementById('l-count').textContent = `符合 ${list.length} 字`;
      document.getElementById('l-items').innerHTML = list.slice(0, listState.limit).map(listItem).join('') || '<li class="empty">沒有符合的單字</li>';
      document.getElementById('l-more').style.display = list.length > listState.limit ? '' : 'none';
      bindListActions();
    };
    const on = (id, key) => document.getElementById(id).addEventListener(id === 'l-q' ? 'input' : 'change', e => { listState[key] = e.target.value; listState.limit = 100; rerender(); });
    on('l-q', 'q'); on('l-topic', 'topic'); on('l-level', 'level'); on('l-status', 'status');
    document.getElementById('l-more').onclick = () => { listState.limit += 100; rerender(); };
    rerender();
  }

  function bindListActions() {
    app.querySelectorAll('[data-star]').forEach(b => b.onclick = () => {
      const id = b.dataset.star;
      if (state.starred[id]) delete state.starred[id]; else state.starred[id] = true;
      save();
      b.classList.toggle('on', !!state.starred[id]);
      b.textContent = state.starred[id] ? '★' : '☆';
    });
  }

  // ----- settings -----
  function viewSettings() {
    const st = state.settings;
    app.innerHTML = `
      <h1>設定</h1>
      <div class="card">
        <div class="field"><div>每日新字數<div class="hint">建議 15–30；每天 20 字約 2 個月學完</div></div><input type="number" id="s-new" min="1" max="200" value="${st.newPerDay}"></div>
        <div class="field"><div>每日複習上限</div><input type="number" id="s-rev" min="10" max="1000" value="${st.reviewLimit}"></div>
        <div class="field"><div>發音語速<div class="hint">${Speech.supported ? '使用裝置內建語音' : '此瀏覽器不支援語音'}</div></div>
          <select id="s-rate">${[0.7, 0.8, 0.9, 1.0, 1.1].map(r => `<option value="${r}" ${r === st.rate ? 'selected' : ''}>${r}x</option>`).join('')}</select></div>
        <div class="field"><div>出現新卡時自動發音</div><select id="s-auto"><option value="1" ${st.autoSpeak ? 'selected' : ''}>開</option><option value="0" ${st.autoSpeak ? '' : 'selected'}>關</option></select></div>
        <div class="field"><div>外觀</div><select id="s-theme">
          <option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>跟隨系統</option>
          <option value="light" ${st.theme === 'light' ? 'selected' : ''}>淺色</option>
          <option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>深色</option></select></div>
      </div>

      <h2>備份與還原</h2>
      <div class="card row">
        <button class="btn" id="s-export">匯出進度 (JSON)</button>
        <label class="btn" for="s-import">匯入進度</label>
        <input type="file" id="s-import" accept="application/json,.json" hidden>
        <span class="spacer"></span>
        <button class="btn" id="s-reset" style="color:var(--again)">重置所有進度</button>
      </div>`;

    const num = (id, key, min, max) => document.getElementById(id).onchange = e => {
      const v = Math.min(max, Math.max(min, Math.round(Number(e.target.value) || min)));
      st[key] = v; e.target.value = v; save(); session = null; toast('已儲存');
    };
    num('s-new', 'newPerDay', 1, 200);
    num('s-rev', 'reviewLimit', 10, 1000);
    document.getElementById('s-rate').onchange = e => { st.rate = Number(e.target.value); save(); Speech.speak('schedule', st.rate); };
    document.getElementById('s-auto').onchange = e => { st.autoSpeak = e.target.value === '1'; save(); };
    document.getElementById('s-theme').onchange = e => { st.theme = e.target.value; save(); applyTheme(); };

    document.getElementById('s-export').onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `toeic600-backup-${Store.today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    document.getElementById('s-import').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          if (!data || typeof data.cards !== 'object') throw new Error('bad file');
          Store.save(data);
          state = Store.load();
          session = null; applyTheme(); toast('匯入完成'); route();
        } catch (err) { toast('檔案格式不正確'); }
      };
      r.readAsText(f);
    };
    document.getElementById('s-reset').onclick = () => {
      if (!confirm('確定要清除所有學習進度？此動作無法復原（建議先匯出備份）。')) return;
      state = Store.defaults(); save(); session = null; quiz = null; applyTheme(); toast('已重置'); route();
    };
  }

  // ---------- router ----------
  function route() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [path, qs] = hash.split('?');
    const params = new URLSearchParams(qs || '');
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === (path || '')));
    if (path === 'study') viewStudy(params);
    else if (path === 'quiz') viewQuiz();
    else if (path === 'list') viewList();
    else if (path === 'settings') viewSettings();
    else { session = null; viewHome(); }
    window.scrollTo(0, 0);
  }

  // global delegated handlers
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-speak]');
    if (b) { e.preventDefault(); e.stopPropagation(); Speech.speak(b.dataset.speak, state.settings.rate); }
  });

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const path = location.hash.replace(/^#\/?/, '').split('?')[0];
    if (path === 'study' && session && session.queue.length) {
      const w = byId.get(session.queue[0]);
      if (e.key === 'p' || e.key === 'P') Speech.speak(w.word, state.settings.rate);
      else if (!session.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); session.flipped = true; renderStudy(); }
      else if (session.flipped && /^[1-4]$/.test(e.key)) grade(Number(e.key));
    } else if (path === 'quiz' && quiz && quiz.idx < quiz.items.length) {
      if (!quiz.answered && /^[1-4]$/.test(e.key) && quiz.choices) answer(quiz.choices[Number(e.key) - 1].id);
      else if (quiz.answered && e.key === 'Enter') { e.preventDefault(); nextQuestion(); }
    }
  });

  window.addEventListener('hashchange', route);
  applyTheme();
  route();
})();

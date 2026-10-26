/* 通勤 N3 道場 — 12 週 / 每日 40 分 / SRS 間隔複習 */
(function () {
  'use strict';

  /* ───────── 資料 ───────── */
  var V = (window.N3_VOCAB_A || []).concat(window.N3_VOCAB_B || []);
  var G = window.N3_GRAMMAR || [];
  var K = window.N3_KANJI || [];
  var R = window.N3_READING || [];
  var L = window.N3_LISTENING || [];
  var DAYS = 84, STUDY = 72;

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  if (!V.length || !G.length || !K.length || !R.length || !L.length) {
    var box = $('#v-today');
    if (box) box.innerHTML = '<div class="card"><h2>內容檔沒有載入</h2>' +
      '<p style="margin-top:8px;font-size:13px">語彙／文法／漢字／読解／聴解 的資料檔必須和本頁一起發佈。請重新發佈後再開啟。</p></div>';
    return;
  }

  /* 扁平索引 */
  var VW = [];                      // 全部單字
  V.forEach(function (g, gi) { g.v.forEach(function (w, wi) { VW.push({ gi: gi, wi: wi, w: w, t: g.t }); }); });
  var KC = [];                      // 全部漢字
  K.forEach(function (g, gi) { g.v.forEach(function (k, ki) { KC.push({ gi: gi, ki: ki, k: k, t: g.t }); }); });
  var GMAP = {}; G.forEach(function (g) { GMAP[g.id] = g; });
  var KMAP = {}; KC.forEach(function (x) { KMAP[x.k.k] = x; });

  /* ───────── 日期工具 ───────── */
  function dstr(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function parse(ds) { var p = String(ds || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
  function addDays(ds, n) { var d = parse(ds); d.setDate(d.getDate() + n); return dstr(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  var TODAY = dstr(new Date());

  /* ───────── 課程計畫 ───────── */
  function isReviewDay(d) { return d % 7 === 0; }
  function studyIdx(d) { return d - Math.floor(d / 7); }      // 1..72
  function reviewIdx(d) { return d / 7; }                      // 1..12
  function b3kind(s) { var m = s % 4; return (m === 1 || m === 2) ? 'kanji' : (m === 3 ? 'read' : 'listen'); }
  function kanjiOrd(s) { return Math.floor((s - 1) / 4) * 2 + (s % 4 === 1 ? 0 : 1); }   // 第幾個漢字日 0..35
  /* 36 個漢字日要分配 40 組：每 9 個漢字日有 1 天上 2 組（8 字），其餘上 1 組（4 字） */
  function kanjiGroups(s) {
    var n = kanjiOrd(s), start = n + Math.floor(n / 9), cnt = (n % 9 === 8) ? 2 : 1, out = [];
    for (var i = 0; i < cnt; i++) { if (K[start + i]) out.push(start + i); }
    if (!out.length) out.push(Math.min(n, K.length - 1));
    return out;
  }
  function rlIdx(s) { return Math.floor((s - 1) / 4); }
  function gramRange(s) {
    return [Math.floor((s - 1) * G.length / STUDY), Math.floor(s * G.length / STUDY)];
  }

  function planFor(d) {
    d = Math.max(1, Math.min(DAYS, d));
    if (isReviewDay(d)) {
      var r = reviewIdx(d);
      return {
        day: d, review: true, blocks: [
          { k: 'srs', t: '弱點復習', m: 12, s: '到期卡片優先' },
          { k: 'listen', t: '聴解', m: 8, s: (L[17 + r] || L[L.length - 1]).ti, li: Math.min(17 + r, L.length - 1) },
          { k: 'mock', t: 'ミニ模試', m: 20, s: '20 題綜合測驗' }
        ]
      };
    }
    var s = studyIdx(d), kind = b3kind(s), gr = gramRange(s);
    var vi = (s - 1) % V.length;
    var b3;
    if (kind === 'kanji') {
      var kis = kanjiGroups(s);
      var nch = kis.reduce(function (a, i) { return a + K[i].v.length; }, 0);
      b3 = { k: 'kanji', t: '漢字', m: 10, s: kis.map(function (i) { return K[i].t; }).join('・') + '（' + nch + ' 字）', kis: kis };
    }
    else if (kind === 'read') { var ri = Math.min(rlIdx(s), R.length - 1); b3 = { k: 'read', t: '読解', m: 10, s: R[ri].ti, ri: ri }; }
    else { var li = Math.min(rlIdx(s), L.length - 1); b3 = { k: 'listen', t: '聴解', m: 10, s: L[li].ti, li: li }; }
    return {
      day: d, review: false, si: s, blocks: [
        { k: 'vocab', t: '語彙', m: 10, s: V[vi].t + '（8 語）', vi: vi },
        { k: 'gram', t: '文法', m: 10, s: G.slice(gr[0], gr[1]).map(function (x) { return x.p; }).join('／'), ga: gr[0], gb: gr[1] },
        b3,
        { k: 'srs', t: '復習', m: 10, s: '到期卡片' }
      ]
    };
  }

  /* ───────── 狀態 ───────── */
  var LS = 'n3dojo.v1';
  var DEF = { v: 1, u: 0, examDate: '', day: 1, srs: {}, done: {}, log: {}, stats: { ok: 0, ng: 0 }, set: { rate: 0.85, theme: 'auto' } };
  var S = clone(DEF);

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function normalize(x) {
    var s = Object.assign(clone(DEF), x || {});
    s.srs = (x && x.srs) || {}; s.done = (x && x.done) || {}; s.log = (x && x.log) || {};
    s.stats = Object.assign({ ok: 0, ng: 0 }, (x && x.stats) || {});
    s.set = Object.assign({ rate: 0.85, theme: 'auto' }, (x && x.set) || {});
    s.day = Math.max(1, Math.min(DAYS, Number(s.day) || 1));
    return s;
  }
  try { var raw = localStorage.getItem(LS); if (raw) S = normalize(JSON.parse(raw)); } catch (e) { }

  var db = null, uid = null, pushTimer = null, pushing = false;
  function setSync(txt, cls) {
    var p = $('#syncPill'); if (!p) return;
    p.textContent = txt; p.className = 'pill' + (cls ? ' ' + cls : '');
    var st = $('#saveState'); if (st) st.textContent = txt;
  }
  function save() {
    S.u = Date.now();
    try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { }
    if (db && uid) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
  }
  function push() {
    if (!db || !uid || pushing) return;
    pushing = true;
    db.doc('progress/' + uid).set(S).then(function () {
      pushing = false; setSync('已同步', 'on');
    })['catch'](function (err) {
      pushing = false;
      setSync(err && err.code === 'unavailable' ? '離線（已存本機）' : '僅存本機', 'warn');
    });
  }
  window.addEventListener('beforeunload', function () { if (pushTimer) { clearTimeout(pushTimer); push(); } });

  /* ───────── SRS ───────── */
  var IV = [0, 1, 2, 4, 8, 16, 32, 64, 120];
  function card(id) { return S.srs[id]; }
  function grade(id, ok) {
    if (!id) { S.stats[ok ? 'ok' : 'ng']++; save(); return; }
    var c = S.srs[id] || { b: 0, l: 0, d: TODAY };
    if (ok) { c.b = Math.min((c.b || 0) + 1, 8); c.d = addDays(TODAY, IV[c.b]); }
    else { c.l = (c.l || 0) + 1; c.b = 1; c.d = TODAY; }
    S.srs[id] = c;
    S.stats[ok ? 'ok' : 'ng']++;
    save();
  }
  function seed(id) { if (!S.srs[id]) { S.srs[id] = { b: 1, l: 0, d: addDays(TODAY, 1) }; } }
  function dueIds() {
    return Object.keys(S.srs).filter(function (k) { return diffDays(S.srs[k].d, TODAY) >= 0; });
  }
  function countBy(pre) {
    var n = 0; for (var k in S.srs) { if (k.charAt(0) === pre) n++; } return n;
  }

  /* ───────── 統計 ───────── */
  function streak() {
    var n = 0, d = TODAY;
    if (!S.log[d]) { d = addDays(TODAY, -1); if (!S.log[d]) return 0; }
    while (S.log[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function doneList(d) { return S.done[String(d)] || []; }
  function markDone(d, k, mins) {
    var key = String(d), a = S.done[key] || [];
    if (a.indexOf(k) < 0) a.push(k);
    S.done[key] = a;
    S.log[TODAY] = (S.log[TODAY] || 0) + (mins || 0);
    var p = planFor(d);
    if (a.length >= p.blocks.length && d < DAYS) { S.day = d + 1; S.done[String(d)] = a; }
    save();
  }

  /* ───────── DOM 小工具 ───────── */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      if (a === 'class') n.className = attrs[a];
      else if (a === 'text') n.textContent = attrs[a];
      else if (a === 'html') n.innerHTML = attrs[a];
      else if (a === 'on') { for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]); }
      else if (attrs[a] !== null && attrs[a] !== undefined) n.setAttribute(a, attrs[a]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function tx(tag, cls, text) { return el(tag, { 'class': cls, text: text }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(arr, n, exclude) {
    var out = [], used = {}, guard = 0;
    while (out.length < n && guard++ < n * 60) {
      var x = arr[Math.floor(Math.random() * arr.length)];
      var key = typeof exclude === 'function' ? exclude(x) : String(x);
      if (!x || used[key] || (typeof exclude === 'function' && exclude(x) === null)) continue;
      used[key] = 1; out.push(x);
    }
    return out;
  }

  /* ───────── 朗讀 ───────── */
  var canSpeak = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var jaVoice = null, voiceChecked = false;
  function loadVoices() {
    if (!canSpeak) return;
    var vs = [];
    try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { }
    for (var i = 0; i < vs.length; i++) { if (/^ja/i.test(vs[i].lang || '')) { jaVoice = vs[i]; break; } }
    if (vs.length) voiceChecked = true;
    var note = $('#voiceNote');
    if (note) note.textContent = !canSpeak ? '此裝置不支援' : (jaVoice ? '可用：' + jaVoice.name : (voiceChecked ? '找不到日文語音' : '檢查中…'));
  }
  if (canSpeak) {
    loadVoices();
    try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { }
    setTimeout(loadVoices, 800);
  }
  function say(text, done) {
    if (!canSpeak || !text) { if (done) done(); return false; }
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(String(text));
      u.lang = 'ja-JP'; u.rate = Number(S.set.rate) || 0.85;
      if (jaVoice) u.voice = jaVoice;
      if (done) { u.onend = done; u.onerror = done; }
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { if (done) done(); return false; }
  }
  function saySeq(lines, i, done) {
    i = i || 0;
    if (i >= lines.length) { if (done) done(); return; }
    say(lines[i], function () { setTimeout(function () { saySeq(lines, i + 1, done); }, 260); });
  }
  function stopSay() { if (canSpeak) { try { window.speechSynthesis.cancel(); } catch (e) { } } }
  function spkBtn(text) {
    return el('button', { 'class': 'spk', 'aria-label': '朗讀', text: '♪', on: { click: function () { say(text); } } });
  }

  /* ───────── 題目產生器 ───────── */
  function mk(id, head, optList, answer, expl, extra) {
    var o = shuffle(optList.slice());
    var q = { id: id, h: head, opts: o, c: o.indexOf(answer), ex: expl };
    if (extra) for (var p in extra) q[p] = extra[p];
    return q;
  }
  function uniq4(answer, pool, getter) {
    var out = [answer], seen = {}, guard = 0;
    seen[answer] = 1;
    while (out.length < 4 && guard++ < 400) {
      var x = getter(pool[Math.floor(Math.random() * pool.length)]);
      if (!x || seen[x]) continue;
      seen[x] = 1; out.push(x);
    }
    while (out.length < 4) out.push('—' + out.length);
    return out;
  }
  var hasKanji = function (s) { return /[㐀-鿿]/.test(s); };

  function qVocab(gi, wi, mode) {
    var w = V[gi] && V[gi].v[wi]; if (!w) return null;
    var id = 'v:' + gi + ':' + wi;
    if (mode === 'read' && hasKanji(w.w)) {
      return mk(id, '這個詞怎麼讀？', uniq4(w.r, VW, function (x) { return x.w.r; }), w.r,
        w.w + '（' + w.r + '）＝' + w.m, { big: w.w, say: w.w, kana: true });
    }
    if (mode === 'word') {
      return mk(id, '哪一個是「' + w.m + '」？', uniq4(w.w, VW, function (x) { return x.w.w; }), w.w,
        w.w + '（' + w.r + '）＝' + w.m, { say: w.w });
    }
    return mk(id, '這個單字的意思？', uniq4(w.m, VW, function (x) { return x.w.m; }), w.m,
      w.w + '（' + w.r + '）＝' + w.m + '　' + (w.p || ''), { big: w.w, sub: w.r, say: w.w, zh: true });
  }
  function qGram(g, mode) {
    if (!g) return null;
    var id = 'g:' + g.id;
    if (mode === 'mean') {
      return mk(id, '「' + g.p + '」的意思？', uniq4(g.m, G, function (x) { return x.m; }), g.m,
        g.p + '：' + g.m + '\n接續：' + g.f, { zh: true });
    }
    if (mode === 'ex' && g.ex && g.ex[0]) {
      return mk(id, '這句話的意思？', uniq4(g.ex[0].z, G, function (x) { return x.ex && x.ex[0] ? x.ex[0].z : null; }), g.ex[0].z,
        g.ex[0].j + '\n（' + g.p + '＝' + g.m + '）', { sent: g.ex[0].j, say: g.ex[0].j, zh: true });
    }
    return mk(id, '「' + g.m + '」要用哪個句型？', uniq4(g.p, G, function (x) { return x.p; }), g.p,
      g.p + '：' + g.m + '\n接續：' + g.f);
  }
  function qKanji(ch, mode) {
    var x = KMAP[ch]; if (!x) return null;
    var k = x.k, id = 'k:' + ch;
    if (mode === 'word' && k.w && k.w.length) {
      var wd = k.w[Math.floor(Math.random() * k.w.length)];
      return mk(id, '「' + wd.w + '」怎麼讀？', uniq4(wd.r, KC, function (y) { return y.k.w && y.k.w[0] ? y.k.w[0].r : null; }), wd.r,
        wd.w + '（' + wd.r + '）＝' + wd.m, { big: wd.w, say: wd.w, kana: true });
    }
    return mk(id, '這個漢字的意思？', uniq4(k.m, KC, function (y) { return y.k.m; }), k.m,
      k.k + '　音：' + k.on + '　訓：' + k.kun + '　' + k.m, { big: k.k, zh: true });
  }
  function qForId(id) {
    var p = id.split(':');
    if (p[0] === 'v') return qVocab(Number(p[1]), Number(p[2]), Math.random() < 0.4 ? 'read' : (Math.random() < 0.5 ? 'word' : 'mean'));
    if (p[0] === 'g') return qGram(GMAP[p[1]], Math.random() < 0.5 ? 'mean' : (Math.random() < 0.5 ? 'ptn' : 'ex'));
    if (p[0] === 'k') return qKanji(p[1], Math.random() < 0.5 ? 'word' : 'mean');
    return null;
  }

  /* ───────── 畫面切換 ───────── */
  var VIEWS = { today: '#v-today', run: '#v-run', review: '#v-review', course: '#v-course', set: '#v-set' };
  var cur = 'today';
  function show(name) {
    stopSay(); stopTimer();
    cur = name;
    for (var k in VIEWS) { var n = $(VIEWS[k]); if (n) n.hidden = (k !== name); }
    $$('.tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === name); });
    var m = document.querySelector('main'); if (m) m.scrollTop = 0;
    if (name === 'today') renderToday();
    if (name === 'review') renderReview();
    if (name === 'course') renderCourse();
    if (name === 'set') renderSet();
  }
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-view')); });
  });

  /* ───────── 計時器 ───────── */
  var tState = null;
  function startTimer(mins, node) {
    stopTimer();
    tState = { left: mins * 60, node: node, iv: null, paused: false };
    paintTimer();
    tState.iv = setInterval(function () {
      if (!tState || tState.paused) return;
      tState.left--; paintTimer();
      if (tState.left <= 0) { tState.left = 0; }
    }, 1000);
  }
  function paintTimer() {
    if (!tState || !tState.node) return;
    var s = Math.max(0, tState.left), m = Math.floor(s / 60);
    tState.node.textContent = (tState.paused ? '‖ ' : '') + m + ':' + String(s % 60).padStart(2, '0');
    tState.node.classList.toggle('low', s <= 60);
  }
  function stopTimer() { if (tState && tState.iv) clearInterval(tState.iv); tState = null; }

  /* ───────── 今日 ───────── */
  function renderHeader() {
    var p = planFor(S.day);
    $('#dayLabel').textContent = 'Day ' + p.day;
    var wk = Math.ceil(p.day / 7);
    $('#weekLabel').textContent = '第 ' + wk + ' 週・' + (p.review ? '復習日' : p.blocks[2].t + '日');
    $('#streakN').textContent = streak();
    var dd = dueIds().length;
    var dot = $('#dueDot'); if (dot) dot.hidden = dd === 0;
  }
  function renderToday() {
    renderHeader();
    var p = planFor(S.day), done = doneList(p.day);
    var list = $('#blockList'); list.innerHTML = '';
    var total = p.blocks.reduce(function (a, b) { return a + b.m; }, 0);
    $('#menuNote').textContent = total + ' 分・' + (p.review ? '復習日' : '通常日');
    var firstOpen = -1;
    p.blocks.forEach(function (b, i) {
      var isDone = done.indexOf(b.k + i) >= 0;
      if (!isDone && firstOpen < 0) firstOpen = i;
      var btn = el('button', { 'class': 'blk' + (isDone ? ' done' : '') }, [
        el('span', { 'class': 'no', text: isDone ? '✓' : String(i + 1) }),
        el('span', { 'class': 'bt' }, [
          el('i', { 'class': 'ja', text: b.t }),
          el('small', { text: b.s || '' })
        ]),
        el('span', { 'class': 'mins tnum', text: b.m + '分' })
      ]);
      btn.addEventListener('click', function () { runBlock(i); });
      list.appendChild(btn);
    });
    if (firstOpen >= 0) list.children[firstOpen].classList.add('cur');
    var pct = Math.round(done.length / p.blocks.length * 100);
    $('#dayBar').style.width = pct + '%';
    $('#startBtn').textContent = firstOpen < 0 ? '今天已完成 → 預習下一天' : (done.length ? '繼續第 ' + (firstOpen + 1) + ' 區塊' : 'セッションを始める');
    $('#startBtn').onclick = function () { runBlock(firstOpen < 0 ? 0 : firstOpen); };

    $('#kDay').textContent = p.day;
    $('#kDue').textContent = dueIds().length;
    $('#kLeft').textContent = S.examDate ? Math.max(0, diffDays(TODAY, S.examDate)) : '—';
    $('#sVocab').textContent = countBy('v') + ' / ' + VW.length;
    $('#sGram').textContent = countBy('g') + ' / ' + G.length;
    $('#sKanji').textContent = countBy('k') + ' / ' + KC.length;
    var tot = S.stats.ok + S.stats.ng;
    $('#sAcc').textContent = tot ? Math.round(S.stats.ok / tot * 100) + '%（' + tot + ' 題）' : '—';
  }

  /* ───────── 複習頁 ───────── */
  function renderReview() {
    renderHeader();
    var due = dueIds();
    $('#rDue').textContent = due.length;
    $('#rTotal').textContent = Object.keys(S.srs).length;
    var weak = Object.keys(S.srs).filter(function (k) { return (S.srs[k].b || 0) <= 1; });
    $('#rWeak').textContent = weak.length;
    $('#reviewBtn').disabled = due.length === 0;
    $('#reviewBtn').textContent = due.length ? '開始複習（' + due.length + ' 張）' : '今天沒有到期卡片';
    $('#reviewBtn').onclick = function () { runQueue(shuffle(due).slice(0, 40), '復習', 12, false); };
    $('#aheadBtn').onclick = function () {
      var all = Object.keys(S.srs).sort(function (a, b) { return S.srs[a].d < S.srs[b].d ? -1 : 1; }).slice(0, 20);
      if (!all.length) return;
      runQueue(all, '提前復習', 10, true);
    };
    var wl = $('#weakList'); wl.innerHTML = '';
    var lapsed = Object.keys(S.srs).filter(function (k) { return (S.srs[k].l || 0) >= 2; })
      .sort(function (a, b) { return (S.srs[b].l || 0) - (S.srs[a].l || 0); }).slice(0, 40);
    if (!lapsed.length) { wl.appendChild(tx('div', 'empty', '還沒有累積錯誤記錄。')); return; }
    var box = el('div', { 'class': 'res' });
    lapsed.forEach(function (id) {
      var info = describe(id); if (!info) return;
      box.appendChild(el('div', { 'class': 'ritem' }, [
        tx('span', 'rw ja', info.w), tx('span', 'rr', info.r || ''),
        tx('span', 'rm', info.m + '　✕' + S.srs[id].l)
      ]));
    });
    wl.appendChild(box);
  }
  function describe(id) {
    var p = id.split(':');
    if (p[0] === 'v') { var w = V[p[1]] && V[p[1]].v[p[2]]; return w ? { w: w.w, r: w.r, m: w.m } : null; }
    if (p[0] === 'g') { var g = GMAP[p[1]]; return g ? { w: g.p, r: '', m: g.m } : null; }
    if (p[0] === 'k') { var x = KMAP[p[1]]; return x ? { w: x.k.k, r: x.k.on, m: x.k.m } : null; }
    return null;
  }

  /* ───────── 課程頁 ───────── */
  function renderCourse() {
    renderHeader();
    var host = $('#courseList'); host.innerHTML = '';
    for (var w = 1; w <= 12; w++) {
      (function (w) {
        var d1 = (w - 1) * 7 + 1, d7 = w * 7;
        var doneN = 0; for (var d = d1; d <= d7; d++) { var pl = planFor(d); if (doneList(d).length >= pl.blocks.length) doneN++; }
        var det = el('details', { 'class': 'wk' });
        if (S.day >= d1 && S.day <= d7) det.open = true;
        var sum = el('summary', null, [
          tx('span', 'wn', '第 ' + w + ' 週'),
          tx('span', 'sp', ''),
          tx('span', 'pill' + (doneN === 7 ? ' on' : ''), doneN + '/7 日')
        ]);
        det.appendChild(sum);
        var days = el('div', { 'class': 'days' });
        for (var d = d1; d <= d7; d++) {
          var pl = planFor(d), fin = doneList(d).length >= pl.blocks.length;
          var row = el('div', { 'class': 'dayrow' + (d === S.day ? ' is-now' : '') + (fin ? ' is-done' : '') }, [
            tx('span', 'dn tnum', (fin ? '✓ ' : '') + 'Day ' + d),
            el('span', { 'class': 'dc' }, [
              el('b', { text: pl.blocks.map(function (b) { return b.t; }).join('・') }),
              el('small', { text: pl.blocks.map(function (b) { return b.s; }).filter(Boolean).join('｜') })
            ])
          ]);
          days.appendChild(row);
        }
        det.appendChild(days);
        host.appendChild(det);
      })(w);
    }
    var qi = $('#q');
    qi.oninput = function () { doSearch(qi.value.trim()); };
    doSearch(qi.value.trim());
  }
  function doSearch(s) {
    var host = $('#qres'); host.innerHTML = '';
    if (!s) { host.appendChild(tx('div', 'empty', '可查 576 單字、100 文法、144 漢字。')); return; }
    var hit = [];
    VW.forEach(function (x) {
      if (x.w.w.indexOf(s) >= 0 || x.w.r.indexOf(s) >= 0 || x.w.m.indexOf(s) >= 0)
        hit.push({ w: x.w.w, r: x.w.r, m: x.w.m, k: '語' });
    });
    G.forEach(function (g) {
      if (g.p.indexOf(s) >= 0 || g.m.indexOf(s) >= 0 || g.f.indexOf(s) >= 0)
        hit.push({ w: g.p, r: '', m: g.m, k: '文' });
    });
    KC.forEach(function (x) {
      var inWords = (x.k.w || []).some(function (y) { return y.w.indexOf(s) >= 0 || y.r.indexOf(s) >= 0 || y.m.indexOf(s) >= 0; });
      if (x.k.k === s || x.k.m.indexOf(s) >= 0 || inWords)
        hit.push({ w: x.k.k, r: x.k.on, m: x.k.m, k: '漢' });
    });
    if (!hit.length) { host.appendChild(tx('div', 'empty', '沒有符合的項目。')); return; }
    var box = el('div', { 'class': 'res' });
    hit.slice(0, 40).forEach(function (h) {
      var row = el('div', { 'class': 'ritem' }, [
        tx('span', 'rw ja', h.w), tx('span', 'rr', h.r), tx('span', 'rm', '［' + h.k + '］' + h.m)
      ]);
      row.appendChild(spkBtn(h.w));
      box.appendChild(row);
    });
    host.appendChild(box);
    if (hit.length > 40) host.appendChild(tx('div', 'empty', '共 ' + hit.length + ' 筆，僅顯示前 40 筆。'));
  }

  /* ───────── 設定頁 ───────── */
  function renderSet() {
    renderHeader();
    var ed = $('#examDate'); ed.value = S.examDate || '';
    ed.onchange = function () { S.examDate = ed.value; save(); renderHeader(); };
    $$('[data-rate]').forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-rate')) === Number(S.set.rate));
      b.onclick = function () { S.set.rate = Number(b.getAttribute('data-rate')); save(); renderSet(); };
    });
    $('#testVoice').onclick = function () {
      if (!say('日本語の勉強を続けます。')) alert_('此裝置不支援語音朗讀。');
    };
    $$('[data-theme]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme') === (S.set.theme || 'auto'));
      b.onclick = function () { S.set.theme = b.getAttribute('data-theme'); applyTheme(); save(); renderSet(); };
    });
    $('#backDay').onclick = function () { if (S.day > 1) { S.day--; save(); show('today'); } };
    $('#skipDay').onclick = function () { if (S.day < DAYS) { S.day++; save(); show('today'); } };
    $('#resetAll').onclick = function () { $('#resetConfirm').hidden = false; };
    $('#resetNo').onclick = function () { $('#resetConfirm').hidden = true; };
    $('#resetYes').onclick = function () {
      var keepExam = S.examDate, keepSet = S.set;
      S = normalize(null); S.examDate = keepExam; S.set = keepSet;
      save(); $('#resetConfirm').hidden = true; show('today');
    };
    bindBackup();
    loadVoices();
  }
  /* 備份：以 JSON 文字交換，不依賴檔案下載（在受限環境中也能用） */
  function bindBackup() {
    var out = $('#bkOut'), inn = $('#bkIn'), box = $('#bkBox'), msg = $('#bkMsg');
    if (!out || !inn || !box || !msg) return;
    out.onclick = function () {
      box.hidden = false;
      box.value = JSON.stringify(S);
      msg.textContent = '已產生。全選複製後存到記事本或雲端筆記。';
      try { box.focus(); box.select(); } catch (e) { }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(box.value).then(function () {
          msg.textContent = '已複製到剪貼簿（也可從下面框內手動複製）。';
        })['catch'](function () { });
      }
    };
    inn.onclick = function () {
      if (box.hidden) {
        box.hidden = false; box.value = '';
        msg.textContent = '把備份碼貼進框裡，再按一次這個按鈕。';
        try { box.focus(); } catch (e) { }
        return;
      }
      var t = (box.value || '').trim();
      if (!t) { msg.textContent = '框裡是空的，請先貼上備份碼。'; return; }
      var o;
      try { o = JSON.parse(t); } catch (e) { msg.textContent = '格式不對：請確認貼上的是完整的備份碼。'; return; }
      if (!o || typeof o !== 'object' || !o.srs) { msg.textContent = '這不是本站的備份碼。'; return; }
      S = normalize(o); save(); applyTheme();
      msg.textContent = '已還原：Day ' + S.day + '、' + Object.keys(S.srs).length + ' 張卡片。';
      renderHeader();
    };
  }
  function alert_(msg) {
    var n = $('#voiceNote'); if (n) n.textContent = msg;
  }
  function applyTheme() {
    var t = S.set.theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  /* ───────── 區塊執行 ───────── */
  function runBlock(i) {
    var p = planFor(S.day), b = p.blocks[i];
    if (!b) { show('today'); return; }
    var ctx = { plan: p, idx: i, blk: b, key: b.k + i };
    if (b.k === 'vocab') flowVocab(ctx);
    else if (b.k === 'gram') flowGram(ctx);
    else if (b.k === 'kanji') flowKanji(ctx);
    else if (b.k === 'read') flowRead(ctx);
    else if (b.k === 'listen') flowListen(ctx);
    else if (b.k === 'srs') flowSrs(ctx);
    else if (b.k === 'mock') flowMock(ctx);
  }

  function shell(ctx, title, sub) {
    var host = $('#v-run'); host.innerHTML = '';
    var timer = tx('span', 'timer tnum', '—:—');
    var head = el('div', { 'class': 'card' }, [
      el('div', { 'class': 'studyhead' }, [
        el('button', { 'class': 'chip', text: '‹ 返回', on: { click: function () { show('today'); } } }),
        el('span', { 'class': 't' }, [el('b', { 'class': 'ja', text: title }), document.createTextNode(sub ? '　' + sub : '')]),
        timer
      ]),
      el('div', { 'class': 'dots', id: 'dots', style: 'margin-top:10px' })
    ]);
    timer.addEventListener('click', function () { if (tState) { tState.paused = !tState.paused; paintTimer(); } });
    host.appendChild(head);
    var body = el('div', { id: 'runBody', style: 'display:flex;flex-direction:column;gap:12px' });
    host.appendChild(body);
    show('run');
    startTimer(ctx.blk.m, timer);
    return body;
  }
  function dots(n, states) {
    var d = $('#dots'); if (!d) return;
    d.innerHTML = '';
    for (var i = 0; i < n; i++) d.appendChild(el('i', { 'class': states && states[i] ? states[i] : '' }));
  }
  function finish(ctx, summary) {
    stopSay(); stopTimer();
    markDone(ctx.plan.day, ctx.key, ctx.blk.m);
    var body = $('#runBody'); if (!body) { show('today'); return; }
    body.innerHTML = '';
    var next = ctx.idx + 1 < ctx.plan.blocks.length ? ctx.plan.blocks[ctx.idx + 1] : null;
    body.appendChild(el('div', { 'class': 'card ctr' }, [
      tx('div', 'mark o', '◯'),
      el('h2', { 'class': 'ja', style: 'margin-top:6px', text: ctx.blk.t + '　完了' }),
      tx('p', '', summary || '')
    ]));
    if (next) {
      var nb = el('button', { 'class': 'btn', text: '下一區塊：' + next.t + '（' + next.m + '分）' });
      nb.addEventListener('click', function () { runBlock(ctx.idx + 1); });
      body.appendChild(nb);
    } else {
      body.appendChild(el('div', { 'class': 'card ctr' }, [
        tx('div', 'eyebrow', 'day ' + ctx.plan.day + ' complete'),
        tx('h2', 'ja', '今日の 40 分、終わりました。'),
        tx('p', '', '明天從 Day ' + Math.min(DAYS, ctx.plan.day + 1) + ' 開始。')
      ]));
    }
    body.appendChild(el('button', { 'class': 'btn quiet', text: '回到今日', on: { click: function () { show('today'); } } }));
  }

  /* 通用：題目序列 */
  function quizRunner(ctx, qs, title, onEnd, noGrade) {
    var i = 0, ok = 0, st = [];
    var body = $('#runBody');
    function render() {
      stopSay();
      body.innerHTML = '';
      dots(qs.length, st);
      if (i >= qs.length) { onEnd(ok, qs.length); return; }
      var q = qs[i];
      var head = el('div', { 'class': 'card' }, [
        el('div', { 'class': 'eyebrow', text: title + '　' + (i + 1) + ' / ' + qs.length })
      ]);
      var qn = el('div', { 'class': 'q', style: 'margin-top:6px' });
      qn.appendChild(document.createTextNode(q.h));
      if (q.big) {
        var bl = el('span', { 'class': 'big ja', text: q.big });
        qn.appendChild(bl);
        if (q.sub) qn.appendChild(tx('span', 'read', q.sub));
      }
      if (q.sent) qn.appendChild(el('div', { 'class': 'sent', style: 'margin-top:6px', text: q.sent }));
      head.appendChild(qn);
      if (q.say && canSpeak) {
        var row = el('div', { style: 'margin-top:8px;display:flex;gap:8px;align-items:center' }, [spkBtn(q.say), tx('small', '', '點擊聽發音')]);
        head.appendChild(row);
      }
      body.appendChild(head);

      var opts = el('div', { 'class': 'opts' });
      var btns = [];
      q.opts.forEach(function (o, n) {
        var b = el('button', { 'class': 'opt' }, [
          el('span', { 'class': 'n', text: String(n + 1) }),
          el('span', { 'class': q.zh ? 'tx' : 'tx ja', text: o })
        ]);
        if (q.zh) b.querySelector('.tx').style.fontFamily = 'var(--f-ui)';
        if (q.kana) b.querySelector('.tx').style.letterSpacing = '.06em';
        b.addEventListener('click', function () { answer(n); });
        btns.push(b); opts.appendChild(b);
      });
      body.appendChild(opts);

      function answer(n) {
        var right = n === q.c;
        btns.forEach(function (b, idx) {
          b.disabled = true;
          if (idx === q.c) b.classList.add('ok');
          else if (idx === n) b.classList.add('ng');
        });
        if (right) ok++;
        st[i] = right ? 'ok' : 'ng';
        dots(qs.length, st);
        if (!noGrade) grade(q.id, right);
        var fb = el('div', { 'class': 'fb ' + (right ? 'ok' : 'ng') }, [
          tx('span', 'mark ' + (right ? 'o' : 'x'), right ? '◯' : '✕'),
          el('span', { 'class': 'tx' }, [
            el('b', { text: right ? '正解' : '不正解' }),
            el('span', { style: 'white-space:pre-wrap', text: q.ex || '' })
          ])
        ]);
        body.appendChild(fb);
        if (q.say) say(q.say);
        var nx = el('button', { 'class': 'btn', style: 'margin-top:4px', text: i + 1 >= qs.length ? '結果を見る' : '次へ' });
        nx.addEventListener('click', function () { i++; render(); });
        body.appendChild(nx);
        nx.focus();
      }
    }
    render();
  }

  /* 通用：學習卡序列 → 測驗 */
  function studyRunner(ctx, cards, title, afterStudy) {
    var i = 0, body = $('#runBody');
    function render() {
      stopSay();
      body.innerHTML = '';
      var states = []; for (var n = 0; n < cards.length; n++) states[n] = n < i ? 'ok' : (n === i ? 'on' : '');
      dots(cards.length, states);
      body.appendChild(el('div', { 'class': 'card' }, [el('div', { 'class': 'eyebrow', text: title + '　' + (i + 1) + ' / ' + cards.length })]));
      body.appendChild(cards[i]());
      var nx = el('button', { 'class': 'btn', text: i + 1 >= cards.length ? '確認テストへ' : '次へ' });
      nx.addEventListener('click', function () { i++; if (i >= cards.length) afterStudy(); else render(); });
      body.appendChild(nx);
    }
    render();
  }

  /* ── 語彙區塊 ── */
  function flowVocab(ctx) {
    var gi = ctx.blk.vi, grp = V[gi];
    shell(ctx, '語彙', grp.t);
    var cards = grp.v.map(function (w, wi) {
      return function () {
        var c = el('div', { 'class': 'card ctr' }, [
          el('div', { 'class': 'word', text: w.w }),
          el('div', { 'class': 'read', text: w.r }),
          el('div', { 'class': 'mean', text: w.m }),
          el('div', { style: 'margin-top:8px', html: '' })
        ]);
        c.lastChild.appendChild(tx('span', 'pos', w.p || ''));
        if (canSpeak) c.appendChild(el('div', { style: 'margin-top:12px;display:flex;justify-content:center' }, [spkBtn(w.w)]));
        seed('v:' + gi + ':' + wi);
        return c;
      };
    });
    studyRunner(ctx, cards, '新しい語', function () {
      save();
      var qs = [];
      grp.v.forEach(function (w, wi) {
        qs.push(qVocab(gi, wi, hasKanji(w.w) && Math.random() < 0.5 ? 'read' : 'mean'));
      });
      grp.v.forEach(function (w, wi) { if (Math.random() < 0.5) qs.push(qVocab(gi, wi, 'word')); });
      qs = shuffle(qs.filter(Boolean));
      quizRunner(ctx, qs, '語彙テスト', function (ok, n) {
        finish(ctx, '語彙 ' + grp.t + '：' + ok + ' / ' + n + ' 正解。8 個新字已進入複習排程。');
      });
    });
  }

  /* ── 文法區塊 ── */
  function flowGram(ctx) {
    var pts = G.slice(ctx.blk.ga, ctx.blk.gb);
    if (!pts.length) pts = [G[0]];
    shell(ctx, '文法', pts.map(function (p) { return p.p; }).join('／'));
    var cards = pts.map(function (g) {
      return function () {
        var c = el('div', { 'class': 'card' }, [
          el('div', { 'class': 'ptn ja', text: g.p }),
          el('div', { 'class': 'rule' }),
          el('div', { 'class': 'meta' }, [
            el('div', null, [tx('dt', '', '接續'), el('dd', { 'class': 'ja', text: g.f })]),
            el('div', null, [tx('dt', '', '中文'), el('dd', null, [document.createTextNode(g.m)])])
          ]),
          el('div', { 'class': 'hint', style: 'margin-top:10px' }, [
            el('b', { text: '重點：' }), document.createTextNode(g.n)
          ])
        ]);
        var exbox = el('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:10px' });
        (g.ex || []).forEach(function (e) {
          var row = el('div', { 'class': 'exrow' }, [
            el('div', { 'class': 'ex' }, [tx('div', 'j', e.j), tx('div', 'z', e.z)])
          ]);
          if (canSpeak) row.appendChild(spkBtn(e.j));
          exbox.appendChild(row);
        });
        c.appendChild(exbox);
        seed('g:' + g.id);
        return c;
      };
    });
    studyRunner(ctx, cards, '文法項目', function () {
      save();
      var qs = [];
      pts.forEach(function (g) {
        qs.push(qGram(g, 'ptn')); qs.push(qGram(g, 'mean')); qs.push(qGram(g, 'ex'));
      });
      var extra = dueIds().filter(function (k) { return k.charAt(0) === 'g'; }).slice(0, 3).map(qForId);
      qs = shuffle(qs.concat(extra).filter(Boolean));
      quizRunner(ctx, qs, '文法テスト', function (ok, n) {
        finish(ctx, '文法：' + ok + ' / ' + n + ' 正解。今日の項目＝' + pts.map(function (g) { return g.p; }).join('、'));
      });
    });
  }

  /* ── 漢字區塊 ── */
  function flowKanji(ctx) {
    var kis = ctx.blk.kis || [0];
    var chars = [], label = kis.map(function (i) { return K[i].t; }).join('・');
    kis.forEach(function (i) { K[i].v.forEach(function (k) { chars.push(k); }); });
    shell(ctx, '漢字', label);
    var cards = chars.map(function (k) {
      return function () {
        var c = el('div', { 'class': 'card ctr' }, [
          el('div', { 'class': 'kanjibig', text: k.k }),
          el('div', { 'class': 'rule' }),
          el('div', { 'class': 'meta', style: 'text-align:left' }, [
            el('div', null, [tx('dt', '', '音'), el('dd', { 'class': 'ja', text: k.on })]),
            el('div', null, [tx('dt', '', '訓'), el('dd', { 'class': 'ja', text: k.kun })]),
            el('div', null, [tx('dt', '', '中文'), el('dd', { text: k.m })])
          ])
        ]);
        var ws = el('div', { 'class': 'kwords', style: 'margin-top:12px' });
        (k.w || []).forEach(function (w) {
          var box = el('div', { 'class': 'kw' }, [
            el('b', { text: w.w }), el('small', { text: w.r }), el('span', { text: w.m })
          ]);
          box.addEventListener('click', function () { say(w.w); });
          ws.appendChild(box);
        });
        c.appendChild(ws);
        seed('k:' + k.k);
        return c;
      };
    });
    studyRunner(ctx, cards, '漢字', function () {
      save();
      var qs = [];
      chars.forEach(function (k) { qs.push(qKanji(k.k, 'mean')); qs.push(qKanji(k.k, 'word')); });
      qs = shuffle(qs.filter(Boolean));
      quizRunner(ctx, qs, '漢字テスト', function (ok, n) {
        finish(ctx, '漢字 ' + label + '：' + ok + ' / ' + n + ' 正解。');
      });
    });
  }

  /* ── 読解區塊 ── */
  function flowRead(ctx) {
    var p = R[ctx.blk.ri];
    shell(ctx, '読解', p.k + '・' + p.ti);
    var body = $('#runBody');
    dots(1 + p.q.length, ['on']);
    body.innerHTML = '';
    var card = el('div', { 'class': 'card' }, [
      el('div', { 'class': 'eyebrow', text: p.k }),
      el('h2', { 'class': 'ja', style: 'margin:4px 0 10px', text: p.ti }),
      el('div', { 'class': 'passage' + (p.tab ? ' tab' : ''), text: p.b })
    ]);
    if (canSpeak && !p.tab) {
      card.appendChild(el('div', { style: 'margin-top:12px;display:flex;gap:8px;align-items:center' }, [
        spkBtn(p.b.replace(/\n+/g, '。')), tx('small', '', '可邊聽邊讀，練習跟讀')
      ]));
    }
    body.appendChild(card);
    body.appendChild(el('p', { style: 'font-size:12px;color:var(--ink-3)', text: '建議先限時 3 分鐘讀完，再作答。' }));
    var go = el('button', { 'class': 'btn', text: '問題へ（' + p.q.length + ' 題）' });
    go.addEventListener('click', function () {
      var qs = p.q.map(function (q, n) {
        var o = q.a.slice();
        return { id: null, h: q.q, opts: o, c: q.c, ex: q.e, zh: true, keepOrder: true };
      });
      quizRunner(ctx, qs, '読解問題', function (ok, n) {
        finish(ctx, '読解「' + p.ti + '」：' + ok + ' / ' + n + ' 正解。看不懂的句子回頭圈出來，是最有效的複習。');
      }, true);
    });
    body.appendChild(go);
  }

  /* ── 聴解區塊 ── */
  function flowListen(ctx) {
    var it = L[ctx.blk.li];
    shell(ctx, '聴解', it.ti);
    var body = $('#runBody');
    body.innerHTML = '';
    dots(3, ['on']);
    var lines = it.sc.map(function (x) { return x.t; });
    var played = 0;
    var card = el('div', { 'class': 'card' }, [
      el('div', { 'class': 'eyebrow', text: canSpeak ? 'listening' : 'script mode' }),
      el('h2', { 'class': 'ja', style: 'margin:4px 0 10px', text: it.ti })
    ]);
    if (canSpeak) {
      var lbl = tx('span', 'lbl', '先聽兩次，不要看稿');
      var pb = el('button', { 'class': 'playbig', 'aria-label': '播放', text: '▶' });
      pb.addEventListener('click', function () {
        played++; lbl.textContent = '播放中…（第 ' + played + ' 次）'; pb.textContent = '■';
        saySeq(lines, 0, function () { pb.textContent = '▶'; lbl.textContent = played >= 2 ? '聽夠了就作答' : '再聽一次也可以'; });
      });
      card.appendChild(el('div', { 'class': 'audio' }, [pb, lbl]));
      card.appendChild(el('div', { 'class': 'cover', style: 'margin-top:10px', text: '會話稿會在作答後顯示' }));
    } else {
      card.appendChild(el('div', { 'class': 'cover', text: '此裝置沒有日文語音，改為讀稿模式' }));
      card.appendChild(scriptBox(it));
    }
    body.appendChild(card);
    var go = el('button', { 'class': 'btn', text: '問題へ' });
    go.addEventListener('click', function () {
      stopSay();
      var qs = [{ id: null, h: it.q, opts: it.a.slice(), c: it.c, ex: it.e, zh: true }];
      quizRunner(ctx, qs, '聴解問題', function (ok, n) {
        var b = $('#runBody'); b.innerHTML = '';
        b.appendChild(el('div', { 'class': 'card' }, [
          el('div', { 'class': 'eyebrow', text: 'script' }),
          el('h2', { 'class': 'ja', style: 'margin:4px 0 10px', text: it.ti }),
          scriptBox(it),
          el('div', { 'class': 'rule' }),
          el('div', { style: 'font-size:13px;color:var(--ink-2)', text: it.tr })
        ]));
        if (canSpeak) b.appendChild(el('button', {
          'class': 'btn ghost', text: '跟讀一次（句句暫停）',
          on: { click: function () { saySeq(lines, 0); } }
        }));
        b.appendChild(el('button', {
          'class': 'btn', text: '完成', on: {
            click: function () { finish(ctx, '聴解「' + it.ti + '」：' + ok + ' / ' + n + ' 正解。'); }
          }
        }));
      }, true);
    });
    body.appendChild(go);
  }
  function scriptBox(it) {
    var box = el('div', { 'class': 'script' });
    it.sc.forEach(function (x) {
      var row = el('div', { 'class': 'line' }, [tx('span', 'sp', x.s), tx('span', 'tt', x.t)]);
      if (canSpeak) row.appendChild(spkBtn(x.t));
      box.appendChild(row);
    });
    return box;
  }

  /* ── 復習（SRS）區塊 ── */
  function flowSrs(ctx) {
    var due = shuffle(dueIds());
    shell(ctx, ctx.blk.t, due.length + ' 張到期');
    var body = $('#runBody');
    if (!due.length) {
      body.innerHTML = '';
      body.appendChild(el('div', { 'class': 'card ctr' }, [
        tx('div', 'eyebrow', 'nothing due'),
        tx('h2', 'ja', '今日は復習なし'),
        tx('p', '', '間隔複習排程裡今天沒有到期的卡片。可以提前複習最接近到期的 15 張，但不會改變原本的到期日。')
      ]));
      var all = Object.keys(S.srs).sort(function (a, b) { return S.srs[a].d < S.srs[b].d ? -1 : 1; }).slice(0, 15);
      if (all.length) {
        body.appendChild(el('button', {
          'class': 'btn ghost', text: '提前複習 ' + all.length + ' 張', on: {
            click: function () {
              var qs = all.map(qForId).filter(Boolean);
              quizRunner(ctx, qs, '提前復習', function (ok, n) { finish(ctx, '提前復習：' + ok + ' / ' + n + '。到期日未變動。'); }, true);
            }
          }
        }));
      }
      body.appendChild(el('button', { 'class': 'btn', text: '完成這個區塊', on: { click: function () { finish(ctx, '今天沒有到期卡片，區塊記為完成。'); } } }));
      return;
    }
    var limit = ctx.blk.m >= 12 ? 24 : 18;
    var qs = due.slice(0, limit).map(qForId).filter(Boolean);
    quizRunner(ctx, qs, '復習', function (ok, n) {
      var left = Math.max(0, due.length - qs.length);
      finish(ctx, '複習：' + ok + ' / ' + n + ' 正解。' + (left ? '還有 ' + left + ' 張到期，可在「複習」頁繼續。' : '到期卡片全部清空。'));
    });
  }

  /* ── 自由複習（不屬於今日區塊） ── */
  function runQueue(ids, title, mins, noGrade) {
    var qs = ids.map(qForId).filter(Boolean);
    if (!qs.length) { show('review'); return; }
    var ctx = { plan: planFor(S.day), idx: -1, blk: { k: 'free', t: title, m: mins, s: qs.length + ' 張' }, key: null };
    shell(ctx, title, qs.length + ' 張');
    quizRunner(ctx, qs, title, function (ok, n) {
      stopTimer();
      var b = $('#runBody'); b.innerHTML = '';
      b.appendChild(el('div', { 'class': 'card ctr' }, [
        tx('div', 'mark o', '◯'),
        el('h2', { 'class': 'ja', style: 'margin-top:6px', text: title + '　' + ok + ' / ' + n }),
        tx('p', '', noGrade ? '到期日未變動，只是先看一遍。' : '答錯的卡片已退回第 1 階。')
      ]));
      b.appendChild(el('button', { 'class': 'btn', text: '回到複習頁', on: { click: function () { show('review'); } } }));
    }, noGrade);
  }

  /* ── 模擬測驗 ── */
  function flowMock(ctx) {
    var pool = Object.keys(S.srs);
    shell(ctx, 'ミニ模試', '20 題・語彙／文法／漢字');
    var body = $('#runBody');
    if (pool.length < 10) {
      body.innerHTML = '';
      body.appendChild(el('div', { 'class': 'card ctr' }, [
        tx('h2', 'ja', '学習量が足りません'),
        tx('p', '', '模擬測驗會從你學過的內容出題。先完成幾天的語彙與文法區塊再回來。')
      ]));
      body.appendChild(el('button', { 'class': 'btn', text: '回到今日', on: { click: function () { show('today'); } } }));
      return;
    }
    var ids = shuffle(pool.slice()).slice(0, 20);
    var qs = ids.map(qForId).filter(Boolean);
    quizRunner(ctx, qs, '模試', function (ok, n) {
      var pct = Math.round(ok / n * 100);
      var b = $('#runBody'); b.innerHTML = '';
      b.appendChild(el('div', { 'class': 'card ctr' }, [
        tx('div', 'eyebrow', 'mini mock'),
        el('div', { 'class': 'word', style: 'color:var(--shu)', text: '◯ ' + ok + ' / ' + n }),
        tx('div', 'mean', pct >= 80 ? 'この調子で進めば N3 のラインは見えます。' : (pct >= 60 ? 'あと一歩。弱点リストを先に潰しましょう。' : '範囲を広げる前に、復習を優先してください。')),
        el('div', { 'class': 'rule' }),
        el('div', { style: 'font-size:13px;color:var(--ink-2);text-align:left', text: '答錯的卡片已退回第 1 階，明天會再出現。「複習」頁的弱點清單依錯誤次數排序。' })
      ]));
      b.appendChild(el('button', { 'class': 'btn', text: '完成', on: { click: function () { finish(ctx, '模試：' + ok + ' / ' + n + '（' + pct + '%）'); } } }));
    });
  }

  /* ───────── 遠端同步 ───────── */
  function connect() {
    if (!window.claude || typeof window.claude.use !== 'function') { setSync('本機儲存'); return; }
    Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (res) {
      db = res[0];
      var user = res[1];
      if (!db || !user) { setSync('本機儲存'); return; }
      return user.id().then(function (id) {
        if (!id) { db = null; setSync('本機儲存'); return; }
        uid = id;
        setSync('同步中…');
        return db.doc('progress/' + uid).get().then(function (snap) {
          var remote = snap && snap.exists ? snap.data() : null;
          if (remote && Number(remote.u || 0) > Number(S.u || 0)) {
            S = normalize(remote);
            try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { }
            applyTheme(); show(cur === 'run' ? 'today' : cur);
            setSync('已同步', 'on');
          } else {
            setSync('已同步', 'on');
            push();
          }
        });
      });
    })['catch'](function () { db = null; setSync('本機儲存'); });
  }

  /* ───────── 啟動 ───────── */
  applyTheme();
  show('today');
  connect();
})();

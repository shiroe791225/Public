/* 五十音 稽古帖 — 字表 / 16 課 / 七種題型 / 間隔複習 */
(function () {
  'use strict';

  var KA = window.KANA || [], KD = window.KANA_D || [], KY = window.KANA_Y || [];
  var CF = window.CONFUSE || [], LW = window.LOANWORDS || [], RU = window.RULES || [], LS_ = window.LESSONS || [];

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  if (!KA.length || !LS_.length) {
    var t = $('#v-table');
    if (t) t.innerHTML = '<div class="card"><h2>內容檔沒有載入</h2><p style="margin-top:8px;font-size:13px">' +
      'data/kana.js 與 data/lessons.js 必須和本頁一起發佈。</p></div>';
    return;
  }

  /* 集合與索引 */
  KA.forEach(function (x) { x.set = 'sei'; });
  KD.forEach(function (x) { x.set = 'daku'; });
  KY.forEach(function (x) { x.set = 'yo'; });
  var ALL = KA.concat(KD, KY);
  var BY_H = {}, BY_K = {};
  ALL.forEach(function (x) { BY_H[x.h] = x; BY_K[x.k] = x; });
  /* 同音標記（じ/ぢ、ず/づ、お/を）：這些不能用在「由音選字」題型 */
  var rc = {};
  ALL.forEach(function (x) { rc[x.r] = (rc[x.r] || 0) + 1; });
  ALL.forEach(function (x) { x.amb = rc[x.r] > 1; });

  /* 濁音的母體 */
  var DAKU_BASE = 'かきくけこさしすせそたちつてとはひふへほはひふへほ';
  KD.forEach(function (x, i) { x.base = DAKU_BASE.charAt(i); x.han = i >= 20; });

  var ROWS = {
    sei: { cols: ['a', 'i', 'u', 'e', 'o'], rows: ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'ん'] },
    daku: { cols: ['a', 'i', 'u', 'e', 'o'], rows: ['が', 'ざ', 'だ', 'ば', 'ぱ'] },
    yo: { cols: ['a', 'u', 'o'], rows: ['きゃ', 'しゃ', 'ちゃ', 'にゃ', 'ひゃ', 'みゃ', 'りゃ', 'ぎゃ', 'じゃ', 'びゃ', 'ぴゃ'] }
  };
  function setOf(name) { return name === 'sei' ? KA : (name === 'daku' ? KD : KY); }

  /* ───────── 日期 ───────── */
  function dstr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return dstr(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  var TODAY = dstr(new Date());

  /* ───────── 狀態 ───────── */
  var LSK = 'kanadojo.v1';
  var DEF = { v: 1, u: 0, srs: {}, les: {}, stats: { ok: 0, ng: 0 }, set: { rate: 0.8, theme: 'auto', mode: 'h2r', range: 'sei', n: 10, script: 'h', grid: 'sei' } };
  var S = JSON.parse(JSON.stringify(DEF));
  function normalize(x) {
    var s = JSON.parse(JSON.stringify(DEF));
    if (x) {
      s.srs = x.srs || {}; s.les = x.les || {};
      s.stats = Object.assign({ ok: 0, ng: 0 }, x.stats || {});
      s.set = Object.assign(s.set, x.set || {});
      s.u = Number(x.u) || 0;
    }
    return s;
  }
  try { var raw = localStorage.getItem(LSK); if (raw) S = normalize(JSON.parse(raw)); } catch (e) { }

  var db = null, uid = null, pushTimer = null, pushing = false;
  function setSync(txt, cls) {
    var p = $('#syncPill'); if (p) { p.textContent = txt; p.className = 'pill' + (cls ? ' ' + cls : ''); }
    var st = $('#saveState'); if (st) st.textContent = txt;
  }
  function save() {
    S.u = Date.now();
    try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) { }
    if (db && uid) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }
  }
  function push() {
    if (!db || !uid || pushing) return;
    pushing = true;
    db.doc('kana/' + uid).set(S).then(function () { pushing = false; setSync('已同步', 'on'); })
    ['catch'](function (e) { pushing = false; setSync(e && e.code === 'unavailable' ? '離線（存本機）' : '僅存本機', 'warn'); });
  }
  window.addEventListener('beforeunload', function () { if (pushTimer) { clearTimeout(pushTimer); push(); } });

  /* ───────── SRS ───────── */
  var IV = [0, 1, 2, 4, 8, 16, 32, 64, 120];
  function grade(id, ok) {
    if (!id) { S.stats[ok ? 'ok' : 'ng']++; save(); return; }
    var c = S.srs[id] || { b: 0, l: 0, d: TODAY };
    if (ok) { c.b = Math.min((c.b || 0) + 1, 8); c.d = addDays(TODAY, IV[c.b]); }
    else { c.l = (c.l || 0) + 1; c.b = 1; c.d = TODAY; }
    S.srs[id] = c; S.stats[ok ? 'ok' : 'ng']++; save();
  }
  function box(id) { return S.srs[id] ? (S.srs[id].b || 0) : 0; }
  function dueIds() { return Object.keys(S.srs).filter(function (k) { return diffDays(S.srs[k].d, TODAY) >= 0; }); }
  /* 熟練度 0 未練習 / 1 不熟 / 2 普通 / 3 已熟 */
  function lvl(item, script) {
    var bh = box('h:' + item.h), bk = box('k:' + item.h), b;
    if (script === 'h') b = bh; else if (script === 'k') b = bk; else b = Math.min(bh, bk);
    if (!b) return 0;
    if (b < 3) return 1;
    if (b < 6) return 2;
    return 3;
  }
  function masteredCount() {
    var n = 0; ALL.forEach(function (x) { if (lvl(x, 'b') === 3) n++; }); return n;
  }

  /* ───────── DOM ───────── */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var a in attrs) {
      if (a === 'class') n.className = attrs[a];
      else if (a === 'text') n.textContent = attrs[a];
      else if (a === 'on') { for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]); }
      else if (attrs[a] !== null && attrs[a] !== undefined) n.setAttribute(a, attrs[a]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function tx(tag, cls, text) { return el(tag, { 'class': cls, text: text }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ───────── 朗讀 ───────── */
  var canSpeak = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var jaVoice = null, checked = false;
  function loadVoices() {
    if (!canSpeak) { noteVoice(); return; }
    var vs = [];
    try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { }
    for (var i = 0; i < vs.length; i++) { if (/^ja/i.test(vs[i].lang || '')) { jaVoice = vs[i]; break; } }
    if (vs.length) checked = true;
    noteVoice();
  }
  function noteVoice() {
    var n = $('#voiceNote'); if (!n) return;
    n.textContent = !canSpeak ? '此裝置不支援' : (jaVoice ? '可用：' + jaVoice.name : (checked ? '找不到日文語音' : '檢查中…'));
  }
  if (canSpeak) { loadVoices(); try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { } setTimeout(loadVoices, 800); }
  function say(t) {
    if (!canSpeak || !t) return false;
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(String(t));
      u.lang = 'ja-JP'; u.rate = Number(S.set.rate) || 0.8;
      if (jaVoice) u.voice = jaVoice;
      window.speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  }
  function stopSay() { if (canSpeak) { try { window.speechSynthesis.cancel(); } catch (e) { } } }
  function spk(t) { return el('button', { 'class': 'spk', 'aria-label': '朗讀', text: '♪', on: { click: function () { say(t); } } }); }

  /* ───────── 畫面 ───────── */
  var VIEWS = { table: '#v-table', lesson: '#v-lesson', drill: '#v-drill', run: '#v-run', prog: '#v-prog' };
  var cur = 'table';
  function show(name) {
    stopSay(); cur = name;
    for (var k in VIEWS) { var n = $(VIEWS[k]); if (n) n.hidden = (k !== name); }
    $$('.tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === name); });
    var m = document.querySelector('main'); if (m) m.scrollTop = 0;
    if (name === 'table') renderTable();
    if (name === 'lesson') renderLessons();
    if (name === 'drill') renderDrill();
    if (name === 'prog') renderProg();
    renderTop();
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-view')); }); });

  function renderTop() {
    var m = masteredCount();
    $('#masterPill').textContent = '熟練 ' + Math.round(m / ALL.length * 100) + '%';
    $('#masterPill').className = 'pill' + (m >= ALL.length * 0.8 ? ' on' : '');
  }

  /* ───────── 五十音表 ───────── */
  var selGlyph = null;
  function renderTable() {
    var script = S.set.script || 'h', gset = S.set.grid || 'sei';
    $$('#segScript button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === script); });
    $$('#segSet button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-set') === gset); });
    $('#gridTitle').textContent = gset === 'sei' ? '清音 46' : (gset === 'daku' ? '濁音・半濁音 25' : '拗音 33');
    $('#topSub').textContent = script === 'h' ? '平假名' : (script === 'k' ? '片假名' : '平假名・片假名對照');

    var L = ROWS[gset], host = $('#gridHost');
    host.innerHTML = '';
    var g = el('div', { 'class': 'grid' + (L.cols.length === 3 ? ' y3' : '') });
    g.appendChild(el('div'));
    L.cols.forEach(function (c) { g.appendChild(tx('div', 'ghead', c)); });
    L.rows.forEach(function (r) {
      g.appendChild(tx('div', 'ghead kana', r.charAt(0)));
      L.cols.forEach(function (c) {
        var it = null;
        setOf(gset).forEach(function (x) { if (x.row === r && x.col === c) it = x; });
        if (!it) { g.appendChild(el('div', { 'class': 'cell void' })); return; }
        var lv = lvl(it, script);
        var cls = 'cell lv' + lv + (script === 'k' ? ' kata' : '') + (selGlyph === it.h ? ' sel' : '');
        var kids = [];
        if (script === 'b') {
          kids.push(el('div', { 'class': 'g', style: 'color:var(--ai)', text: it.h }));
          kids.push(el('div', { 'class': 'g', style: 'color:var(--be);font-size:.8em', text: it.k }));
        } else {
          kids.push(el('div', { 'class': 'g', text: script === 'h' ? it.h : it.k }));
          kids.push(tx('div', 'rr', it.r));
        }
        var cell = el('button', { 'class': cls }, kids);
        cell.addEventListener('click', function () { selGlyph = it.h; say(it.h); renderTable(); renderDetail(it); });
        g.appendChild(cell);
      });
    });
    host.appendChild(g);
    if (selGlyph && BY_H[selGlyph]) renderDetail(BY_H[selGlyph]);
    $('#quickDrill').onclick = function () {
      S.set.range = gset; S.set.n = 20; save();
      runDrill(S.set.mode || 'h2r', gset, 20);
    };
  }

  function renderDetail(it) {
    var host = $('#detail'); host.innerHTML = '';
    var card = el('div', { 'class': 'card' });
    card.appendChild(el('div', { 'class': 'bigpair' }, [
      el('div', { 'class': 'bigcell h' }, [tx('div', 'lab', 'HIRAGANA'), el('div', { 'class': 'g', text: it.h }),
        tx('div', 'sm', it.sh ? it.sh + ' 畫' : '')]),
      el('div', { 'class': 'bigcell k' }, [tx('div', 'lab', 'KATAKANA'), el('div', { 'class': 'g', text: it.k }),
        tx('div', 'sm', it.sk ? it.sk + ' 畫' : '')])
    ]));
    card.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:10px' }, [
      el('div', { 'class': 'romaji', style: 'flex:1', text: it.r }), spk(it.h)
    ]));
    card.appendChild(el('div', { 'class': 'rule' }));
    var meta = el('div', { 'class': 'meta' });
    if (it.set === 'sei') {
      meta.appendChild(el('div', null, [tx('dt', '', '字源'),
        el('dd', null, [el('span', { 'class': 'src', text: it.oh }), document.createTextNode(' → ' + it.h + '　'),
        el('span', { 'class': 'src', text: it.ok }), document.createTextNode(' → ' + it.k)])]));
    } else if (it.set === 'daku') {
      meta.appendChild(el('div', null, [tx('dt', '', '組成'),
        el('dd', { 'class': 'kana', text: it.base + ' ＋ ' + (it.han ? '゜（半濁點）' : '゛（濁點）') + ' → ' + it.h })]));
    } else {
      meta.appendChild(el('div', null, [tx('dt', '', '組成'),
        el('dd', { 'class': 'kana', text: it.h.charAt(0) + ' ＋ 小さい ' + it.h.charAt(1) + ' → ' + it.h + '（只算一拍）' })]));
    }
    meta.appendChild(el('div', null, [tx('dt', '', '行・段'), el('dd', { text: it.row + '行・' + it.col + '段' })]));
    meta.appendChild(el('div', null, [tx('dt', '', '熟練'), el('dd', {
      text: ['未練習', '不熟（第 ' + box('h:' + it.h) + ' 階）', '普通', '已熟'][lvl(it, 'b')]
    })]));
    card.appendChild(meta);
    if (it.m) card.appendChild(el('div', { 'class': 'hint', style: 'margin-top:10px', text: it.m }));
    host.appendChild(card);
  }

  $$('#segScript button').forEach(function (b) {
    b.addEventListener('click', function () { S.set.script = b.getAttribute('data-s'); save(); renderTable(); });
  });
  $$('#segSet button').forEach(function (b) {
    b.addEventListener('click', function () { S.set.grid = b.getAttribute('data-set'); selGlyph = null; $('#detail').innerHTML = ''; save(); renderTable(); });
  });

  /* ───────── 題目 ───────── */
  function distract(item, pool, getter, n) {
    var out = [], seen = {}, g0 = getter(item);
    seen[g0] = 1;
    var same = pool.filter(function (x) { return x !== item && (x.row === item.row || x.col === item.col); });
    var rest = pool.filter(function (x) { return x !== item && same.indexOf(x) < 0; });
    shuffle(same); shuffle(rest);
    var order = same.concat(rest), i = 0;
    while (out.length < n && i < order.length) {
      var v = getter(order[i++]);
      if (!v || seen[v]) continue;
      seen[v] = 1; out.push(v);
    }
    return out;
  }
  var MODE_LABEL = {
    h2r: '看平假名選讀音', k2r: '看片假名選讀音', r2h: '看羅馬字選平假名', r2k: '看羅馬字選片假名',
    h2k: '選對應的片假名', k2h: '選對應的平假名', ear: '聽音選假名'
  };
  function makeQ(item, mode, pool) {
    var gh = function (x) { return x.h; }, gk = function (x) { return x.k; }, gr = function (x) { return x.r; };
    var q;
    if (mode === 'h2r') q = { id: 'h:' + item.h, big: item.h, script: 'h', ans: item.r, get: gr, kanaOpt: false };
    else if (mode === 'k2r') q = { id: 'k:' + item.h, big: item.k, script: 'k', ans: item.r, get: gr, kanaOpt: false };
    else if (mode === 'r2h') q = { id: 'h:' + item.h, mid: item.r, ans: item.h, get: gh, kanaOpt: true };
    else if (mode === 'r2k') q = { id: 'k:' + item.h, mid: item.r, ans: item.k, get: gk, kanaOpt: true };
    else if (mode === 'h2k') q = { id: 'k:' + item.h, big: item.h, script: 'h', ans: item.k, get: gk, kanaOpt: true };
    else if (mode === 'k2h') q = { id: 'h:' + item.h, big: item.k, script: 'k', ans: item.h, get: gh, kanaOpt: true };
    else q = { id: 'h:' + item.h, ear: item.h, ans: item.h, get: gh, kanaOpt: true };
    q.label = MODE_LABEL[mode];
    q.opts = shuffle([q.ans].concat(distract(item, pool, q.get, 3)));
    q.c = q.opts.indexOf(q.ans);
    q.ex = item.h + '／' + item.k + '　＝　' + item.r + (item.m ? '\n' + item.m : '');
    q.say = item.h;
    return q;
  }
  function poolFor(range) {
    if (range === 'sei') return KA.slice();
    if (range === 'daku') return KD.slice();
    if (range === 'yo') return KY.slice();
    if (range === 'weak') {
      var w = ALL.filter(function (x) { var l = lvl(x, 'b'); return l === 1 || (S.srs['h:' + x.h] && (S.srs['h:' + x.h].l || 0) > 0); });
      return w.length >= 4 ? w : ALL.slice();
    }
    return ALL.slice();
  }
  function modeOk(mode, item) {
    if (!item.amb) return true;
    return !(mode === 'r2h' || mode === 'r2k' || mode === 'ear');
  }

  /* ───────── 測驗執行 ───────── */
  function shell(title, sub) {
    var host = $('#v-run'); host.innerHTML = '';
    host.appendChild(el('div', { 'class': 'card' }, [
      el('div', { 'class': 'studyhead' }, [
        el('button', { 'class': 'chip', text: '‹ 返回', on: { click: function () { show(backTo); } } }),
        el('span', { 'class': 't' }, [el('b', { 'class': 'kana', text: title }), document.createTextNode(sub ? '　' + sub : '')])
      ]),
      el('div', { 'class': 'dots', id: 'dots' })
    ]));
    var body = el('div', { id: 'runBody', style: 'display:flex;flex-direction:column;gap:12px' });
    host.appendChild(body);
    show('run');
    return body;
  }
  var backTo = 'table';
  function dots(n, st) {
    var d = $('#dots'); if (!d) return;
    d.innerHTML = '';
    for (var i = 0; i < n; i++) d.appendChild(el('i', { 'class': st && st[i] ? st[i] : '' }));
  }

  function quiz(qs, title, onEnd, noGrade) {
    var i = 0, ok = 0, st = [], body = $('#runBody');
    function render() {
      stopSay(); body.innerHTML = '';
      dots(qs.length, st);
      if (i >= qs.length) { onEnd(ok, qs.length); return; }
      var q = qs[i];
      var head = el('div', { 'class': 'card' }, [
        el('div', { 'class': 'eyebrow', text: (q.label || title) + '　' + (i + 1) + ' / ' + qs.length })
      ]);
      if (q.ear) {
        var pb = el('button', { 'class': 'btn ghost', style: 'margin-top:10px', text: '▶ 再播一次' });
        pb.addEventListener('click', function () { say(q.ear); });
        head.appendChild(el('div', { 'class': 'qlabel', style: 'margin-top:8px', text: '聽到的是哪一個假名？' }));
        head.appendChild(pb);
        say(q.ear);
      } else if (q.big) {
        head.appendChild(el('div', { 'class': 'qbig' + (q.script === 'k' ? ' k' : ''), text: q.big }));
      } else if (q.mid) {
        head.appendChild(el('div', { 'class': 'qmid', style: 'margin-top:6px', text: q.mid }));
        head.appendChild(el('div', { 'class': 'qlabel', text: '選出對應的假名' }));
      }
      body.appendChild(head);
      var opts = el('div', { 'class': 'opts' }), btns = [];
      q.opts.forEach(function (o, n) {
        var b = el('button', { 'class': 'opt' }, [el('span', { 'class': q.kanaOpt ? 'tx kana' : 'tx', text: o })]);
        b.addEventListener('click', function () { answer(n); });
        btns.push(b); opts.appendChild(b);
      });
      body.appendChild(opts);
      function answer(n) {
        var right = n === q.c;
        btns.forEach(function (b, idx) {
          b.disabled = true;
          if (idx === q.c) b.classList.add('ok'); else if (idx === n) b.classList.add('ng');
        });
        if (right) ok++;
        st[i] = right ? 'ok' : 'ng'; dots(qs.length, st);
        if (!noGrade) grade(q.id, right);
        body.appendChild(el('div', { 'class': 'fb ' + (right ? 'ok' : 'ng') }, [
          tx('span', 'm kana', right ? '○' : '×'),
          el('span', { 'class': 'tx' }, [el('b', { text: right ? '正解' : '不正解' }),
          el('span', { style: 'white-space:pre-wrap', text: q.ex || '' })])
        ]));
        if (q.say) say(q.say);
        var nx = el('button', { 'class': 'btn', text: i + 1 >= qs.length ? '看結果' : '下一題' });
        nx.addEventListener('click', function () { i++; render(); });
        body.appendChild(nx); nx.focus();
      }
    }
    render();
  }
  function resultCard(body, ok, n, backName, extra) {
    body.innerHTML = '';
    var pct = Math.round(ok / n * 100);
    body.appendChild(el('div', { 'class': 'card', style: 'text-align:center' }, [
      tx('div', 'eyebrow', 'result'),
      el('div', { 'class': 'qmid', style: 'color:var(--ai)', text: '○ ' + ok + ' / ' + n }),
      tx('div', 'qlabel', pct >= 90 ? 'これなら次へ進めます。' : (pct >= 70 ? 'もう一回まわすと定着します。' : '先に弱點だけ練習しましょう。')),
      extra ? el('div', { style: 'margin-top:10px;font-size:13px;color:var(--ink-2)', text: extra }) : null
    ]));
    body.appendChild(el('button', { 'class': 'btn', text: '完成', on: { click: function () { show(backName); } } }));
  }

  function runDrill(mode, range, n) {
    backTo = 'drill';
    var pool = poolFor(range).filter(function (x) { return modeOk(mode, x); });
    if (pool.length < 4) { show('drill'); return; }
    var pickList = [];
    var bag = shuffle(pool.slice());
    while (pickList.length < n) { pickList = pickList.concat(bag); bag = shuffle(pool.slice()); }
    pickList = pickList.slice(0, n);
    var body = shell(MODE_LABEL[mode] || '練習', pool.length + ' 音・' + n + ' 題');
    var qs = pickList.map(function (it) { return makeQ(it, mode, pool); });
    quiz(qs, '練習', function (ok, c) { resultCard($('#runBody'), ok, c, 'drill'); });
    return body;
  }

  /* ───────── 課程 ───────── */
  function renderLessons() {
    var host = $('#lessonList'); host.innerHTML = '';
    LS_.forEach(function (ls, i) {
      var rec = S.les[ls.id];
      var b = el('button', { 'class': 'les' + (rec && rec.done ? ' done' : '') }, [
        el('span', { 'class': 'no', text: rec && rec.done ? '✓' : String(i + 1) }),
        el('span', { 'class': 'lt' }, [el('b', { text: ls.t }), el('small', { text: ls.sub })]),
        el('span', { 'class': 'pct tnum', text: rec && rec.best != null ? rec.best + '%' : '' })
      ]);
      b.addEventListener('click', function () { runLesson(ls); });
      host.appendChild(b);
    });
  }
  function runLesson(ls) {
    backTo = 'lesson';
    if (ls.k === 'loan') return lessonLoan(ls);
    if (ls.k === 'confuse') return lessonConfuse(ls);
    if (ls.k === 'rule') return lessonRule(ls);
    return lessonKana(ls);
  }
  function lessonDone(ls, pct) {
    S.les[ls.id] = { done: true, best: Math.max(pct, (S.les[ls.id] && S.les[ls.id].best) || 0) };
    save();
  }
  /* 卡片序列 → 下一步 */
  function cards(body, list, label, after) {
    var i = 0;
    function render() {
      stopSay(); body.innerHTML = '';
      var st = []; for (var n = 0; n < list.length; n++) st[n] = n < i ? 'ok' : (n === i ? 'on' : '');
      dots(list.length, st);
      body.appendChild(el('div', { 'class': 'card' }, [el('div', { 'class': 'eyebrow', text: label + '　' + (i + 1) + ' / ' + list.length })]));
      body.appendChild(list[i]());
      var nx = el('button', { 'class': 'btn', text: i + 1 >= list.length ? '進入測驗' : '下一個' });
      nx.addEventListener('click', function () { i++; if (i >= list.length) after(); else render(); });
      body.appendChild(nx);
    }
    render();
  }
  function kanaCard(it) {
    var c = el('div', { 'class': 'card' });
    c.appendChild(el('div', { 'class': 'bigpair' }, [
      el('div', { 'class': 'bigcell h' }, [tx('div', 'lab', 'HIRAGANA'), el('div', { 'class': 'g', text: it.h }), tx('div', 'sm', it.sh ? it.sh + ' 畫' : '')]),
      el('div', { 'class': 'bigcell k' }, [tx('div', 'lab', 'KATAKANA'), el('div', { 'class': 'g', text: it.k }), tx('div', 'sm', it.sk ? it.sk + ' 畫' : '')])
    ]));
    c.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:10px' }, [
      el('div', { 'class': 'romaji', style: 'flex:1', text: it.r }), spk(it.h)
    ]));
    if (it.set === 'sei' && it.oh) {
      c.appendChild(el('div', { 'class': 'rule' }));
      c.appendChild(el('div', { 'class': 'meta' }, [el('div', null, [tx('dt', '', '字源'),
        el('dd', { 'class': 'kana', text: it.oh + ' → ' + it.h + '　／　' + it.ok + ' → ' + it.k })])]));
    }
    if (it.m) c.appendChild(el('div', { 'class': 'hint', style: 'margin-top:10px', text: it.m }));
    return c;
  }
  function lessonKana(ls) {
    var items = ls.kana.map(function (h) { return BY_H[h]; }).filter(Boolean);
    var body = shell(ls.t, items.length + ' 音');
    cards(body, items.map(function (it) { return function () { say(it.h); return kanaCard(it); }; }), '字卡', function () {
      var pool = items.length >= 4 ? items : setOf(items[0].set);
      var modes = ['h2r', 'k2r', 'h2k', 'k2h'];
      var qs = [];
      items.forEach(function (it, n) {
        qs.push(makeQ(it, 'h2r', pool));
        qs.push(makeQ(it, 'k2r', pool));
        var m = modes[(n + 2) % 4];
        if (modeOk(m, it)) qs.push(makeQ(it, m, pool));
      });
      quiz(shuffle(qs), '確認テスト', function (ok, n) {
        var pct = Math.round(ok / n * 100);
        lessonDone(ls, pct);
        if (!ls.words || !ls.words.length) { resultCard($('#runBody'), ok, n, 'lesson'); return; }
        wordStage($('#runBody'), ls, ok, n);
      });
    });
  }
  function wordStage(body, ls, ok, n) {
    body.innerHTML = '';
    dots(1, ['on']);
    body.appendChild(el('div', { 'class': 'card' }, [
      el('div', { 'class': 'eyebrow', text: 'words' }),
      el('h2', { 'class': 'kana', style: 'margin:4px 0 10px', text: '用學過的假名拼單字' }),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        ls.words.map(function (w) {
          var row = el('div', { 'class': 'wordrow' }, [
            el('span', { 'class': 'w', text: w.w }), tx('span', 'r', w.r), tx('span', 'm', w.m)
          ]);
          row.appendChild(spk(w.w));
          return row;
        }))
    ]));
    body.appendChild(el('button', {
      'class': 'btn', text: '單字小測（' + ls.words.length + ' 題）', on: {
        click: function () {
          var qs = ls.words.map(function (w) {
            var others = shuffle(ls.words.filter(function (x) { return x !== w; })).slice(0, 3).map(function (x) { return x.m; });
            while (others.length < 3) others.push('—');
            var opts = shuffle([w.m].concat(others));
            return { id: null, big: w.w, script: 'h', label: '單字意思', opts: opts, c: opts.indexOf(w.m), ex: w.w + '（' + w.r + '）＝' + w.m, say: w.w, kanaOpt: false };
          });
          quiz(qs, '單字', function (o2, n2) {
            resultCard($('#runBody'), ok + o2, n + n2, 'lesson', '假名測驗 ' + ok + '/' + n + '、單字 ' + o2 + '/' + n2);
          }, true);
        }
      }
    }));
    body.appendChild(el('button', { 'class': 'btn quiet', text: '略過單字', on: { click: function () { resultCard($('#runBody'), ok, n, 'lesson'); } } }));
  }
  function lessonRule(ls) {
    var body = shell(ls.t, RU.length + ' 條規則');
    cards(body, RU.map(function (r) {
      return function () {
        var c = el('div', { 'class': 'card' }, [
          el('h2', { 'class': 'kana', text: r.t }),
          el('div', { 'class': 'rule' }),
          el('p', { style: 'font-size:14px', text: r.b })
        ]);
        var box2 = el('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:8px' });
        (r.ex || []).forEach(function (e) {
          var row = el('div', { 'class': 'wordrow' }, [el('span', { 'class': 'w', text: e.j }), tx('span', 'r', e.r), tx('span', 'm', e.m)]);
          row.appendChild(spk(e.j.split('／')[0]));
          box2.appendChild(row);
        });
        c.appendChild(box2);
        return c;
      };
    }), '規則', function () {
      var qs = ls.words.map(function (w) {
        var others = shuffle(ls.words.filter(function (x) { return x !== w; })).slice(0, 3).map(function (x) { return x.r; });
        while (others.length < 3) others.push('—');
        var opts = shuffle([w.r].concat(others));
        return { id: null, big: w.w, script: 'h', label: '拍子・羅馬字', opts: opts, c: opts.indexOf(w.r), ex: w.w + '＝' + w.r + '　' + w.m, say: w.w, kanaOpt: false };
      });
      quiz(qs, '規則テスト', function (ok, n) {
        lessonDone(ls, Math.round(ok / n * 100));
        resultCard($('#runBody'), ok, n, 'lesson', '長音與促音的長短會改變意思，念出聲最有效。');
      }, true);
    });
  }
  function lessonLoan(ls) {
    var body = shell(ls.t, LW.length + ' 字');
    body.innerHTML = '';
    dots(2, ['on']);
    body.appendChild(el('div', { 'class': 'card' }, [
      el('div', { 'class': 'eyebrow', text: 'katakana words' }),
      el('h2', { 'class': 'kana', style: 'margin:4px 0 10px', text: '最常見的 24 個外来語' }),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, LW.map(function (w) {
        var row = el('div', { 'class': 'wordrow' }, [
          el('span', { 'class': 'w', style: 'color:var(--be)', text: w.w }), tx('span', 'r', w.r), tx('span', 'm', w.m)
        ]);
        row.appendChild(spk(w.w));
        return row;
      }))
    ]));
    body.appendChild(el('button', {
      'class': 'btn be', text: '測驗（12 題）', on: {
        click: function () {
          var sel = shuffle(LW.slice()).slice(0, 12);
          var qs = sel.map(function (w, n) {
            if (n % 2 === 0) {
              var o = shuffle([w.m].concat(shuffle(LW.filter(function (x) { return x !== w; })).slice(0, 3).map(function (x) { return x.m; })));
              return { id: null, big: w.w, script: 'k', label: '這是什麼意思', opts: o, c: o.indexOf(w.m), ex: w.w + '（' + w.r + '）＝' + w.m, say: w.w, kanaOpt: false };
            }
            var o2 = shuffle([w.w].concat(shuffle(LW.filter(function (x) { return x !== w; })).slice(0, 3).map(function (x) { return x.w; })));
            return { id: null, mid: w.m, label: '選出對應的片假名', opts: o2, c: o2.indexOf(w.w), ex: w.w + '（' + w.r + '）＝' + w.m, say: w.w, kanaOpt: true };
          });
          quiz(qs, '外来語', function (ok, n) {
            lessonDone(ls, Math.round(ok / n * 100));
            resultCard($('#runBody'), ok, n, 'lesson', '片假名長音的「ー」常被漏掉，念的時候要拉滿一拍。');
          }, true);
        }
      }
    }));
  }
  function lessonConfuse(ls) {
    var body = shell(ls.t, CF.length + ' 組');
    cards(body, CF.map(function (g) {
      return function () {
        var c = el('div', { 'class': 'card' }, [
          el('div', { 'class': 'cgroup' }, [
            tx('div', 'gg', g.it.join(' ')),
            tx('div', 'tp', g.tip)
          ])
        ]);
        var row = el('div', { style: 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap' });
        g.it.forEach(function (ch) {
          var it = BY_H[ch] || BY_K[ch];
          var b = el('button', { 'class': 'opt', style: 'min-width:86px' }, [
            el('span', { 'class': 'tx kana', text: ch })
          ]);
          if (it) {
            b.appendChild(tx('span', 'r', it.r));
            b.addEventListener('click', function () { say(it.h); });
          }
          row.appendChild(b);
        });
        c.appendChild(row);
        return c;
      };
    }), '易混字組', function () {
      var qs = [];
      CF.forEach(function (g) {
        var members = g.it.map(function (ch) { return { ch: ch, it: BY_H[ch] || BY_K[ch] }; }).filter(function (x) { return x.it; });
        if (members.length < 2) return;
        var target = members[Math.floor(Math.random() * members.length)];
        var opts = shuffle(members.map(function (m) { return m.it.r; }));
        var uniqOpts = [];
        opts.forEach(function (o) { if (uniqOpts.indexOf(o) < 0) uniqOpts.push(o); });
        if (uniqOpts.length < 2) return;
        qs.push({
          id: (BY_K[target.ch] && !BY_H[target.ch] ? 'k:' : 'h:') + target.it.h,
          big: target.ch, script: BY_K[target.ch] && !BY_H[target.ch] ? 'k' : 'h',
          label: '這個字念什麼', opts: uniqOpts, c: uniqOpts.indexOf(target.it.r),
          ex: g.it.join(' ／ ') + '\n' + g.tip, say: target.it.h, kanaOpt: false
        });
      });
      quiz(shuffle(qs), '易混字', function (ok, n) {
        lessonDone(ls, Math.round(ok / n * 100));
        resultCard($('#runBody'), ok, n, 'lesson', '寫錯最多的是シ／ツ和ソ／ン，看筆畫方向而不是整體形狀。');
      });
    });
  }

  /* ───────── 練習頁 ───────── */
  function renderDrill() {
    $$('#drillMode button').forEach(function (b) {
      var m = b.getAttribute('data-m');
      b.classList.toggle('on', m === S.set.mode);
      if (m === 'ear' && !canSpeak) { b.disabled = true; b.style.opacity = '.45'; b.textContent = '聽音（此裝置不支援）'; }
      b.onclick = function () { S.set.mode = m; save(); renderDrill(); };
    });
    $$('#drillSet button').forEach(function (b) {
      var r = b.getAttribute('data-r');
      b.classList.toggle('on', r === S.set.range);
      b.onclick = function () { S.set.range = r; save(); renderDrill(); };
    });
    $$('#drillN button').forEach(function (b) {
      var n = Number(b.getAttribute('data-n'));
      b.classList.toggle('on', n === Number(S.set.n));
      b.onclick = function () { S.set.n = n; save(); renderDrill(); };
    });
    var pool = poolFor(S.set.range).filter(function (x) { return modeOk(S.set.mode, x); });
    $('#startDrill').textContent = '開始（' + pool.length + ' 音中抽 ' + S.set.n + ' 題）';
    $('#startDrill').disabled = pool.length < 4;
    $('#startDrill').onclick = function () { runDrill(S.set.mode, S.set.range, Number(S.set.n)); };
    var rl = $('#ruleList'); rl.innerHTML = '';
    RU.forEach(function (r) {
      rl.appendChild(el('div', { style: 'border-left:3px solid var(--ai-line);padding-left:10px' }, [
        el('b', { 'class': 'kana', style: 'font-size:14.5px', text: r.t }),
        el('p', { style: 'font-size:12.5px;color:var(--ink-2)', text: r.b })
      ]));
    });
  }

  /* ───────── 進度頁 ───────── */
  function renderProg() {
    $('#pMaster').textContent = masteredCount();
    var due = dueIds();
    $('#pDue').textContent = due.length;
    var tot = S.stats.ok + S.stats.ng;
    $('#pAcc').textContent = tot ? Math.round(S.stats.ok / tot * 100) + '%' : '—';
    $('#reviewBtn').disabled = due.length === 0;
    $('#reviewBtn').textContent = due.length ? '複習到期卡片（' + due.length + '）' : '今天沒有到期卡片';
    $('#reviewBtn').onclick = function () {
      backTo = 'prog';
      var qs = [];
      shuffle(due.slice()).slice(0, 30).forEach(function (id) {
        var h = id.slice(2), it = BY_H[h]; if (!it) return;
        var mode = id.charAt(0) === 'k' ? (Math.random() < 0.5 ? 'k2r' : 'k2h') : (Math.random() < 0.5 ? 'h2r' : 'h2k');
        if (!modeOk(mode, it)) mode = 'h2r';
        qs.push(makeQ(it, mode, setOf(it.set)));
      });
      if (!qs.length) return;
      shell('復習', qs.length + ' 題');
      quiz(qs, '復習', function (ok, n) { resultCard($('#runBody'), ok, n, 'prog'); });
    };
    var wl = $('#weakList'); wl.innerHTML = '';
    var weak = Object.keys(S.srs).filter(function (k) { return (S.srs[k].l || 0) > 0; })
      .sort(function (a, b) { return (S.srs[b].l || 0) - (S.srs[a].l || 0); }).slice(0, 20);
    if (!weak.length) { wl.appendChild(tx('div', 'empty', '還沒有錯誤記錄。')); }
    else {
      var box2 = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' });
      weak.forEach(function (id) {
        var it = BY_H[id.slice(2)]; if (!it) return;
        var glyph = id.charAt(0) === 'k' ? it.k : it.h;
        var b = el('button', { 'class': 'opt', style: 'min-width:76px;flex-direction:column;gap:0' }, [
          el('span', { 'class': 'tx kana', style: id.charAt(0) === 'k' ? 'color:var(--be)' : '', text: glyph }),
          tx('span', 'r', it.r + '　×' + S.srs[id].l)
        ]);
        b.addEventListener('click', function () { say(it.h); });
        box2.appendChild(b);
      });
      wl.appendChild(box2);
    }
    $$('#rateChips button').forEach(function (b) {
      b.classList.toggle('on', Number(b.getAttribute('data-rate')) === Number(S.set.rate));
      b.onclick = function () { S.set.rate = Number(b.getAttribute('data-rate')); save(); renderProg(); };
    });
    $('#testVoice').onclick = function () { if (!say('あいうえお')) noteVoice(); };
    $$('#themeChips button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme') === (S.set.theme || 'auto'));
      b.onclick = function () { S.set.theme = b.getAttribute('data-theme'); applyTheme(); save(); renderProg(); };
    });
    $('#resetAll').onclick = function () { $('#resetConfirm').hidden = false; };
    $('#resetNo').onclick = function () { $('#resetConfirm').hidden = true; };
    $('#resetYes').onclick = function () {
      var keep = S.set; S = normalize(null); S.set = keep; save();
      $('#resetConfirm').hidden = true; show('prog');
    };
    bindBackup();
    loadVoices();
  }
  /* 備份：以 JSON 文字交換，不依賴檔案下載 */
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
      msg.textContent = '已還原：' + Object.keys(S.srs).length + ' 張卡片、' + Object.keys(S.les).length + ' 課記錄。';
      renderTop();
    };
  }
  function applyTheme() {
    var t = S.set.theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  /* ───────── 同步 ───────── */
  function connect() {
    if (!window.claude || typeof window.claude.use !== 'function') { setSync('本機儲存'); return; }
    Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (res) {
      db = res[0]; var user = res[1];
      if (!db || !user) { setSync('本機儲存'); return; }
      return user.id().then(function (id) {
        if (!id) { db = null; setSync('本機儲存'); return; }
        uid = id; setSync('同步中…');
        return db.doc('kana/' + uid).get().then(function (snap) {
          var remote = snap && snap.exists ? snap.data() : null;
          if (remote && Number(remote.u || 0) > Number(S.u || 0)) {
            S = normalize(remote);
            try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) { }
            applyTheme(); show(cur === 'run' ? 'table' : cur);
            setSync('已同步', 'on');
          } else { setSync('已同步', 'on'); push(); }
        });
      });
    })['catch'](function () { db = null; setSync('本機儲存'); });
  }

  applyTheme();
  show('table');
  connect();
})();

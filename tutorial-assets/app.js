/* =========================================================================
   The Architect's Field Guide — interactive engine
   Navigation · syntax highlighting · chapter quizzes · exam simulator
   ========================================================================= */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('cca_' + k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cca_' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------------------------------------------------------------
     PAGE ORDER + NAVIGATION
  --------------------------------------------------------------------- */
  const ORDER = ['home', 'blueprint', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6',
                 'ch7', 'ch8', 'ch9', 'ch10', 'ch11', 'ch12', 'ch13', 'exam'];
  const LABELS = {
    home: 'Overview', blueprint: 'Exam Blueprint',
    ch1: 'Ch 1 · Claude API', ch2: 'Ch 2 · Tools & tool_use', ch3: 'Ch 3 · Agent SDK',
    ch4: 'Ch 4 · MCP', ch5: 'Ch 5 · Claude Code', ch6: 'Ch 6 · Prompt Engineering',
    ch7: 'Ch 7 · Message Batches', ch8: 'Ch 8 · Decomposition', ch9: 'Ch 9 · Escalation',
    ch10: 'Ch 10 · Error Handling', ch11: 'Ch 11 · Context', ch12: 'Ch 12 · Provenance',
    ch13: 'Ch 13 · Built-in Tools', exam: 'Exam Simulator'
  };
  let current = 'home';

  function showPage(id, push) {
    if (!ORDER.includes(id)) id = 'home';
    current = id;
    $$('.page').forEach(p => p.classList.remove('active'));
    const page = $('#page-' + id);
    if (page) page.classList.add('active');

    $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === id));
    $('#crumb').innerHTML = (id.startsWith('ch') ? 'Part I &nbsp;·&nbsp; <b>' : '<b>') +
      LABELS[id] + '</b>';

    const i = ORDER.indexOf(id);
    const prev = $('#prevBtn'), next = $('#nextBtn');
    prev.disabled = i <= 0;
    next.disabled = i >= ORDER.length - 1;
    next.innerHTML = i >= ORDER.length - 1 ? 'Done' :
      (id === 'blueprint' ? 'Start Ch 1 →' : 'Next →');

    window.scrollTo({ top: 0, behavior: 'auto' });
    $('#content').scrollTop = 0;
    closeSidebar();
    store.set('last', id);
    if (push) history.replaceState(null, '', '#' + id);

    if (id === 'blueprint') animateWeights();
    if (id === 'exam') Exam.enterIntro();
  }

  function go(delta) { showPage(ORDER[Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(current) + delta))], true); }

  /* ---------------------------------------------------------------------
     SIDEBAR (mobile)
  --------------------------------------------------------------------- */
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
  $('#menuToggle').addEventListener('click', () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('show'); });
  $('#scrim').addEventListener('click', closeSidebar);

  $$('.nav-link').forEach(l => l.addEventListener('click', () => showPage(l.dataset.page, true)));
  $('#prevBtn').addEventListener('click', () => go(-1));
  $('#nextBtn').addEventListener('click', () => go(1));
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-goto]');
    if (t) showPage(t.dataset.goto, true);
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'ArrowRight' && !$('#nextBtn').disabled && current !== 'exam') go(1);
    if (e.key === 'ArrowLeft' && !$('#prevBtn').disabled && current !== 'exam') go(-1);
  });

  /* ---------------------------------------------------------------------
     SYNTAX HIGHLIGHTING (lightweight, multi-language)
  --------------------------------------------------------------------- */
  const RE = /(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*")(?=\s*:)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(true|false|null|None|True|False)\b|\b(def|class|return|if|elif|else|for|while|in|import|from|async|await|with|lambda|try|except|raise|and|or|not|enum|type|required|properties)\b|(\b\d+\.?\d*\b)/g;
  function highlight(code) {
    const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(RE, (m, com, prop, str, bool, kw, num) => {
      if (com !== undefined) return '<span class="tok-com">' + com + '</span>';
      if (prop !== undefined) return '<span class="tok-prop">' + prop + '</span>';
      if (str !== undefined) return '<span class="tok-str">' + str + '</span>';
      if (bool !== undefined) return '<span class="tok-bool">' + bool + '</span>';
      if (kw !== undefined) return '<span class="tok-key">' + kw + '</span>';
      if (num !== undefined) return '<span class="tok-num">' + num + '</span>';
      return m;
    });
  }
  $$('pre[data-lang] code').forEach(c => { c.innerHTML = highlight(c.textContent); });

  /* ---------------------------------------------------------------------
     CHAPTER QUIZZES
  --------------------------------------------------------------------- */
  const TOTAL_CHAPTERS = 13;
  let doneChapters = new Set(store.get('done', []));
  let quizState = store.get('quiz', {});   // { chId: { questionIndex: chosenOptionIndex } }

  function refreshProgress() {
    const pct = Math.round((doneChapters.size / TOTAL_CHAPTERS) * 100);
    $('#progFill').style.width = pct + '%';
    $('#progPct').textContent = pct + '%';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
      const link = $('.nav-link[data-page="ch' + i + '"]');
      if (link) link.classList.toggle('done', doneChapters.has('ch' + i));
    }
  }

  // Apply the answered/locked visual state to a quiz question (used live + on restore)
  function lockQuizQuestion(q, opts, explain, chosenIdx) {
    q.dataset.locked = '1';
    opts.forEach((o, oi) => {
      o.classList.add('locked');
      const isCorrect = o.hasAttribute('data-correct');
      if (isCorrect) o.classList.add('correct');
      if (oi === chosenIdx && !isCorrect) o.classList.add('wrong');
      if (!$('.opt-mark', o)) {
        const m = document.createElement('span');
        m.className = 'opt-mark';
        m.textContent = isCorrect ? '✓' : (oi === chosenIdx ? '✗' : '');
        o.appendChild(m);
      }
    });
    explain.classList.add('show');
  }

  $$('.quiz').forEach(quiz => {
    const chId = quiz.dataset.quiz;
    const questions = $$('.q', quiz);
    const saved = quizState[chId] || {};
    let answered = 0;
    const refs = [];
    questions.forEach((q, qi) => {
      const opts = $$('.opt', q);
      const explain = $('.q-explain', q);
      refs.push({ q: q, opts: opts, explain: explain });
      // prepend option key letters A B C D
      opts.forEach((o, i) => {
        const k = document.createElement('span');
        k.className = 'opt-key';
        k.textContent = 'ABCD'[i];
        o.insertBefore(k, o.firstChild);
      });
      // restore a previously saved selection
      if (saved[qi] !== undefined) { lockQuizQuestion(q, opts, explain, saved[qi]); answered++; }
      // wire clicks
      opts.forEach((opt, oi) => {
        opt.addEventListener('click', () => {
          if (q.dataset.locked) return;
          lockQuizQuestion(q, opts, explain, oi);
          quizState[chId] = quizState[chId] || {};
          quizState[chId][qi] = oi;
          store.set('quiz', quizState);
          answered++;
          if (answered === questions.length && !doneChapters.has(chId)) {
            doneChapters.add(chId);
            store.set('done', Array.from(doneChapters));
            refreshProgress();
          }
        });
      });
    });

    // "Reset answers" button for this chapter's quiz
    const head = $('.quiz-head', quiz);
    if (head) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn quiz-reset';
      btn.style.cssText = 'margin-left:auto;font-size:12px;padding:5px 11px';
      btn.innerHTML = '&#8634; Reset answers';
      btn.addEventListener('click', () => {
        refs.forEach(r => {
          delete r.q.dataset.locked;
          r.opts.forEach(o => {
            o.classList.remove('locked', 'correct', 'wrong');
            const m = $('.opt-mark', o);
            if (m) m.remove();
          });
          r.explain.classList.remove('show');
        });
        answered = 0;
        if (quizState[chId]) { delete quizState[chId]; store.set('quiz', quizState); }
        if (doneChapters.has(chId)) {
          doneChapters.delete(chId);
          store.set('done', Array.from(doneChapters));
          refreshProgress();
        }
      });
      head.appendChild(btn);
    }
  });
  refreshProgress();

  /* ---------------------------------------------------------------------
     DOMAIN WEIGHT BARS (blueprint page)
  --------------------------------------------------------------------- */
  let weightsAnimated = false;
  function animateWeights() {
    if (weightsAnimated) return;
    weightsAnimated = true;
    $$('.weight-fill').forEach((f, i) => {
      const w = f.dataset.w;
      setTimeout(() => { f.style.width = w + '%'; }, 120 + i * 90);
    });
  }

  /* ---------------------------------------------------------------------
     EXAM SIMULATOR
  --------------------------------------------------------------------- */
  const Exam = (function () {
    const ALL = (window.EXAM_QUESTIONS || []).slice();

    function normScenario(s) {
      const x = s.toLowerCase();
      if (x.includes('customer support')) return 'Customer Support';
      if (x.includes('code generation')) return 'Code Generation';
      if (x.includes('research')) return 'Multi-Agent Research';
      if (x.includes('continuous integration') || x.includes('for ci') || x.includes('code review')) return 'Claude Code · CI';
      if (x.includes('conversational')) return 'Conversational AI';
      return s;
    }
    ALL.forEach(q => { q._scn = normScenario(q.scenario); });

    const SCENARIOS = Array.from(new Set(ALL.map(q => q._scn)));
    const SCN_COLOR = {
      'Customer Support': '#cb4b16', 'Code Generation': '#268bd2',
      'Multi-Agent Research': '#6c71c4', 'Claude Code · CI': '#859900',
      'Conversational AI': '#b58900'
    };

    let mode = store.get('exMode', 'study');   // 'study' | 'exam'
    let selScenario = 'all';
    let shuffle = false;
    let queue = [];              // current question objects
    let idx = 0;
    let answers = {};            // id -> chosen index
    let reviewing = false;

    // ---- persistence: save/restore the current (or last) exam run ----
    function saveRun(finished) {
      store.set('examRun', {
        mode: mode, scenario: selScenario, shuffle: shuffle,
        queueIds: queue.map(q => q.id), idx: idx, answers: answers,
        finished: !!finished, ts: Date.now()
      });
    }
    function loadRun() { return store.get('examRun', null); }
    function restoreRun(run, toResult) {
      mode = run.mode; selScenario = run.scenario; shuffle = !!run.shuffle;
      queue = (run.queueIds || []).map(id => ALL.find(q => q.id === id)).filter(Boolean);
      if (!queue.length) return;
      answers = run.answers || {};
      idx = Math.min(run.idx || 0, queue.length - 1);
      reviewing = false;
      $('#examIntro').style.display = 'none';
      if (toResult) { $('#examRunner').style.display = 'none'; showResult(); }
      else { $('#examResult').style.display = 'none'; $('#examRunner').style.display = ''; render(); }
    }

    function shuffleArr(a) {
      const r = a.slice();
      for (let i = r.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [r[i], r[k]] = [r[k], r[i]]; }
      return r;
    }

    function buildChips() {
      const bar = $('#scenarioChips');
      bar.innerHTML = '';
      const mk = (key, label, count) => {
        const c = document.createElement('button');
        c.className = 'chip' + (selScenario === key ? ' active' : '');
        c.textContent = label + ' · ' + count;
        c.addEventListener('click', () => { selScenario = key; buildChips(); updateSummary(); });
        bar.appendChild(c);
      };
      mk('all', 'All', ALL.length);
      SCENARIOS.forEach(s => mk(s, s, ALL.filter(q => q._scn === s).length));
    }

    function currentSet() {
      let set = selScenario === 'all' ? ALL.slice() : ALL.filter(q => q._scn === selScenario);
      if (shuffle) set = shuffleArr(set);
      return set;
    }

    function updateSummary() {
      const n = (selScenario === 'all' ? ALL : ALL.filter(q => q._scn === selScenario)).length;
      $('#startSummary').textContent = mode + ' mode · ' + n + ' questions' +
        (selScenario === 'all' ? '' : ' · ' + selScenario);
    }

    function enterIntro() {
      $('#statTotal').textContent = ALL.length;
      $('#examIntro').style.display = '';
      $('#examRunner').style.display = 'none';
      $('#examResult').style.display = 'none';
      buildChips();
      $$('.mode-card').forEach(c => c.style.outline = c.dataset.mode === mode ? '2px solid var(--clay)' : 'none');
      updateSummary();
      renderResumeBanner();
      ensureResetLink();
    }

    // Banner at the top of the intro: resume an in-progress run, or review the last result.
    function renderResumeBanner() {
      let host = $('#examResume');
      if (!host) {
        host = document.createElement('div');
        host.id = 'examResume';
        host.style.margin = '22px 0 6px';
        const intro = $('#examIntro');
        const head = $('.page-head', intro);
        if (head && head.nextSibling) intro.insertBefore(host, head.nextSibling);
        else intro.insertBefore(host, intro.firstChild);
      }
      const run = loadRun();
      if (!run || !run.queueIds || !run.queueIds.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
      host.style.display = '';
      const total = run.queueIds.length;
      const ans = run.answers || {};
      const answered = Object.keys(ans).length;
      const correct = run.queueIds.filter(id => { const q = ALL.find(x => x.id === id); return q && ans[id] === q.correct; }).length;
      const pct = total ? Math.round(correct / total * 100) : 0;
      const scn = run.scenario === 'all' ? 'All scenarios' : run.scenario;

      const box = document.createElement('div');
      box.className = 'callout note';
      box.style.display = 'flex';
      box.style.flexWrap = 'wrap';
      box.style.alignItems = 'center';
      box.style.justifyContent = 'space-between';
      box.style.gap = '12px';
      box.innerHTML = run.finished
        ? '<div><div class="co-title">Last result saved</div><div style="font-size:14px"><b>' + pct + '%</b> · ' + correct + '/' + total + ' correct · ' + run.mode + ' mode · ' + scn + '</div></div>'
        : '<div><div class="co-title">Run in progress</div><div style="font-size:14px">answered ' + answered + '/' + total + ' · ' + run.mode + ' mode · ' + scn + '</div></div>';

      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
      btns.innerHTML = run.finished
        ? '<button class="btn btn-blue" data-act="review">Review answers</button><button class="btn" data-act="retake">Retake</button><button class="btn" data-act="clear">Clear</button>'
        : '<button class="btn btn-blue" data-act="resume">Resume</button><button class="btn" data-act="clear">Discard</button>';
      box.appendChild(btns);
      host.innerHTML = '';
      host.appendChild(box);

      btns.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'clear') { store.set('examRun', null); renderResumeBanner(); }
        else if (act === 'review') restoreRun(run, true);
        else if (act === 'resume') restoreRun(run, false);
        else if (act === 'retake') { mode = run.mode; selScenario = run.scenario; shuffle = !!run.shuffle; start(); }
      }));
    }

    // A subtle "reset everything" link at the bottom of the intro.
    function ensureResetLink() {
      if ($('#examReset')) return;
      const r = document.createElement('div');
      r.id = 'examReset';
      r.style.cssText = 'margin-top:28px;font-size:12.5px';
      r.innerHTML = '<a href="#" style="color:var(--muted)">Reset all saved progress — chapter quizzes &amp; exam results</a>';
      $('#examIntro').appendChild(r);
      r.querySelector('a').addEventListener('click', e => {
        e.preventDefault();
        if (window.confirm('Clear all saved progress? This erases your chapter quiz answers and exam results on this device.')) {
          ['done', 'quiz', 'examRun', 'last'].forEach(k => store.set(k, null));
          location.reload();
        }
      });
    }

    function start() {
      queue = currentSet();
      if (!queue.length) return;
      idx = 0; answers = {}; reviewing = false;
      saveRun(false);
      $('#examIntro').style.display = 'none';
      $('#examResult').style.display = 'none';
      $('#examRunner').style.display = '';
      render();
    }

    function render() {
      const q = queue[idx];
      $('#exScenario').textContent = q._scn;
      $('#exScenario').style.background = 'rgba(255,255,255,0.04)';
      $('#exScenario').style.color = SCN_COLOR[q._scn] || '#268bd2';
      $('#exScenario').style.borderColor = (SCN_COLOR[q._scn] || '#268bd2') + '55';
      const tag = $('#exTag');
      if (q.group === 'worked-example') { tag.style.display = ''; tag.textContent = 'Worked example'; }
      else tag.style.display = 'none';
      $('#exCount').textContent = (idx + 1) + ' / ' + queue.length;
      $('#exScore').textContent = score();
      $('#exSituation').textContent = q.situation;
      $('#exPrompt').textContent = q.prompt;

      const wrap = $('#exOpts');
      wrap.innerHTML = '';
      const chosen = answers[q.id];
      const locked = (mode === 'study' && chosen !== undefined) || reviewing;
      q.options.forEach((text, i) => {
        const b = document.createElement('button');
        b.className = 'opt';
        const key = document.createElement('span');
        key.className = 'opt-key'; key.textContent = 'ABCD'[i];
        const span = document.createElement('span'); span.textContent = text;
        const mark = document.createElement('span'); mark.className = 'opt-mark';
        b.appendChild(key); b.appendChild(span); b.appendChild(mark);

        if (locked) {
          b.classList.add('locked');
          if (i === q.correct) { b.classList.add('correct'); mark.textContent = '✓'; }
          if (i === chosen && chosen !== q.correct) { b.classList.add('wrong'); mark.textContent = '✗'; }
        } else if (mode === 'exam' && i === chosen) {
          b.style.borderColor = 'var(--clay)';
          b.style.background = '#eee8d5';
          key.style.color = 'var(--clay)'; key.style.borderColor = 'var(--clay)';
        }

        b.addEventListener('click', () => choose(i));
        wrap.appendChild(b);
      });

      const ex = $('#exExplain');
      if (locked) {
        ex.innerHTML = '<b>' + (chosen === q.correct ? 'Correct.' : 'Answer: ' + 'ABCD'[q.correct] + '.') +
          '</b> ' + escapeHtml(q.explanation);
        ex.classList.add('show');
      } else { ex.classList.remove('show'); ex.innerHTML = ''; }

      $('#exProgress').style.width = ((idx + 1) / queue.length * 100) + '%';
      $('#exPrev').disabled = idx === 0;
      $('#exNext').innerHTML = idx === queue.length - 1 ? (reviewing ? 'Back to results' : 'Finish →') : 'Next →';
    }

    function choose(i) {
      const q = queue[idx];
      if (reviewing) return;
      if (mode === 'study' && answers[q.id] !== undefined) return; // locked
      answers[q.id] = i;
      saveRun(false);
      if (mode === 'study') render();      // reveal immediately
      else {                                // exam: just mark selection
        $('#exScore').textContent = score();
        render();
      }
    }

    function score() { return queue.filter(q => answers[q.id] === q.correct).length; }

    function next() {
      if (idx < queue.length - 1) { idx++; render(); }
      else if (reviewing) { reviewing = false; showResult(); }
      else { showResult(); }
    }
    function prev() { if (idx > 0) { idx--; render(); } }

    function showResult() {
      saveRun(true);
      $('#examRunner').style.display = 'none';
      $('#examResult').style.display = '';
      const correct = score(), total = queue.length;
      const pct = Math.round(correct / total * 100);
      $('#resCorrect').textContent = correct;
      $('#resWrong').textContent = total - correct;
      $('#resTotalQ').textContent = total;
      $('#resPct').textContent = pct + '%';
      const pass = pct >= 72;
      const v = $('#resVerdict');
      v.textContent = pass ? 'Pass' : 'Keep studying';
      v.className = 'verdict ' + (pass ? 'pass' : 'fail');
      const ring = $('#ringFg');
      const C = 2 * Math.PI * 92;
      ring.setAttribute('stroke', pass ? '#859900' : '#dc322f');
      ring.setAttribute('stroke-dasharray', C);
      ring.setAttribute('stroke-dashoffset', C);
      setTimeout(() => { ring.setAttribute('stroke-dashoffset', C * (1 - pct / 100)); }, 80);

      // scenario breakdown
      const bd = $('#scenarioBreakdown');
      bd.innerHTML = '<h3 style="font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--blue);margin-bottom:6px">By scenario</h3>';
      const byScn = {};
      queue.forEach(q => {
        byScn[q._scn] = byScn[q._scn] || { c: 0, t: 0 };
        byScn[q._scn].t++;
        if (answers[q.id] === q.correct) byScn[q._scn].c++;
      });
      Object.keys(byScn).forEach(s => {
        const o = byScn[s], p = Math.round(o.c / o.t * 100);
        const row = document.createElement('div');
        row.className = 'dbar';
        row.innerHTML =
          '<div class="dbar-top"><span>' + s + '</span><span>' + o.c + '/' + o.t + ' · ' + p + '%</span></div>' +
          '<div class="dbar-track"><div class="dbar-fill" style="width:0;background:' + (SCN_COLOR[s] || '#268bd2') + '"></div></div>';
        bd.appendChild(row);
        setTimeout(() => { $('.dbar-fill', row).style.width = p + '%'; }, 200);
      });
    }

    function review() {
      reviewing = true; idx = 0;
      $('#examResult').style.display = 'none';
      $('#examRunner').style.display = '';
      render();
    }

    // wire up controls
    $$('.mode-card').forEach(c => c.addEventListener('click', () => {
      mode = c.dataset.mode;
      store.set('exMode', mode);
      $$('.mode-card').forEach(x => x.style.outline = x === c ? '2px solid var(--clay)' : 'none');
      updateSummary();
    }));
    $('#shuffleToggle').addEventListener('change', e => { shuffle = e.target.checked; });
    $('#startExamBtn').addEventListener('click', start);
    $('#exNext').addEventListener('click', next);
    $('#exPrev').addEventListener('click', prev);
    $('#exQuit').addEventListener('click', enterIntro);
    $('#reviewBtn').addEventListener('click', review);
    $('#retryBtn').addEventListener('click', start);
    $('#backMenuBtn').addEventListener('click', enterIntro);

    return { enterIntro };
  })();

  function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------------------------------------------------------------
     UPDATE CHECK (option B)
     Compare the browser's CACHED version.json against the LIVE one. If they
     differ, a newer build was deployed -> show a non-blocking "Refresh" toast.
     The no-store fetch always hits the network, so detection bypasses the
     cache; the force-cache fetch returns whatever the browser already has.
     To release an update to existing visitors, bump "version" in version.json.
     Skipped on file:// (no real HTTP caching there).
  --------------------------------------------------------------------- */
  function showUpdateBanner(ver) {
    if ($('#updateBanner')) return;
    const bar = document.createElement('div');
    bar.id = 'updateBanner';
    bar.style.cssText =
      'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;' +
      'display:flex;align-items:center;gap:14px;padding:11px 16px;border-radius:8px;' +
      'background:var(--base02,#073642);color:var(--base3,#fdf6e3);font-family:var(--mono,monospace);' +
      'font-size:13px;box-shadow:0 10px 34px -10px rgba(0,0,0,.45);border:1px solid var(--base01,#586e75);' +
      'max-width:calc(100vw - 32px)';
    const msg = document.createElement('span');
    msg.innerHTML = '&#10037;&nbsp; A new version of the tutorial is available.';
    const refresh = document.createElement('button');
    refresh.textContent = 'Refresh';
    refresh.style.cssText =
      'font:600 12px var(--mono,monospace);padding:6px 13px;border-radius:5px;border:none;' +
      'background:var(--orange,#cb4b16);color:var(--base3,#fdf6e3);cursor:pointer';
    refresh.addEventListener('click', () => location.reload());
    const later = document.createElement('button');
    later.textContent = 'Later';
    later.style.cssText =
      'font:12px var(--mono,monospace);padding:6px 11px;border-radius:5px;background:transparent;' +
      'border:1px solid var(--base01,#586e75);color:var(--base3,#fdf6e3);cursor:pointer';
    later.addEventListener('click', () => { store.set('updDismissed', ver); bar.remove(); });
    bar.appendChild(msg); bar.appendChild(refresh); bar.appendChild(later);
    document.body.appendChild(bar);
  }

  (function checkForUpdate() {
    if (location.protocol === 'file:') return;
    const getVer = mode => fetch('version.json', { cache: mode })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d && d.version) || null)
      .catch(() => null);
    Promise.all([getVer('force-cache'), getVer('no-store')]).then(([cached, live]) => {
      if (!cached || !live || cached === live) return;         // up to date or undeterminable
      if (store.get('updDismissed', null) === live) return;    // already dismissed this version
      showUpdateBanner(live);
    });
  })();

  /* ---------------------------------------------------------------------
     BOOT
  --------------------------------------------------------------------- */
  const startId = (location.hash || '').replace('#', '');
  showPage(ORDER.includes(startId) ? startId : 'home', false);
})();

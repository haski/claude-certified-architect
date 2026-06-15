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

  function refreshProgress() {
    const pct = Math.round((doneChapters.size / TOTAL_CHAPTERS) * 100);
    $('#progFill').style.width = pct + '%';
    $('#progPct').textContent = pct + '%';
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
      const link = $('.nav-link[data-page="ch' + i + '"]');
      if (link) link.classList.toggle('done', doneChapters.has('ch' + i));
    }
  }

  $$('.quiz').forEach(quiz => {
    const chId = quiz.dataset.quiz;
    const questions = $$('.q', quiz);
    let answered = 0;
    questions.forEach(q => {
      const opts = $$('.opt', q);
      const explain = $('.q-explain', q);
      opts.forEach(opt => {
        opt.addEventListener('click', () => {
          if (q.dataset.locked) return;
          q.dataset.locked = '1';
          const correct = opt.hasAttribute('data-correct');
          opt.classList.add('locked', correct ? 'correct' : 'wrong');
          // reveal the correct one if user was wrong
          opts.forEach(o => {
            o.classList.add('locked');
            if (o.hasAttribute('data-correct')) o.classList.add('correct');
            // add a small marker
            if (!$('.opt-mark', o)) {
              const m = document.createElement('span');
              m.className = 'opt-mark';
              m.textContent = o.hasAttribute('data-correct') ? '✓' : (o === opt ? '✗' : '');
              o.appendChild(m);
            }
          });
          explain.classList.add('show');
          answered++;
          if (answered === questions.length && !doneChapters.has(chId)) {
            doneChapters.add(chId);
            store.set('done', Array.from(doneChapters));
            refreshProgress();
          }
        });
      });
      // prepend option key letters A B C D
      opts.forEach((o, i) => {
        const k = document.createElement('span');
        k.className = 'opt-key';
        k.textContent = 'ABCD'[i];
        o.insertBefore(k, o.firstChild);
      });
    });
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

    let mode = 'study';          // 'study' | 'exam'
    let selScenario = 'all';
    let shuffle = false;
    let queue = [];              // current question objects
    let idx = 0;
    let answers = {};            // id -> chosen index
    let reviewing = false;

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
    }

    function start() {
      queue = currentSet();
      if (!queue.length) return;
      idx = 0; answers = {}; reviewing = false;
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
     BOOT
  --------------------------------------------------------------------- */
  const startId = (location.hash || '').replace('#', '');
  showPage(ORDER.includes(startId) ? startId : 'home', false);
})();

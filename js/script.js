/* Global state */
let allQuestions = [];
let questions = [];           // actual set used for this quiz (after range + mode)
let filteredQuestions = [];   // after search (subset of questions)
let page = 0;
let answered = {};            // keyed by question id
let correctCount = 0, wrongCount = 0;
let rangeSelectedQuestions = null; // null => use full
const MAX_ASSESS = 50;

/* Utility */
function escape_html(s = '') {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

/* Load questions and assign IDs if missing */
async function load() {
  try {
    const res = await fetch('/api/questions');
    const data = await res.json();
    allQuestions = data.map((q, i) => ({ id: (q.id ?? (i + 1)), ...q }));
    document.getElementById('totalCount').innerText = allQuestions.length;
    document.getElementById('rangeInfo').innerText = `Using full range (all questions) — ${allQuestions.length} questions`;
  } catch (e) {
    console.error(e);
    document.getElementById('totalCount').innerText = '0';
    document.getElementById('rangeInfo').innerText = 'Failed to load questions.json';
  }
}

/* Range controls */
document.getElementById('applyRangeBtn').addEventListener('click', applyRange);
document.getElementById('clearRangeBtn').addEventListener('click', () => {
  document.getElementById('rangeStart').value = '';
  document.getElementById('rangeEnd').value = '';
  rangeSelectedQuestions = null;
  document.getElementById('rangeInfo').innerText = `Using full range (all questions) — ${allQuestions.length} questions`;
  hideRangeError();
});

function showRangeError(msg) {
  const el = document.getElementById('rangeError');
  el.style.display = 'block';
  el.innerText = msg;
}
function hideRangeError() { document.getElementById('rangeError').style.display = 'none'; document.getElementById('rangeError').innerText = ''; }

function applyRange() {
  hideRangeError();
  const total = allQuestions.length;
  let start = parseInt(document.getElementById('rangeStart').value);
  let end = parseInt(document.getElementById('rangeEnd').value);
  if (!start && !end) {
    rangeSelectedQuestions = null;
    document.getElementById('rangeInfo').innerText = `Using full range (all questions) — ${total} questions`;
    return;
  }
  if (!start || isNaN(start) || start < 1) start = 1;
  if (!end || isNaN(end) || end > total) end = total;
  if (start > end) {
    showRangeError('Start must be less than or equal to End.');
    return;
  }
  // slice is 0-indexed, inclusive on both sides
  rangeSelectedQuestions = allQuestions.slice(start - 1, end);
  document.getElementById('rangeInfo').innerText = `Selected range: ${start} — ${end} → ${rangeSelectedQuestions.length} questions`;
}

/* Start quiz */
document.getElementById('startBtn').addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  startQuiz(mode);
});

function startQuiz(mode) {
  hideRangeError();
  // determine selected set
  const base = rangeSelectedQuestions || allQuestions;
  if (!base || base.length === 0) {
    showRangeError('No questions available in the selected range.');
    return;
  }
  if (mode === 'assessment') {
    const n = Math.min(MAX_ASSESS, base.length);
    questions = shuffle(base).slice(0, n);
  } else { // browse
    questions = base.slice(); // keep order
  }

  // reset state
  filteredQuestions = questions.slice();
  page = 0; answered = {}; correctCount = 0; wrongCount = 0;
  document.getElementById('searchInput').value = '';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('quizSection').classList.remove('hidden');

  // show search only in browse mode (user wanted search mainly for browse)
  document.getElementById('searchBox').classList.toggle('hidden', mode !== 'browse');

  render();
  updateScore();
}

/* Rendering the quiz content using DOM (safer than string building) */
function render() {
  const area = document.getElementById('quizContent');
  area.innerHTML = '';

  if (!filteredQuestions || filteredQuestions.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.innerText = 'No questions found for your search/selection.';
    area.appendChild(p);
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('finishBtn').classList.add('hidden');
    document.getElementById('qPage').innerText = '';
    document.getElementById('qMeta').innerText = '';
    return;
  }

  const q = filteredQuestions[page];
  document.getElementById('qTitle').innerText = `Q${page + 1}.`;
  document.getElementById('qPage').innerText = `${page + 1}/${filteredQuestions.length}`;
  document.getElementById('qMeta').innerText = `Original ID: ${q.id}`;

  // Question text
  const qtext = document.createElement('div');
  qtext.className = 'question';
  qtext.innerHTML = escape_html(q.question || '');
  area.appendChild(qtext);

  // Options
  const opts = document.createElement('div');
  opts.className = 'options';
  const keys = Object.keys(q.options || {});
  for (const key of keys) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = `${key}. ${q.options[key]}`;
    // determine if already answered
    const answeredKey = answered[q.id];
    if (answeredKey) {
      btn.disabled = true;
      if (key === q.answer) btn.classList.add('correct');
      if (key === answeredKey && answeredKey !== q.answer) btn.classList.add('incorrect');
    } else {
      btn.addEventListener('click', () => {
        onSelect(btn, key, q.answer, q.id);
      });
    }
    opts.appendChild(btn);
  }
  area.appendChild(opts);

  // pager enable/disable
  document.getElementById('prevBtn').disabled = page === 0;
  document.getElementById('nextBtn').disabled = page >= filteredQuestions.length - 1;
  document.getElementById('finishBtn').classList.toggle('hidden', page !== filteredQuestions.length - 1);

  // small helpful note
  const help = document.createElement('div');
  help.className = 'muted';
  help.style.marginTop = '10px';
  help.innerText = 'Select an option to lock your answer. You can navigate using Previous/Next.';
  area.appendChild(help);
}

/* Selection handling */
function onSelect(btn, key, correct, qid) {
  if (answered[qid]) return;
  answered[qid] = key;

  if (key === correct) {
    correctCount++;
    btn.classList.add('correct');
  } else {
    wrongCount++;
    btn.classList.add('incorrect');
    // highlight correct button
    const parent = btn.parentElement;
    for (const b of parent.querySelectorAll('button')) {
      if (b.innerText.startsWith(correct + '.')) b.classList.add('correct');
    }
  }
  // disable all option buttons for this question
  for (const b of btn.parentElement.querySelectorAll('button')) b.disabled = true;

  updateScore();
}

/* Pagination */
document.getElementById('prevBtn').addEventListener('click', () => { if (page > 0) { page--; render(); } });
document.getElementById('nextBtn').addEventListener('click', () => { if (page < filteredQuestions.length - 1) { page++; render(); } });
document.getElementById('finishBtn').addEventListener('click', showResult);

/* Score UI */
function updateScore() {
  const el = document.getElementById('scoreBoard');
  el.classList.remove('hidden');
  el.innerText = `✅ Correct: ${correctCount}   |   ❌ Wrong: ${wrongCount}   |   Points: ${correctCount}`;
}

/* Search (filters within 'questions') */
function applySearch() {
  const term = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!term) {
    filteredQuestions = questions.slice();
  } else {
    filteredQuestions = questions.filter(q => (q.question || '').toLowerCase().includes(term) || Object.values(q.options || {}).some(opt => String(opt).toLowerCase().includes(term)));
  }
  page = 0;
  render();
}

/* Show final result */
function showResult() {
  document.getElementById('quizSection').classList.add('hidden');
  const res = document.getElementById('resultScreen');
  res.classList.remove('hidden');
  const total = filteredQuestions.length || questions.length || 0;
  const percentage = total ? Math.round((correctCount / total) * 100) : 0;
  res.innerHTML = `
    <div class="result-screen">
      <h2>🎉 Quiz Completed</h2>
      <div class="score">✅ Correct: ${correctCount}</div>
      <div class="score">❌ Wrong: ${wrongCount}</div>
      <div class="score">🏆 Points: ${correctCount}</div>
      <div class="score">📊 Score: ${percentage}% (${correctCount}/${total})</div>
      <div style="margin-top:14px; display:flex; gap:10px; justify-content:center;">
        <button class="btn btn-primary" onclick="restart()">Restart</button>
        <button class="btn btn-ghost" onclick="reviewAnswers()">Review Answers</button>
      </div>
    </div>
  `;
}

/* Restart to start screen */
function restart() {
  document.getElementById('resultScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  // keep range inputs as they were so user can tweak and re-apply
}

/* Optional quick review: show all answered questions with selected vs correct (simple list) */
function reviewAnswers() {
  // create a quick review screen replacing result
  const el = document.getElementById('resultScreen');
  el.classList.remove('hidden');
  const items = (questions || []).map(q => {
    const picked = answered[q.id] ?? '—';
    const correct = q.answer;
    return `<div style="padding:10px;border-radius:8px;margin:8px 0;background:#fff;border:1px solid #eef2f6;">
      <div style="font-weight:600">${escape_html(q.question || '')}</div>
      <div style="margin-top:6px;color:var(--muted)">Your answer: <strong style="${picked === correct ? 'color:var(--success)' : 'color:var(--danger)'}">${picked}</strong> | Correct: <strong>${correct}</strong></div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="card"><h3>Review Answers</h3>${items}<div style="margin-top:12px;"><button class="btn btn-primary" onclick="restart()">Back to Start</button></div></div>`;
}

/* Kick off */
load();

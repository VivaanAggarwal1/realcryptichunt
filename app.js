const $ = s => document.querySelector(s);

const LEVELS = [
  { id: 1,  prompt: 'I speak without a mouth and hear without ears. What am I?', answer: 'echo' },
  { id: 2,  prompt: 'Find hidden word in: C R Y P T I C — remove edges, read center.', answer: 'rypti' },
  { id: 3,  prompt: 'An anagram of “LISTEN” that is a verb.', answer: 'silent' },
  { id: 4,  prompt: 'Binary 01101000 01110101 01101110 01110100', answer: 'hunt' },
  { id: 5,  prompt: 'Clock puzzle: 3:15 smaller angle?', answer: '7.5' },
  { id: 6,  prompt: 'Vigenere key=RING. Cipher: VYYMZ QN. Plain?', answer: 'solve me' },
  { id: 7,  prompt: 'Acrostic of: Hidden Under Nightfall Trail', answer: 'hunt' },
  { id: 8,  prompt: 'MD5 given: 5d41402abc4b2a76b9719d911017c592', answer: 'hello' },
  { id: 9,  prompt: 'Roman: XIV + VI = ?', answer: '20' },
  { id: 10, prompt: 'Final: keyword from levels 1,4,7 combined.', answer: 'echohunthunt' }
];

const LS_KEYS = {
  USERS: 'ch_users',         // [{username, passHash, progress:{[level]: {is_solved, solved_at}}, highestSolved}]
  CURRENT: 'ch_current_user' // username
};

function norm(s) { return (s || '').toString().trim().toLowerCase(); }

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function loadUsers() { return JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '[]'); }
function saveUsers(users) { localStorage.setItem(LS_KEYS.USERS, JSON.stringify(users)); }
function setCurrent(username) { localStorage.setItem(LS_KEYS.CURRENT, username); }
function getCurrent() { return localStorage.getItem(LS_KEYS.CURRENT); }

function findUser(users, username) { return users.find(u => u.username === username); }

function ensureProgress(user) {
  if (!user.progress) user.progress = {};
  for (let i = 1; i <= LEVELS.length; i++) {
    if (!user.progress[i]) user.progress[i] = { is_solved: 0, solved_at: null };
  }
  user.highestSolved = Math.max(
    0,
    ...Object.entries(user.progress).filter(([,p]) => p.is_solved === 1).map(([lvl]) => parseInt(lvl, 10))
  );
}

function renderAuth(show) {
  $('#auth').classList.toggle('hidden', !show);
  $('#game').classList.toggle('hidden', show);
  $('#btn-login').classList.toggle('hidden', !show);
  $('#btn-logout').classList.toggle('hidden', show);
}

function renderLevels(user) {
  const container = $('#levels');
  container.innerHTML = '';
  for (let i = 1; i <= LEVELS.length; i++) {
    const div = document.createElement('div');
    div.className = 'level';
    const unlocked = i <= user.highestSolved + 1;
    const solved = user.progress[i].is_solved === 1;
    div.classList.toggle('unlocked', unlocked);
    div.classList.toggle('solved', solved);
    div.textContent = `Level ${i}`;
    if (unlocked) div.addEventListener('click', () => loadLevel(user, i));
    container.appendChild(div);
  }
  $('#progress-pill').textContent = `${user.highestSolved} / ${LEVELS.length}`;
}

function loadLevel(user, n) {
  const level = LEVELS[n - 1];
  const solved = user.progress[n].is_solved === 1;
  $('#level-title').textContent = `Level ${n}`;
  $('#prompt').textContent = level.prompt;
  $('#result').textContent = solved ? 'Correct' : '';
  $('#result').className = 'result ' + (solved ? 'ok' : '');
  $('#answer').value = '';
  $('#answer').focus();
  $('#answer-form').onsubmit = (e) => submitAnswer(e, user, n);
}

function updateLeaderboard(users) {
  // compute highest solved for each, and earliest timestamp at that max
  users.forEach(ensureProgress);
  const ranked = users
    .map(u => {
      const max = u.highestSolved || 0;
      let t = null;
      if (max > 0) {
        const p = u.progress[max];
        t = p && p.solved_at ? p.solved_at : null;
      }
      return { username: u.username, solved: max, tiebreak: t ?? Number.MAX_SAFE_INTEGER };
    })
    .sort((a,b) => b.solved - a.solved || a.tiebreak - b.tiebreak || a.username.localeCompare(b.username))
    .slice(0, 100);

  const tbody = document.querySelector('#board tbody');
  tbody.innerHTML = '';
  ranked.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.username}</td><td>${r.solved}</td>`;
    tbody.appendChild(tr);
  });
}

async function register(username, password) {
  const users = loadUsers();
  if (findUser(users, username)) return { ok: false, msg: 'Username taken' };
  const passHash = await sha256(password);
  const user = { username, passHash, progress: {}, highestSolved: 0 };
  ensureProgress(user);
  users.push(user);
  saveUsers(users);
  setCurrent(username);
  return { ok: true, user };
}

async function login(username, password) {
  const users = loadUsers();
  const u = findUser(users, username);
  if (!u) return { ok: false, msg: 'Invalid' };
  const passHash = await sha256(password);
  if (u.passHash !== passHash) return { ok: false, msg: 'Invalid' };
  setCurrent(username);
  return { ok: true, user: u };
}

function logout() { setCurrent(''); }

function getCurrentUser() {
  const users = loadUsers();
  const name = getCurrent();
  if (!name) return null;
  const u = findUser(users, name);
  if (!u) return null;
  ensureProgress(u);
  return u;
}

function saveUser(u) {
  const users = loadUsers();
  const idx = users.findIndex(x => x.username === u.username);
  if (idx >= 0) users[idx] = u;
  saveUsers(users);
  updateLeaderboard(users);
}

function bootGame(u) {
  $('#greet').textContent = `Welcome, ${u.username}`;
  renderAuth(false);
  ensureProgress(u);
  renderLevels(u);
  const next = (u.highestSolved || 0) + 1;
  loadLevel(u, Math.min(next, LEVELS.length));
  updateLeaderboard(loadUsers());
}

async function submitAnswer(e, user, n) {
  e.preventDefault();
  const val = $('#answer').value;
  if (!val) return;
  const correct = norm(val) === norm(LEVELS[n - 1].answer);
  if (correct) {
    if (user.progress[n].is_solved === 0) {
      user.progress[n] = { is_solved: 1, solved_at: Date.now() };
      user.highestSolved = Math.max(user.highestSolved, n);
      saveUser(user);
      renderLevels(user);
    }
    $('#result').textContent = 'Correct';
    $('#result').className = 'result ok';
    if (n < LEVELS.length) loadLevel(user, n + 1);
  } else {
    $('#result').textContent = 'Wrong';
    $('#result').className = 'result bad';
  }
}

// UI wiring
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = document.getElementById('auth-username').value.trim();
  const p = document.getElementById('auth-password').value;
  const r = await login(u, p);
  if (!r.ok) { document.getElementById('auth-msg').textContent = r.msg; return; }
  bootGame(getCurrentUser());
});

document.getElementById('register-btn').addEventListener('click', async () => {
  const u = document.getElementById('auth-username').value.trim();
  const p = document.getElementById('auth-password').value;
  const r = await register(u, p);
  if (!r.ok) { document.getElementById('auth-msg').textContent = r.msg; return; }
  bootGame(getCurrentUser());
});

document.getElementById('btn-login').addEventListener('click', () => {
  document.getElementById('auth').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('btn-logout').addEventListener('click', () => {
  logout();
  renderAuth(true);
});

// boot
(function init() {
  const u = getCurrentUser();
  if (u) bootGame(u); else renderAuth(true);
})();

// ----- DOM helpers -----
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const show = id => { $$('.screen').forEach(x=>x.classList.remove('visible')); $(`#screen-${id}`).classList.add('visible'); };

// ----- Data (client-only) -----
const LEVELS = [
  { id:1,  prompt:'I speak without a mouth and hear without ears. What am I?', answer:'echo' },
  { id:2,  prompt:'Find hidden word in: C R Y P T I C — remove edges, read center.', answer:'rypti' },
  { id:3,  prompt:'An anagram of “LISTEN” that is a verb.', answer:'silent' },
  { id:4,  prompt:'Binary 01101000 01110101 01101110 01110100', answer:'hunt' },
  { id:5,  prompt:'Clock puzzle: 3:15 smaller angle?', answer:'7.5' },
  { id:6,  prompt:'Vigenere key=RING. Cipher: VYYMZ QN. Plain?', answer:'solve me' },
  { id:7,  prompt:'Acrostic of: Hidden Under Nightfall Trail', answer:'hunt' },
  { id:8,  prompt:'MD5 given: 5d41402abc4b2a76b9719d911017c592', answer:'hello' },
  { id:9,  prompt:'Roman: XIV + VI = ?', answer:'20' },
  { id:10, prompt:'Final: keyword from levels 1,4,7 combined.', answer:'echohunthunt' },
];

const LS = { USERS:'ch_users', CURRENT:'ch_current_user', NOTES:'ch_notes_' };

const norm = s => (s||'').toString().trim().toLowerCase();
async function sha256(x){ const b=new TextEncoder().encode(x); const h=await crypto.subtle.digest('SHA-256',b); return [...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,'0')).join(''); }

function loadUsers(){ return JSON.parse(localStorage.getItem(LS.USERS)||'[]'); }
function saveUsers(u){ localStorage.setItem(LS.USERS, JSON.stringify(u)); }
function setCurrent(name){ localStorage.setItem(LS.CURRENT, name); }
function getCurrent(){ return localStorage.getItem(LS.CURRENT)||''; }
function findUser(list,name){ return list.find(u=>u.username===name); }
function ensureProgress(u){
  if(!u.progress) u.progress={};
  for(let i=1;i<=LEVELS.length;i++){ if(!u.progress[i]) u.progress[i]={is_solved:0, solved_at:null}; }
  u.highestSolved = Math.max(0, ...Object.entries(u.progress).filter(([,p])=>p.is_solved===1).map(([k])=>+k));
}

// ----- UI State -----
let currentUser = null;
let currentLevel = 1;

// ----- Screens / Nav -----
function bindNav(){
  $('[data-nav="welcome"]').onclick = ()=>show('welcome');
  $('#nav-game').onclick = ()=>show('game');
  $('#nav-board').onclick = ()=>{ updateLeaderboard(loadUsers()); show('board'); };
  $('#hero-start').onclick = ()=>show('auth');
  $('#btn-login').onclick = ()=>show('auth');
  $('#btn-logout').onclick = ()=>{ setCurrent(''); currentUser=null; $('#btn-login').classList.remove('hidden'); $('#btn-logout').classList.add('hidden'); $('#nav-game').classList.add('hidden'); $('#nav-board').classList.add('hidden'); show('welcome'); };
  $('#refresh-board').onclick = ()=>updateLeaderboard(loadUsers());
  $$('[data-nav="board"]').forEach(b=>b.onclick=()=>{ updateLeaderboard(loadUsers()); show('board'); });
}

// ----- Auth -----
async function register(username,password){
  const users=loadUsers();
  if(findUser(users,username)) return {ok:false,msg:'Username taken'};
  const passHash = await sha256(password);
  const u={username, passHash, progress:{}, highestSolved:0};
  ensureProgress(u);
  users.push(u); saveUsers(users); setCurrent(username); return {ok:true,user:u};
}
async function login(username,password){
  const users=loadUsers();
  const u=findUser(users,username); if(!u) return {ok:false,msg:'Invalid'};
  if(u.passHash!==await sha256(password)) return {ok:false,msg:'Invalid'};
  setCurrent(username); return {ok:true,user:u};
}

function wireAuth(){
  $('#auth-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const u=$('#auth-username').value.trim();
    const p=$('#auth-password').value;
    const r=await login(u,p);
    if(!r.ok){ $('#auth-msg').textContent=r.msg; return; }
    onLogin();
  });
  $('#register-btn').addEventListener('click', async ()=>{
    const u=$('#auth-username').value.trim();
    const p=$('#auth-password').value;
    const r=await register(u,p);
    if(!r.ok){ $('#auth-msg').textContent=r.msg; return; }
    onLogin();
  });
}

function onLogin(){
  currentUser = getCurrentUser();
  $('#btn-login').classList.add('hidden');
  $('#btn-logout').classList.remove('hidden');
  $('#nav-game').classList.remove('hidden');
  $('#nav-board').classList.remove('hidden');
  bootGame();
  show('game');
}

function getCurrentUser(){
  const users=loadUsers(); const name=getCurrent();
  if(!name) return null; const u=findUser(users,name); if(!u) return null; ensureProgress(u); return u;
}
function saveUser(u){
  const users=loadUsers(); const i=users.findIndex(x=>x.username===u.username);
  if(i>=0) users[i]=u; saveUsers(users);
}

// ----- Game -----
function bootGame(){
  currentUser = getCurrentUser();
  if(!currentUser) return;
  $('#greet').textContent = `Welcome, ${currentUser.username}`;
  renderLevels();
  currentLevel = Math.min((currentUser.highestSolved||0)+1, LEVELS.length);
  loadLevel(currentLevel);
  restoreNotes();
}

function renderLevels(){
  const el=$('#levels'); el.innerHTML='';
  for(let i=1;i<=LEVELS.length;i++){
    const unlocked = i <= currentUser.highestSolved + 1;
    const solved   = currentUser.progress[i].is_solved===1;
    const div=document.createElement('div');
    div.className='level'; if(unlocked) div.classList.add('unlocked'); if(solved) div.classList.add('solved');
    div.innerHTML=`<span>Level ${i}</span><span class="go">${solved?'Solved':'Go'}</span>`;
    if(unlocked) div.onclick=()=>loadLevel(i);
    el.appendChild(div);
  }
  $('#progress-pill').textContent = `${currentUser.highestSolved} / ${LEVELS.length}`;
}

function loadLevel(n){
  currentLevel=n;
  const data=LEVELS[n-1];
  $('#level-title').textContent=`Level ${n}`;
  $('#prompt').textContent=data.prompt;
  const solved=currentUser.progress[n].is_solved===1;
  $('#result').textContent = solved ? 'Correct' : '';
  $('#result').className = 'result ' + (solved?'ok':'');
  $('#answer').value=''; $('#answer').focus();

  $('#answer-form').onsubmit = (e)=>submitAnswer(e);
}

function submitAnswer(e){
  e.preventDefault();
  const val=$('#answer').value;
  if(!val) return;
  const correct = norm(val)===norm(LEVELS[currentLevel-1].answer);
  if(correct){
    if(currentUser.progress[currentLevel].is_solved===0){
      currentUser.progress[currentLevel]={is_solved:1, solved_at:Date.now()};
      currentUser.highestSolved=Math.max(currentUser.highestSolved,currentLevel);
      saveUser(currentUser);
      renderLevels();
    }
    $('#result').textContent='Correct'; $('#result').className='result ok';
    if(currentLevel<LEVELS.length) loadLevel(currentLevel+1);
  }else{
    $('#result').textContent='Wrong'; $('#result').className='result bad';
  }
}

// ----- Notes -----
function keyNotes(){ return LS.NOTES + (currentUser?currentUser.username:''); }
function restoreNotes(){ $('#notes').value = localStorage.getItem(keyNotes()) || ''; }
$('#notes').addEventListener('input', ()=>{ localStorage.setItem(keyNotes(), $('#notes').value); });

// ----- Leaderboard -----
function updateLeaderboard(users){
  users.forEach(ensureProgress);
  const ranked = users
    .map(u=>{
      const max=u.highestSolved||0;
      const t=max>0?(u.progress[max]?.solved_at||Number.MAX_SAFE_INTEGER):Number.MAX_SAFE_INTEGER;
      return {user:u.username, solved:max, tiebreak:t};
    })
    .sort((a,b)=> b.solved-a.solved || a.tiebreak-b.tiebreak || a.user.localeCompare(b.user))
    .slice(0,100);

  const tbody = $('#board tbody'); tbody.innerHTML='';
  ranked.forEach((r,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${r.user}</td><td>${r.solved}</td>`;
    tbody.appendChild(tr);
  });
}

// ----- Boot -----
function init(){
  bindNav();
  wireAuth();
  const u=getCurrentUser();
  if(u){ onLogin(); } else { show('welcome'); }
}
document.addEventListener('DOMContentLoaded', init);

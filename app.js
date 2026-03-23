/* ═══════════════════════════════════════════
   NekoTime v2.0 — app.js
   AniList GraphQL + Auto-Translate (ID)
   ═══════════════════════════════════════════ */
'use strict';

/* ── CONSTANTS ────────────────────────────── */
const API = 'https://graphql.anilist.co';
const WIB = 7 * 3600; // UTC+7 in seconds

const DAYS_ID  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
const SEASON_ID = {WINTER:'Musim Dingin',SPRING:'Musim Semi',SUMMER:'Musim Panas',FALL:'Musim Gugur'};
const STATUS_ID = {RELEASING:'Sedang Tayang',FINISHED:'Selesai',NOT_YET_RELEASED:'Belum Rilis',CANCELLED:'Dibatalkan',HIATUS:'Hiatus'};
const ROLE_ID   = {MAIN:'Karakter Utama',SUPPORTING:'Karakter Pendukung',BACKGROUND:'Karakter Latar'};

const GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'];

/* ── STATE ────────────────────────────────── */
const S = {
  page: 'jadwal',
  atab: 'ongoing',
  day: new Date().getDay(),
  schedule: {},
  ongoing: [],
  upcoming: [],
  upPage: 1,
  upMore: true,
  upBusy: false,
  charts: [],
  chartSort: 'SCORE_DESC',
  sort: 'POPULARITY_DESC',
  genres: [],
  searchQ: '',
  searchTimer: null,
  genreOpen: false,
  favs: JSON.parse(localStorage.getItem('nk_favs') || '[]'),
  tracker: JSON.parse(localStorage.getItem('nk_tracker') || '[]'),
  cache: {},
  theme: localStorage.getItem('nk_theme') || 'dark',
  _schedTick: null,
  _upTick: null,
};

/* ── TRANSLATION DICTIONARY ──────────────── */
// Translate common English phrases in descriptions to Indonesian
const TRANSLATE_MAP = [
  [/\b(the story follows)\b/gi,'kisah mengikuti'],
  [/\b(based on)\b/gi,'berdasarkan'],
  [/\b(manga|light novel)\b/gi,m=>m],
  [/\b(high school)\b/gi,'sekolah menengah'],
  [/\b(middle school)\b/gi,'sekolah menengah pertama'],
  [/\b(elementary school)\b/gi,'sekolah dasar'],
  [/\b(main character|protagonist)\b/gi,'karakter utama'],
  [/\b(mysterious)\b/gi,'misterius'],
  [/\b(adventure)\b/gi,'petualangan'],
  [/\b(demon)\b/gi,'iblis'],
  [/\b(demons)\b/gi,'para iblis'],
  [/\b(dragon)\b/gi,'naga'],
  [/\b(dragons)\b/gi,'para naga'],
  [/\b(magic)\b/gi,'sihir'],
  [/\b(magical)\b/gi,'ajaib'],
  [/\b(battle)\b/gi,'pertempuran'],
  [/\b(battles)\b/gi,'pertempuran-pertempuran'],
  [/\b(war)\b/gi,'perang'],
  [/\b(kingdom)\b/gi,'kerajaan'],
  [/\b(hero)\b/gi,'pahlawan'],
  [/\b(heroes)\b/gi,'para pahlawan'],
  [/\b(sword)\b/gi,'pedang'],
  [/\b(power)\b/gi,'kekuatan'],
  [/\b(powerful)\b/gi,'sangat kuat'],
  [/\b(school)\b/gi,'sekolah'],
  [/\b(student)\b/gi,'murid'],
  [/\b(students)\b/gi,'para murid'],
  [/\b(teacher)\b/gi,'guru'],
  [/\b(friend)\b/gi,'teman'],
  [/\b(friends)\b/gi,'teman-teman'],
  [/\b(family)\b/gi,'keluarga'],
  [/\b(sister)\b/gi,'saudari'],
  [/\b(brother)\b/gi,'saudara'],
  [/\b(mother)\b/gi,'ibu'],
  [/\b(father)\b/gi,'ayah'],
  [/\b(love)\b/gi,'cinta'],
  [/\b(romance)\b/gi,'romansa'],
  [/\b(romantic)\b/gi,'romantis'],
  [/\b(world)\b/gi,'dunia'],
  [/\b(universe)\b/gi,'alam semesta'],
  [/\b(strong)\b/gi,'kuat'],
  [/\b(weakness)\b/gi,'kelemahan'],
  [/\b(dark)\b/gi,'gelap'],
  [/\b(light)\b/gi,'cahaya'],
  [/\b(evil)\b/gi,'kejahatan'],
  [/\b(good)\b/gi,'kebaikan'],
  [/\b(truth)\b/gi,'kebenaran'],
  [/\b(secret)\b/gi,'rahasia'],
  [/\b(fate)\b/gi,'takdir'],
  [/\b(destiny)\b/gi,'nasib'],
  [/\b(journey)\b/gi,'perjalanan'],
  [/\b(mission)\b/gi,'misi'],
  [/\b(tournament)\b/gi,'turnamen'],
  [/\b(competition)\b/gi,'kompetisi'],
  [/\b(academy)\b/gi,'akademi'],
  [/\b(guild)\b/gi,'gilda'],
  [/\b(spirit)\b/gi,'roh'],
  [/\b(soul)\b/gi,'jiwa'],
  [/\b(ancient)\b/gi,'kuno'],
  [/\b(legendary)\b/gi,'legendaris'],
  [/\b(protect)\b/gi,'melindungi'],
  [/\b(protect(ing|s)?)\b/gi,'melindungi'],
  [/\b(fight(ing|s)?)\b/gi,'bertarung'],
  [/\b(survive(s)?)\b/gi,'bertahan hidup'],
  [/\b(discover(s|ed)?)\b/gi,'menemukan'],
  [/\b(become(s)?)\b/gi,'menjadi'],
  [/\b(meet(s)?)\b/gi,'bertemu'],
  [/\b(join(s|ed)?)\b/gi,'bergabung'],
  [/\b(born)\b/gi,'lahir'],
  [/\b(life)\b/gi,'kehidupan'],
  [/\b(death)\b/gi,'kematian'],
  [/\b(dead)\b/gi,'mati'],
  [/\b(alive)\b/gi,'hidup'],
  [/\b(human(s)?)\b/gi,(m)=>m.endsWith('s')?'manusia-manusia':'manusia'],
  [/\b(monster(s)?)\b/gi,(m)=>m.endsWith('s')?'para monster':'monster'],
  [/\b(enemy)\b/gi,'musuh'],
  [/\b(enemies)\b/gi,'para musuh'],
  [/\b(princess)\b/gi,'putri'],
  [/\b(prince)\b/gi,'pangeran'],
  [/\b(king)\b/gi,'raja'],
  [/\b(queen)\b/gi,'ratu'],
  [/\b(knight)\b/gi,'ksatria'],
  [/\b(ninja)\b/gi,'ninja'],
  [/\b(samurai)\b/gi,'samurai'],
  [/\b(warrior)\b/gi,'pejuang'],
  [/\b(wizard)\b/gi,'penyihir'],
  [/\b(witch)\b/gi,'penyihir wanita'],
  [/\b(vampire)\b/gi,'vampir'],
  [/\b(ghost)\b/gi,'hantu'],
  [/\b(ability|abilities)\b/gi,'kemampuan'],
  [/\b(special)\b/gi,'istimewa'],
  [/\b(unique)\b/gi,'unik'],
  [/\b(ordinary)\b/gi,'biasa'],
  [/\b(normal)\b/gi,'normal'],
  [/\b(however)\b/gi,'namun'],
  [/\b(suddenly)\b/gi,'tiba-tiba'],
  [/\b(eventually)\b/gi,'akhirnya'],
  [/\b(soon)\b/gi,'segera'],
  [/\b(after)\b/gi,'setelah'],
  [/\b(before)\b/gi,'sebelum'],
  [/\b(during)\b/gi,'selama'],
  [/\b(while)\b/gi,'sementara'],
  [/\b(when)\b/gi,'ketika'],
  [/\b(where)\b/gi,'di mana'],
  [/\b(because)\b/gi,'karena'],
  [/\b(although)\b/gi,'meskipun'],
  [/\b(despite)\b/gi,'meskipun'],
  [/\b(together)\b/gi,'bersama'],
  [/\b(alone)\b/gi,'sendiri'],
  [/\b(new)\b/gi,'baru'],
  [/\b(old)\b/gi,'tua'],
  [/\b(young)\b/gi,'muda'],
  [/\b(first)\b/gi,'pertama'],
  [/\b(last)\b/gi,'terakhir'],
  [/\b(only)\b/gi,'satu-satunya'],
  [/\b(true)\b/gi,'sejati'],
  [/\b(false)\b/gi,'palsu'],
  [/\b(city)\b/gi,'kota'],
  [/\b(town)\b/gi,'kota kecil'],
  [/\b(village)\b/gi,'desa'],
  [/\b(forest)\b/gi,'hutan'],
  [/\b(ocean|sea)\b/gi,'laut'],
  [/\b(sky)\b/gi,'langit'],
  [/\b(earth|land)\b/gi,'bumi'],
  [/\b(time)\b/gi,'waktu'],
  [/\b(year(s)?)\b/gi,(m)=>m.endsWith('s')?'tahun-tahun':'tahun'],
  [/\b(day(s)?)\b/gi,(m)=>m.endsWith('s')?'hari-hari':'hari'],
  [/\b(night)\b/gi,'malam'],
  [/\b(past)\b/gi,'masa lalu'],
  [/\b(future)\b/gi,'masa depan'],
  [/\b(present)\b/gi,'saat ini'],
  [/\b(story)\b/gi,'cerita'],
  [/\b(stories)\b/gi,'cerita-cerita'],
  [/\b(dream(s)?)\b/gi,'mimpi'],
  [/\b(hope(s)?)\b/gi,'harapan'],
  [/\b(peace)\b/gi,'kedamaian'],
  [/\b(freedom)\b/gi,'kebebasan'],
  [/\b(justice)\b/gi,'keadilan'],
  [/\b(courage)\b/gi,'keberanian'],
  [/\b(loyalty)\b/gi,'kesetiaan'],
  [/\b(betrayal)\b/gi,'pengkhianatan'],
  [/\b(revenge)\b/gi,'balas dendam'],
  [/\b(sacrifice)\b/gi,'pengorbanan'],
  [/\b(protect)\b/gi,'melindungi'],
];

function autoTranslate(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text;
  for (const [pattern, replacement] of TRANSLATE_MAP) {
    t = t.replace(pattern, replacement);
  }
  return t;
}

function hasEnglish(text) {
  if (!text) return false;
  // If more than 30% of words are common English words, flag as English
  const englishWords = /\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|its|their|his|her|our|your|my|this|that|these|those|which|who|whom|what|when|where|how|why|and|but|or|nor|for|yet|so|in|on|at|to|for|with|by|from|of|about|into|through|during|before|after|above|below|between|among|such|than|then|if|because|although|while|as|until|unless|since|though)\b/gi;
  const matches = (text.match(englishWords) || []).length;
  const words = (text.match(/\b\w+\b/g) || []).length;
  return words > 0 && (matches / words) > 0.15;
}

/* ── GQL HELPER ───────────────────────────── */
async function gql(query, vars = {}) {
  const r = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({query, variables: vars}),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

/* ── TIME HELPERS ─────────────────────────── */
function wib(ts) { return new Date((ts + WIB) * 1000); }
function wibDay(ts) { return wib(ts).getUTCDay(); }
function wibHM(ts) {
  const d = wib(ts);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} WIB`;
}
function now() { return Math.floor(Date.now()/1000); }
function fmtCd(s) {
  if (s <= 0) return 'Selesai';
  const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sc=s%60;
  if (d > 0) return `${d}h ${pad(h)}j ${pad(m)}m`;
  return `${pad(h)}:${pad(m)}:${pad(sc)}`;
}
function fmtCdFull(s) {
  if (s <= 0) return 'Selesai';
  const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sc=s%60;
  return `${d}h ${pad(h)}j ${pad(m)}m ${pad(sc)}d`;
}
function pad(n) { return String(n).padStart(2,'0'); }
function fmtDate(obj) {
  if (!obj?.year) return 'TBA';
  const m = obj.month ? MONTHS_ID[obj.month-1]+' ' : '';
  const d = obj.day ? obj.day+' ' : '';
  return `${d}${m}${obj.year}`;
}
function dateToTs(obj) {
  if (!obj?.year) return null;
  return Math.floor(new Date(obj.year, (obj.month||1)-1, obj.day||1).getTime()/1000);
}

/* ── THEME ────────────────────────────────── */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('nk_theme', t);
  S.theme = t;
}
document.getElementById('theme-toggle').onclick = () => applyTheme(S.theme === 'dark' ? 'light' : 'dark');

/* ── LIVE CLOCK ───────────────────────────── */
function startClock() {
  const el = document.getElementById('live-clock');
  setInterval(() => {
    const d = new Date(Date.now() + WIB*1000);
    el.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }, 1000);
}

/* ── TOAST ────────────────────────────────── */
function toast(msg, icon='✨') {
  const w = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  w.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 300); }, 2600);
}

/* ── NAVIGATION ───────────────────────────── */
document.querySelectorAll('.nbtn').forEach(b => {
  b.addEventListener('click', () => navTo(b.dataset.page));
});

function navTo(page) {
  S.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nbtn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`.nbtn[data-page="${page}"]`).classList.add('active');
  window.scrollTo(0,0);
  if (page === 'jadwal' && !Object.keys(S.schedule).length) loadSchedule();
  if (page === 'anime' && !S.ongoing.length) loadOngoing();
  if (page === 'profile') renderProfile();
}

/* ── MODAL ────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('anime-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('anime-modal')) closeModal('anime-modal');
});
document.getElementById('char-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('char-modal')) closeModal('char-modal');
});

/* ── SKELETON HELPERS ─────────────────────── */
function skCard() {
  return `<div class="ap-card"><div class="sk" style="aspect-ratio:2/3"></div><div style="padding:10px"><div class="sk" style="height:12px;width:80%;margin-bottom:7px"></div><div class="sk" style="height:10px;width:55%"></div></div></div>`;
}
function skSch() {
  return `<div class="sch-card" style="padding:12px;gap:12px"><div class="sk" style="width:64px;height:88px;border-radius:10px;flex-shrink:0"></div><div style="flex:1"><div class="sk" style="height:13px;width:75%;margin-bottom:8px"></div><div class="sk" style="height:11px;width:50%;margin-bottom:8px"></div><div class="sk" style="height:11px;width:60%"></div></div></div>`;
}

/* ── SCHEDULE PAGE ────────────────────────── */
function buildDayTabs() {
  const now_day = new Date().getDay();
  const badge = document.getElementById('today-badge');
  badge.textContent = DAYS_ID[now_day];

  const c = document.getElementById('day-tabs');
  c.innerHTML = DAYS_ID.map((d,i) => `<button class="dtab${i===S.day?' active':''}" data-d="${i}">${d}</button>`).join('');
  c.querySelectorAll('.dtab').forEach(b => {
    b.onclick = () => {
      c.querySelectorAll('.dtab').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      S.day = +b.dataset.d;
      renderDay(S.day);
    };
  });
}

async function loadSchedule() {
  const list = document.getElementById('sch-list');
  list.innerHTML = Array(5).fill(skSch()).join('');
  try {
    const n = now();
    const data = await gql(`
      query($ws:Int,$we:Int){Page(page:1,perPage:50){airingSchedules(airingAt_greater:$ws,airingAt_lesser:$we,sort:TIME){
        id airingAt episode timeUntilAiring
        media{id title{romaji english} coverImage{medium large} genres averageScore status episodes}
      }}}`, { ws: n - 7*86400, we: n + 7*86400 });
    
    DAYS_ID.forEach((_,i) => S.schedule[i] = []);
    for (const s of (data.Page.airingSchedules || [])) {
      const d = wibDay(s.airingAt);
      if (!S.schedule[d].find(x => x.media.id === s.media.id && x.episode === s.episode))
        S.schedule[d].push(s);
    }
    renderDay(S.day);
  } catch(e) { list.innerHTML = errUI('Gagal memuat jadwal.'); }
}

function renderDay(d) {
  const list = document.getElementById('sch-list');
  const items = (S.schedule[d] || []).sort((a,b) => a.airingAt - b.airingAt);
  if (!items.length) {
    list.innerHTML = `<div style="text-align:center;padding:64px 0;color:var(--txt2)"><div style="font-size:40px;margin-bottom:12px">📭</div><p style="font-weight:600">Tidak ada jadwal hari ini</p></div>`;
    return;
  }
  list.innerHTML = items.map(it => schCard(it)).join('');
  tickSchedule();
}

function schCard(it) {
  const {airingAt, episode, media} = it;
  const n = now(), left = airingAt - n;
  const title = media.title.english || media.title.romaji;
  const cover = media.coverImage?.medium || media.coverImage?.large;
  const score = media.averageScore ? (media.averageScore/10).toFixed(1) : 'N/A';
  const genres = (media.genres||[]).slice(0,2).map(g=>`<span class="b-acc" style="font-size:9px">${g}</span>`).join('');
  let stCls, stTxt;
  if (left > 0) { stCls='b-blu'; stTxt='Akan Tayang'; }
  else if (left > -3600) { stCls='b-grn'; stTxt='🔴 Sedang Tayang'; }
  else { stCls='b-gray'; stTxt='Selesai'; }
  return `
  <div class="sch-card" onclick="openAnimeDetail(${media.id})">
    <img src="${cover}" onerror="this.src='https://via.placeholder.com/64x88/111122/7878aa?text=N/A'" loading="lazy"
      style="width:64px;height:88px;object-fit:cover;border-radius:12px 0 0 12px;flex-shrink:0"/>
    <div style="flex:1;padding:12px;min-width:0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:5px">
        <h3 style="font-size:14px;font-weight:700;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${title}</h3>
        <span style="font-size:12px;font-weight:800;color:var(--gld);flex-shrink:0">★${score}</span>
      </div>
      <p style="font-size:12px;color:var(--txt2);margin-bottom:7px">Ep. <strong style="color:var(--txt)">${episode}</strong> &nbsp;•&nbsp; ${wibHM(airingAt)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">${genres}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="${stCls}" style="border-radius:99px;font-size:10px;padding:2px 8px">${stTxt}</span>
        ${left > 0 ? `<span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--acc)" data-cd="${airingAt}">${fmtCd(left)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function tickSchedule() {
  if (S._schedTick) clearInterval(S._schedTick);
  S._schedTick = setInterval(() => {
    const n = now();
    document.querySelectorAll('[data-cd]').forEach(el => {
      const t = +el.dataset.cd, left = t - n;
      el.textContent = left > 0 ? fmtCd(left) : '🔴 Live';
      if (left <= 0) el.style.color = 'var(--grn)';
    });
  }, 1000);
}

/* ── ANIME PAGE ────────────────────────────── */
// Genre
const GENRE_CHIPS_EL = document.getElementById('genre-wrap') || document.createElement('div');

function buildGenreChips() {
  const el = document.getElementById('genre-wrap');
  el.innerHTML = GENRES.map(g => `<button class="g-chip" data-g="${g}">${g}</button>`).join('');
  el.querySelectorAll('.g-chip').forEach(b => {
    b.onclick = () => {
      b.classList.toggle('active');
      const g = b.dataset.g;
      S.genres = S.genres.includes(g) ? S.genres.filter(x=>x!==g) : [...S.genres, g];
      const cnt = document.getElementById('g-count');
      if (S.genres.length > 0) { cnt.style.display='flex'; cnt.textContent=S.genres.length; }
      else cnt.style.display='none';
      reloadAnime();
    };
  });
}

document.getElementById('genre-btn').onclick = () => {
  S.genreOpen = !S.genreOpen;
  document.getElementById('genre-wrap').style.display = S.genreOpen ? 'flex' : 'none';
};

// Sort buttons
document.querySelectorAll('.s-btn[data-sort]').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.s-btn[data-sort]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); S.sort = b.dataset.sort;
    reloadAnime();
  };
});

// Anime sub-tabs
document.querySelectorAll('.atab').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.atab').forEach(x=>{ x.classList.remove('active'); x.style.color='var(--txt2)'; x.style.borderBottomColor='transparent'; });
    b.classList.add('active'); b.style.color='var(--acc)'; b.style.borderBottomColor='var(--acc)';
    const tab = b.dataset.atab; S.atab = tab;
    ['ongoing','upcoming','charts','tracker'].forEach(t => {
      document.getElementById(`tab-${t}`).style.display = t===tab ? 'block' : 'none';
    });
    if (tab==='upcoming' && !S.upcoming.length) loadUpcoming();
    if (tab==='charts' && !S.charts.length) loadCharts();
    if (tab==='tracker') renderTracker();
    document.getElementById('search-panel').style.display='none';
  };
});

function reloadAnime() {
  if (S.atab==='ongoing') { S.ongoing=[]; document.getElementById('ongoing-grid').innerHTML=Array(6).fill(skCard()).join(''); loadOngoing(); }
  else if (S.atab==='upcoming') { S.upcoming=[]; S.upPage=1; S.upMore=true; document.getElementById('upcoming-list').innerHTML=''; loadUpcoming(); }
  else if (S.atab==='charts') { S.charts=[]; loadCharts(); }
}

/* ── ONGOING ──────────────────────────────── */
async function loadOngoing() {
  const grid = document.getElementById('ongoing-grid');
  if (!S.ongoing.length) grid.innerHTML = Array(6).fill(skCard()).join('');
  try {
    const data = await gql(`
      query($page:Int,$sort:[MediaSort],$gen:[String]){Page(page:$page,perPage:20){media(
        type:ANIME,status:RELEASING,sort:$sort,genre_in:$gen,isAdult:false
      ){id title{romaji english} coverImage{extraLarge large medium} genres averageScore episodes
        nextAiringEpisode{airingAt episode timeUntilAiring} description(asHtml:false)
        trailer{id site} bannerImage
        characters(sort:[ROLE,RELEVANCE],perPage:8){edges{role node{id name{full} image{large medium} description dateOfBirth{year month day}}}}
      }}}`,
      { page:1, sort:[S.sort], gen: S.genres.length?S.genres:undefined });
    S.ongoing = data.Page.media || [];
    renderOngoing();
  } catch(e) { grid.innerHTML = `<div style="grid-column:1/-1">${errUI('Gagal memuat anime.')}</div>`; }
}

function renderOngoing() {
  const grid = document.getElementById('ongoing-grid');
  if (!S.ongoing.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--txt2)"><div style="font-size:36px;margin-bottom:10px">🔍</div><p>Tidak ada hasil.</p></div>`;
    return;
  }
  grid.innerHTML = S.ongoing.map(a => posterCard(a)).join('');
  tickUpcoming();
}

function posterCard(a) {
  const title = a.title.english || a.title.romaji;
  const cover = a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium;
  const score = a.averageScore ? (a.averageScore/10).toFixed(1) : 'N/A';
  const genres = (a.genres||[]).slice(0,2).map(g=>`<span class="b-acc" style="font-size:8px;padding:1px 5px">${g}</span>`).join('');
  const faved = S.favs.some(f=>f.id===a.id);
  const nep = a.nextAiringEpisode;
  return `
  <div class="ap-card" onclick="openAnimeDetail(${a.id})">
    <div style="position:relative">
      <img src="${cover}" onerror="this.src='https://via.placeholder.com/200x300/111122/7878aa?text=N/A'" loading="lazy" style="aspect-ratio:2/3;object-fit:cover;width:100%;display:block"/>
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(8,8,16,.9) 0%,transparent 55%)"></div>
      <button class="fav-btn${faved?' faved':''}" data-fid="${a.id}" onclick="event.stopPropagation();toggleFav(${a.id},'${esc(title)}','${cover}')"
        style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:rgba(0,0,0,.6);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="14" height="14" fill="${faved?'var(--acc)':'none'}" stroke="${faved?'var(--acc)':'white'}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
      </button>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:8px"><div style="display:flex;flex-wrap:wrap;gap:4px">${genres}</div></div>
    </div>
    <div style="padding:8px 10px 10px">
      <p style="font-size:12px;font-weight:700;line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;margin-bottom:4px">${title}</p>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;font-weight:800;color:var(--gld)">★ ${score}</span>
        ${a.episodes?`<span style="font-size:10px;color:var(--txt2)">${a.episodes} ep</span>`:''}
      </div>
      ${nep?`<p style="font-size:10px;color:var(--txt2);margin-top:4px">Ep.${nep.episode} · <span style="color:var(--acc);font-family:'JetBrains Mono',monospace" data-cdep="${nep.airingAt}">${fmtCd(nep.timeUntilAiring)}</span></p>`:''}
    </div>
  </div>`;
}

/* ── UPCOMING ─────────────────────────────── */
async function loadUpcoming() {
  if (S.upBusy || !S.upMore) return;
  S.upBusy = true;
  document.getElementById('up-spin').style.display = 'flex';
  try {
    const data = await gql(`
      query($page:Int,$sort:[MediaSort],$gen:[String]){Page(page:$page,perPage:20){
        pageInfo{hasNextPage}
        media(type:ANIME,status:NOT_YET_RELEASED,sort:$sort,genre_in:$gen,isAdult:false){
          id title{romaji english} coverImage{extraLarge large medium} genres averageScore description(asHtml:false)
          startDate{year month day} trailer{id site} bannerImage
          characters(sort:[ROLE,RELEVANCE],perPage:6){edges{role node{id name{full} image{large} description dateOfBirth{year month day}}}}
        }}}`,
      { page:S.upPage, sort:[S.sort], gen:S.genres.length?S.genres:undefined });
    const {media, pageInfo} = data.Page;
    S.upcoming.push(...(media||[]));
    S.upMore = pageInfo.hasNextPage;
    S.upPage++;
    renderUpcomingBatch(media||[]);
  } catch(e) { toast('Gagal memuat upcoming.','⚠️'); }
  finally { S.upBusy=false; document.getElementById('up-spin').style.display='none'; }
}

function renderUpcomingBatch(items) {
  const list = document.getElementById('upcoming-list');
  items.forEach(a => {
    const div = document.createElement('div');
    div.className = 'up-card';
    div.onclick = () => openAnimeDetail(a.id);
    div.innerHTML = upCard(a);
    list.appendChild(div);
  });
  tickUpcoming();
}

function upCard(a) {
  const title = a.title.english || a.title.romaji;
  const cover = a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium;
  const score = a.averageScore ? (a.averageScore/10).toFixed(1) : 'TBA';
  const genres = (a.genres||[]).slice(0,3).map(g=>`<span class="b-blu" style="font-size:9px">${g}</span>`).join('');
  const rawDesc = (a.description||'').replace(/<[^>]*>/g,'');
  const desc = hasEnglish(rawDesc) ? autoTranslate(rawDesc) : rawDesc;
  const releaseDate = fmtDate(a.startDate);
  const releaseTs = dateToTs(a.startDate);
  const faved = S.favs.some(f=>f.id===a.id);
  let cdHtml = '';
  if (releaseTs) {
    const left = releaseTs - now();
    if (left > 0) cdHtml = `<span class="b-acc" style="font-size:9px;border-radius:99px" data-rcd="${releaseTs}">${fmtCdFull(left)}</span>`;
  }
  return `
  <div style="display:flex;gap:12px;padding:12px">
    <img src="${cover}" onerror="this.src='https://via.placeholder.com/72x104/111122/7878aa?text=N/A'" loading="lazy"
      style="width:72px;height:104px;object-fit:cover;border-radius:10px;flex-shrink:0"/>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:5px">
        <h3 style="font-size:14px;font-weight:700;line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1">${title}</h3>
        <button class="fav-btn${faved?' faved':''}" data-fid="${a.id}" onclick="event.stopPropagation();toggleFav(${a.id},'${esc(title)}','${cover}')"
          style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--card2);border:1px solid var(--bdr);cursor:pointer;display:flex;align-items:center;justify-content:center">
          <svg width="13" height="13" fill="${faved?'var(--acc)':'none'}" stroke="${faved?'var(--acc)':'var(--txt2)'}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
        </button>
      </div>
      <p style="font-size:11px;color:var(--txt2);line-height:1.5;margin-bottom:7px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${desc.slice(0,120)}${desc.length>120?'…':''}</p>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px">${genres}</div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:7px">
        <span style="font-size:11px;color:var(--txt2)">🗓 ${releaseDate}</span>
        <span style="font-size:11px;font-weight:800;color:var(--gld)">★ ${score}</span>
        ${cdHtml}
      </div>
    </div>
  </div>`;
}

// Infinite scroll for upcoming
new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && S.atab==='upcoming' && S.upMore && !S.upBusy) loadUpcoming();
}, {rootMargin:'300px'}).observe(document.getElementById('up-sentinel'));

/* ── TOP CHARTS ───────────────────────────── */
document.querySelectorAll('[data-chart]').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('[data-chart]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); S.chartSort=b.dataset.chart; S.charts=[]; loadCharts();
  };
});

async function loadCharts() {
  const list = document.getElementById('charts-list');
  list.innerHTML = Array(10).fill(`<div class="rk-card sk" style="height:72px"></div>`).join('');
  try {
    const data = await gql(`
      query($sort:[MediaSort]){Page(page:1,perPage:25){media(type:ANIME,sort:$sort,isAdult:false,status_in:[RELEASING,FINISHED]){
        id title{romaji english} coverImage{medium large} averageScore popularity episodes status genres
      }}}`, {sort:[S.chartSort]});
    S.charts = data.Page.media || [];
    list.innerHTML = S.charts.map((a,i) => rankCard(a, i+1)).join('');
  } catch(e) { list.innerHTML = errUI('Gagal memuat chart.'); }
}

function rankCard(a, rank) {
  const title = a.title.english || a.title.romaji;
  const cover = a.coverImage?.medium || a.coverImage?.large;
  const score = a.averageScore ? (a.averageScore/10).toFixed(1) : 'N/A';
  const rankColor = rank===1?'var(--gld)':rank===2?'#c0c0c0':rank===3?'#cd7f32':'var(--txt2)';
  const stCls = a.status==='RELEASING' ? 'b-grn' : 'b-gray';
  const stTxt = STATUS_ID[a.status] || a.status;
  return `
  <div class="rk-card" onclick="openAnimeDetail(${a.id})">
    <span style="font-size:20px;font-weight:900;min-width:34px;text-align:center;color:${rankColor};font-family:'Outfit',sans-serif">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</span>
    <img src="${cover}" onerror="this.src='https://via.placeholder.com/44x60/111122/7878aa?text=N/A'" loading="lazy" style="width:44px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0"/>
    <div style="flex:1;min-width:0">
      <p style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px">${title}</p>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:12px;font-weight:800;color:var(--gld)">★ ${score}</span>
        <span class="${stCls}" style="font-size:9px;border-radius:99px">${stTxt}</span>
        ${a.episodes?`<span style="font-size:10px;color:var(--txt2)">${a.episodes} ep</span>`:''}
      </div>
    </div>
  </div>`;
}

/* ── WATCH TRACKER ────────────────────────── */
function addToTracker(anime) {
  const exists = S.tracker.find(t=>t.id===anime.id);
  if (exists) { toast('Sudah ada di tracker!','📋'); return; }
  const totalEp = anime.episodes || 12;
  S.tracker.push({ id:anime.id, title:anime.title?.english||anime.title?.romaji, cover:anime.coverImage?.medium||anime.coverImage?.large, totalEp, watchedEp:0, score:0 });
  saveTracker();
  toast('Ditambahkan ke Tracker!','📋');
  document.getElementById('stat-track').textContent = S.tracker.length;
}

function saveTracker() {
  localStorage.setItem('nk_tracker', JSON.stringify(S.tracker));
  document.getElementById('stat-track').textContent = S.tracker.length;
}

function clearTracker() {
  if (!confirm('Reset semua tracker?')) return;
  S.tracker = []; saveTracker(); renderTracker();
}

function renderTracker() {
  const list = document.getElementById('tracker-list');
  const empty = document.getElementById('tracker-empty');
  document.getElementById('stat-track').textContent = S.tracker.length;
  if (!S.tracker.length) { list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';
  list.innerHTML = S.tracker.map(t => trackerCard(t)).join('');
}

function trackerCard(t) {
  const pct = t.totalEp ? Math.round((t.watchedEp/t.totalEp)*100) : 0;
  return `
  <div class="tk-card" onclick="openAnimeDetail(${t.id})">
    <img src="${t.cover}" onerror="this.src='https://via.placeholder.com/48x68/111122/7878aa?text=N/A'" loading="lazy"
      style="width:48px;height:68px;object-fit:cover;border-radius:8px;flex-shrink:0"/>
    <div style="flex:1;min-width:0">
      <p style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px">${t.title}</p>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:12px;color:var(--txt2)">Ep <strong style="color:var(--txt)">${t.watchedEp}</strong>/${t.totalEp}</span>
        <span style="font-size:11px;font-weight:700;color:var(--acc)">${pct}%</span>
      </div>
      <div class="ep-bar"><div class="ep-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;gap:8px;margin-top:8px" onclick="event.stopPropagation()">
        <button onclick="updateTrackerEp(${t.id},-1)" class="btn-s" style="padding:4px 10px;font-size:12px">−</button>
        <button onclick="updateTrackerEp(${t.id},1)" class="btn-p" style="padding:4px 12px;font-size:12px">+ Ep</button>
        <button onclick="removeTracker(${t.id})" style="margin-left:auto;font-size:18px;background:none;border:none;cursor:pointer;color:var(--txt2)">🗑</button>
      </div>
    </div>
  </div>`;
}

function updateTrackerEp(id, delta) {
  const t = S.tracker.find(x=>x.id===id);
  if (!t) return;
  t.watchedEp = Math.max(0, Math.min(t.totalEp, t.watchedEp + delta));
  saveTracker(); renderTracker();
  if (t.watchedEp >= t.totalEp) toast(`${t.title.slice(0,20)} selesai ditonton! 🎉`,'✅');
}

function removeTracker(id) {
  S.tracker = S.tracker.filter(x=>x.id!==id);
  saveTracker(); renderTracker();
  toast('Dihapus dari tracker','🗑');
}

/* ── SEARCH ───────────────────────────────── */
document.getElementById('search-inp').addEventListener('input', e => {
  const q = e.target.value.trim();
  S.searchQ = q;
  document.getElementById('s-clear').style.display = q ? 'block' : 'none';
  clearTimeout(S.searchTimer);
  if (!q) { clearSearch(); return; }
  // Show search panel, hide other tabs
  document.getElementById('search-panel').style.display = 'block';
  ['ongoing','upcoming','charts','tracker'].forEach(t => document.getElementById(`tab-${t}`).style.display='none');
  document.getElementById('search-panel').innerHTML = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">${Array(4).fill(skCard()).join('')}</div>`;
  S.searchTimer = setTimeout(() => doSearch(q), 380);
});

function clearSearch() {
  S.searchQ=''; document.getElementById('search-inp').value=''; document.getElementById('s-clear').style.display='none';
  document.getElementById('search-panel').style.display='none';
  const tab = S.atab;
  ['ongoing','upcoming','charts','tracker'].forEach(t => document.getElementById(`tab-${t}`).style.display = t===tab?'block':'none');
}

async function doSearch(q) {
  try {
    const data = await gql(`
      query($s:String){Page(page:1,perPage:12){media(search:$s,type:ANIME,isAdult:false,sort:[POPULARITY_DESC]){
        id title{romaji english} coverImage{large medium} genres averageScore status episodes
        nextAiringEpisode{airingAt episode timeUntilAiring}
      }}}`, {s:q});
    const items = data.Page.media || [];
    const panel = document.getElementById('search-panel');
    if (!items.length) { panel.innerHTML=`<div style="text-align:center;padding:48px 0;color:var(--txt2)"><div style="font-size:36px;margin-bottom:10px">🔍</div><p>Tidak ditemukan untuk "<strong style="color:var(--txt)">${q}</strong>"</p></div>`; return; }
    panel.innerHTML = `<p style="font-size:12px;color:var(--txt2);margin-bottom:12px">Hasil pencarian: <strong style="color:var(--txt)">${items.length}</strong> anime</p><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">${items.map(a=>posterCard(a)).join('')}</div>`;
    tickUpcoming();
  } catch(e) { document.getElementById('search-panel').innerHTML = errUI('Pencarian gagal.'); }
}

/* ── COUNTDOWN TICK ───────────────────────── */
function tickUpcoming() {
  if (S._upTick) clearInterval(S._upTick);
  S._upTick = setInterval(() => {
    const n = now();
    document.querySelectorAll('[data-rcd]').forEach(el => {
      const t=+el.dataset.rcd, left=t-n;
      el.textContent = left>0 ? fmtCdFull(left) : 'Sudah Rilis!';
    });
    document.querySelectorAll('[data-cdep]').forEach(el => {
      const t=+el.dataset.cdep, left=t-n;
      el.textContent = left>0 ? fmtCd(left) : '🔴 Live';
    });
  }, 1000);
}

/* ── FAVORITES ────────────────────────────── */
function toggleFav(id, title, cover) {
  const idx = S.favs.findIndex(f=>f.id===id);
  if (idx>=0) { S.favs.splice(idx,1); toast(`${title.slice(0,22)} dihapus ❤️`,'💔'); }
  else { S.favs.push({id,title,cover}); toast(`${title.slice(0,22)} difavoritkan!`,'❤️'); }
  localStorage.setItem('nk_favs', JSON.stringify(S.favs));
  // Update all fav buttons
  document.querySelectorAll(`[data-fid="${id}"]`).forEach(btn => {
    const faved = S.favs.some(f=>f.id===id);
    btn.classList.toggle('faved', faved);
    const svg = btn.querySelector('svg');
    if (svg) { svg.setAttribute('fill', faved?'var(--acc)':'none'); svg.setAttribute('stroke', faved?'var(--acc)':btn.closest('.ap-card')?'white':'var(--txt2)'); }
  });
  updateFavStats();
}

function updateFavStats() {
  document.getElementById('stat-fav').textContent = S.favs.length;
  const ct = document.getElementById('fav-count-txt');
  if (ct) ct.textContent = `${S.favs.length} anime`;
}

/* ── PROFILE ──────────────────────────────── */
function renderProfile() {
  updateFavStats();
  document.getElementById('stat-track').textContent = S.tracker.length;
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  if (!S.favs.length) { grid.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  grid.innerHTML = S.favs.map(f=>`
    <div class="ap-card" onclick="openAnimeDetail(${f.id})" style="cursor:pointer">
      <img src="${f.cover}" onerror="this.src='https://via.placeholder.com/120x180/111122/7878aa?text=N/A'" loading="lazy" style="aspect-ratio:2/3;object-fit:cover;width:100%;display:block"/>
      <div style="padding:6px 8px 8px"><p style="font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.title}</p></div>
    </div>`).join('');
}

document.getElementById('copy-btn').onclick = () => {
  navigator.clipboard.writeText('088973461209').then(()=>toast('Nomor berhasil disalin!','📋')).catch(()=>toast('Gagal menyalin','⚠️'));
};
document.getElementById('share-btn').onclick = () => {
  if (navigator.share) navigator.share({title:'NekoTime',text:'Cek website anime premium ini!',url:location.href});
  else navigator.clipboard.writeText(location.href).then(()=>toast('Link disalin!','🔗'));
};

/* ── ANIME DETAIL MODAL ───────────────────── */
const animeCache = {};

async function openAnimeDetail(id) {
  openModal('anime-modal');
  document.getElementById('anime-modal-inner').innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 0;gap:16px"><div class="spinner"></div><p style="font-size:13px;color:var(--txt2)">Memuat detail anime…</p></div>`;
  try {
    let a = animeCache[id];
    if (!a) {
      const d = await gql(`
        query($id:Int){Media(id:$id,type:ANIME){
          id title{romaji english native} coverImage{extraLarge large} bannerImage genres averageScore popularity
          episodes status season seasonYear description(asHtml:false) trailer{id site}
          nextAiringEpisode{airingAt episode timeUntilAiring} startDate{year month day} endDate{year month day}
          studios(isMain:true){nodes{name}} source
          characters(sort:[ROLE,RELEVANCE],perPage:14){edges{role node{id name{full} image{large medium} description dateOfBirth{year month day}}}}
          recommendations(sort:[RATING_DESC],perPage:6){nodes{mediaRecommendation{id title{romaji english} coverImage{medium large}}}}
        }}`, {id});
      a = d.Media;
      animeCache[id] = a;
    }
    renderAnimeModal(a);
    tickUpcoming();
  } catch(e) { document.getElementById('anime-modal-inner').innerHTML = errUI('Gagal memuat detail.'); }
}

function renderAnimeModal(a) {
  const title = a.title.english || a.title.romaji;
  const cover = a.coverImage?.extraLarge || a.coverImage?.large;
  const banner = a.bannerImage;
  const score = a.averageScore ? (a.averageScore/10).toFixed(1) : 'N/A';
  const faved = S.favs.some(f=>f.id===a.id);
  const tracked = S.tracker.some(t=>t.id===a.id);
  const studio = a.studios?.nodes?.[0]?.name || 'Unknown';
  const season = a.season ? `${SEASON_ID[a.season]||a.season} ${a.seasonYear||''}` : (a.seasonYear||'');
  const status = STATUS_ID[a.status] || a.status;
  const genres = (a.genres||[]).map(g=>`<span class="b-acc">${g}</span>`).join('');
  
  // Description - detect language and translate if English
  const rawDesc = (a.description||'Tidak ada sinopsis.').replace(/<[^>]*>/g,'');
  const isEn = hasEnglish(rawDesc);
  const desc = isEn ? autoTranslate(rawDesc) : rawDesc;
  const transLabel = isEn ? `<span class="tr-pill">🌐 Diterjemahkan</span>` : '';

  // Trailer
  let trailer = '';
  if (a.trailer?.id && a.trailer?.site === 'youtube') {
    trailer = `<div style="padding:0 16px 16px">
      <h4 style="font-size:12px;font-weight:800;color:var(--txt2);letter-spacing:.08em;margin-bottom:10px">TRAILER</h4>
      <div class="tv-wrap"><iframe src="https://www.youtube.com/embed/${a.trailer.id}?autoplay=1&mute=1&loop=1&playlist=${a.trailer.id}&rel=0&modestbranding=1" allow="autoplay;fullscreen" allowfullscreen loading="lazy"></iframe></div>
    </div>`;
  }

  // Characters
  const chars = a.characters?.edges || [];
  let charsHtml = '';
  if (chars.length) {
    charsHtml = `<div style="padding:0 16px 16px">
      <h4 style="font-size:12px;font-weight:800;color:var(--txt2);letter-spacing:.08em;margin-bottom:12px">KARAKTER</h4>
      <div style="display:flex;flex-wrap:wrap;gap:14px">
        ${chars.map(edge => {
          const ch = edge.node;
          const img = ch.image?.large || ch.image?.medium;
          const isMain = edge.role === 'MAIN';
          const roleId = ROLE_ID[edge.role] || edge.role;
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;max-width:58px" onclick="openCharModal(${JSON.stringify(ch).replace(/"/g,'&quot;')},'${edge.role}')">
            <div class="ch-av" style="${isMain?'border-color:var(--acc);box-shadow:0 0 12px var(--acc-g)':''}">
              <img src="${img}" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${ch.id}'" loading="lazy"/>
            </div>
            <span style="font-size:9px;font-weight:700;text-align:center;color:${isMain?'var(--acc)':'var(--txt2)'};line-height:1.2;max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ch.name.full.split(' ')[0]}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Recommendations
  const recs = (a.recommendations?.nodes||[]).filter(n=>n.mediaRecommendation);
  let recHtml = '';
  if (recs.length) {
    recHtml = `<div style="padding:0 16px 16px">
      <h4 style="font-size:12px;font-weight:800;color:var(--txt2);letter-spacing:.08em;margin-bottom:12px">REKOMENDASI</h4>
      <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px" class="no-sb">
        ${recs.map(n => {
          const m = n.mediaRecommendation;
          const t2 = m.title.english || m.title.romaji;
          const c2 = m.coverImage?.medium || m.coverImage?.large;
          return `<div class="rc-card" onclick="event.stopPropagation();closeModal('anime-modal');setTimeout(()=>openAnimeDetail(${m.id}),150)">
            <img src="${c2}" onerror="this.src='https://via.placeholder.com/110x155/111122/7878aa?text=N/A'" loading="lazy"/>
            <div style="padding:6px 8px 8px"><p style="font-size:10px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t2}</p></div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Next airing
  let nextHtml = '';
  if (a.nextAiringEpisode) {
    const {airingAt,episode,timeUntilAiring} = a.nextAiringEpisode;
    nextHtml = `<div style="padding:0 16px 14px">
      <div style="background:var(--acc-d);border:1px solid rgba(255,10,148,.2);border-radius:12px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
        <div><p style="font-size:11px;color:var(--txt2);margin-bottom:2px">Episode Berikutnya</p><p style="font-size:14px;font-weight:800">Ep. ${episode} · ${wibHM(airingAt)}</p></div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:var(--acc)" data-cdep="${airingAt}">${fmtCd(timeUntilAiring)}</span>
      </div>
    </div>`;
  }

  document.getElementById('anime-modal-inner').innerHTML = `
    <!-- Banner -->
    <div style="position:relative;height:200px;overflow:hidden;flex-shrink:0">
      ${banner ? `<img src="${banner}" style="width:100%;height:100%;object-fit:cover;filter:brightness(.55)"/>` 
               : `<div style="width:100%;height:100%;background:linear-gradient(135deg,rgba(255,10,148,.25),rgba(77,143,255,.15))"></div>`}
      <div style="position:absolute;inset:0;background:linear-gradient(to top,var(--surf) 0%,transparent 55%)"></div>
    </div>

    <!-- Header -->
    <div style="padding:0 16px 14px;margin-top:-60px;display:flex;gap:14px;align-items:flex-end">
      <img src="${cover}" onerror="this.src='https://via.placeholder.com/80x112/111122/7878aa?text=N/A'" 
        style="width:80px;height:112px;object-fit:cover;border-radius:14px;border:3px solid var(--surf);box-shadow:0 8px 28px rgba(0,0,0,.6);flex-shrink:0"/>
      <div style="flex:1;min-width:0;padding-bottom:4px">
        <h2 style="font-size:18px;font-weight:900;line-height:1.25;letter-spacing:-.02em;margin-bottom:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${title}</h2>
        ${a.title.native ? `<p style="font-size:11px;color:var(--txt2);margin-bottom:6px">${a.title.native}</p>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:5px">${genres}</div>
      </div>
    </div>

    <!-- Stats grid -->
    <div style="padding:0 16px 14px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
      ${[['★ '+score,'Skor','var(--gld)'],[a.episodes||'?','Episode','var(--blu)'],[a.seasonYear||'?','Tahun','var(--txt)'],[status,'Status','var(--grn)']].map(([v,l,c])=>`
        <div style="background:var(--card2);border:1px solid var(--bdr);border-radius:12px;padding:10px 6px;text-align:center">
          <div style="font-size:12px;font-weight:800;color:${c};line-height:1.2;margin-bottom:2px">${v}</div>
          <div style="font-size:9px;color:var(--txt2)">${l}</div>
        </div>`).join('')}
    </div>

    <!-- Action buttons -->
    <div style="padding:0 16px 14px;display:flex;gap:10px">
      <button onclick="toggleFav(${a.id},'${esc(title)}','${cover}')" class="fav-btn${faved?' faved':''} btn-${faved?'p':'s'}" data-fid="${a.id}"
        style="flex:1;padding:12px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:12px">
        <svg width="16" height="16" fill="${faved?'white':'none'}" stroke="${faved?'white':'currentColor'}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
        ${faved?'Difavoritkan':'Favorit'}
      </button>
      <button onclick="addToTracker(${JSON.stringify(a).replace(/"/g,'&quot;')})" class="btn-s" style="flex:1;padding:12px;display:flex;align-items:center;justify-content:center;gap:8px">
        ${tracked?'✅ Di Tracker':'📋 Tambah Tracker'}
      </button>
    </div>

    ${a.studios?.nodes?.length ? `<div style="padding:0 16px 12px;display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--txt2)">🏢 Studio:</span><span style="font-size:12px;font-weight:700">${a.studios.nodes.map(n=>n.name).join(', ')}</span></div>` : ''}
    ${season ? `<div style="padding:0 16px 12px;display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--txt2)">📅 Musim:</span><span style="font-size:12px;font-weight:700">${season}</span></div>` : ''}

    ${nextHtml}

    <!-- Rating bar -->
    <div style="padding:0 16px 16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--txt2)">Skor AniList</span>
        <span style="font-size:12px;font-weight:800;color:var(--acc)">${a.averageScore||0}/100</span>
      </div>
      <div style="height:6px;background:var(--card2);border-radius:99px;overflow:hidden">
        <div class="rb-fill" style="width:${a.averageScore||0}%"></div>
      </div>
    </div>

    <!-- Description -->
    <div style="padding:0 16px 16px">
      <h4 style="font-size:12px;font-weight:800;color:var(--txt2);letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:6px">SINOPSIS ${transLabel}</h4>
      <p style="font-size:13px;line-height:1.7;color:var(--txt)">${desc.slice(0,400)}${desc.length>400?'…':''}</p>
    </div>

    ${charsHtml}
    ${trailer}
    ${recHtml}
    <div style="height:24px"></div>
  `;
  tickUpcoming();
}

/* ── CHARACTER MODAL ──────────────────────── */
function openCharModal(char, role) {
  openModal('char-modal');
  const img = char.image?.large || char.image?.medium;
  const rawDesc = (char.description||'Tidak ada deskripsi.').replace(/<[^>]*>/g,'');
  const isEn = hasEnglish(rawDesc);
  const desc = isEn ? autoTranslate(rawDesc) : rawDesc;
  const bday = formatCharBday(char.dateOfBirth);
  const roleId = ROLE_ID[role] || role;
  const isMain = role === 'MAIN';
  const transLabel = isEn ? `<span class="tr-pill">🌐 Diterjemahkan</span>` : '';

  document.getElementById('char-modal-inner').innerHTML = `
    <div style="position:relative">
      <img src="${img}" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${char.id}'" loading="lazy"
        style="width:100%;height:260px;object-fit:cover;object-position:top;display:block"/>
      <div style="position:absolute;inset:0;background:linear-gradient(to top,var(--surf) 0%,transparent 55%)"></div>
    </div>
    <div style="padding:4px 20px 28px">
      <h2 style="font-size:22px;font-weight:900;letter-spacing:-.02em;margin-bottom:4px">${char.name.full}</h2>
      <p style="font-size:13px;font-weight:700;margin-bottom:10px;color:${isMain?'var(--acc)':'var(--txt2)'}">${roleId}</p>
      ${bday?`<p style="font-size:12px;color:var(--txt2);margin-bottom:12px">🎂 Tanggal Lahir: <strong style="color:var(--txt)">${bday}</strong></p>`:''}
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <h4 style="font-size:11px;font-weight:800;color:var(--txt2);letter-spacing:.06em">DESKRIPSI</h4>${transLabel}
      </div>
      <p style="font-size:13px;line-height:1.7;color:var(--txt)">${desc.slice(0,320)}${desc.length>320?'…':''}</p>
    </div>`;
}

function formatCharBday(dob) {
  if (!dob?.month) return null;
  return `${dob.day||'?'} ${MONTHS_ID[dob.month-1]} ${dob.year||''}`.trim();
}

/* ── UTILS ────────────────────────────────── */
function esc(str) { return (str||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function errUI(msg) {
  return `<div style="text-align:center;padding:64px 20px"><div style="font-size:40px;margin-bottom:12px">⚠️</div><p style="font-size:14px;font-weight:600;color:var(--txt2);margin-bottom:16px">${msg}</p><button onclick="location.reload()" class="btn-p" style="padding:10px 24px">Coba Lagi</button></div>`;
}

/* ── INIT ─────────────────────────────────── */
function init() {
  applyTheme(S.theme);
  startClock();
  buildDayTabs();
  buildGenreChips();
  loadSchedule();
  updateFavStats();
  document.getElementById('stat-track').textContent = S.tracker.length;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

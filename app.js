/* ==========================================
   NekoTime - Anime Premium App
   AniList GraphQL API Integration
   ========================================== */

'use strict';

// ── CONSTANTS ────────────────────────────────
const ANILIST_API = 'https://graphql.anilist.co';
const WIB_OFFSET = 7 * 60 * 60 * 1000; // UTC+7

// Days mapping
const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Genre list
const GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller'];

// ── STATE ─────────────────────────────────────
const state = {
  activePage: 'jadwal',
  activeDay: new Date().getDay(),
  activeTab: 'ongoing', // 'ongoing' | 'upcoming'
  schedule: {},
  ongoing: [],
  upcoming: [],
  searchResults: [],
  favorites: JSON.parse(localStorage.getItem('neko_favorites') || '[]'),
  selectedGenres: [],
  sortMode: 'POPULARITY_DESC',
  upcomingPage: 1,
  upcomingHasMore: true,
  upcomingLoading: false,
  searchQuery: '',
  searchTimer: null,
  countdownTimers: {},
  theme: localStorage.getItem('neko_theme') || 'dark',
};

// ── GRAPHQL QUERIES ───────────────────────────
const Q_AIRING_SCHEDULE = `
query ($weekStart: Int, $weekEnd: Int) {
  Page(page: 1, perPage: 50) {
    airingSchedules(airingAt_greater: $weekStart, airingAt_lesser: $weekEnd, sort: TIME) {
      id
      airingAt
      episode
      timeUntilAiring
      media {
        id
        title { romaji english native }
        coverImage { large medium }
        genres
        averageScore
        episodes
        status
        nextAiringEpisode { airingAt episode timeUntilAiring }
      }
    }
  }
}`;

const Q_ONGOING = `
query ($page: Int, $sort: [MediaSort], $genre_in: [String]) {
  Page(page: $page, perPage: 20) {
    media(
      type: ANIME
      status: RELEASING
      sort: $sort
      genre_in: $genre_in
      isAdult: false
    ) {
      id
      title { romaji english }
      coverImage { extraLarge large medium }
      bannerImage
      genres
      averageScore
      popularity
      episodes
      nextAiringEpisode { airingAt episode timeUntilAiring }
      description(asHtml: false)
      status
      trailer { id site }
      characters(sort: [ROLE, RELEVANCE], perPage: 10) {
        edges {
          role
          node {
            id
            name { full }
            image { large medium }
            description
            dateOfBirth { year month day }
          }
        }
      }
    }
  }
}`;

const Q_UPCOMING = `
query ($page: Int, $sort: [MediaSort], $genre_in: [String]) {
  Page(page: $page, perPage: 20) {
    pageInfo { hasNextPage currentPage }
    media(
      type: ANIME
      status: NOT_YET_RELEASED
      sort: $sort
      genre_in: $genre_in
      isAdult: false
    ) {
      id
      title { romaji english }
      coverImage { extraLarge large medium }
      bannerImage
      genres
      averageScore
      popularity
      description(asHtml: false)
      startDate { year month day }
      trailer { id site }
      characters(sort: [ROLE, RELEVANCE], perPage: 6) {
        edges {
          role
          node {
            id
            name { full }
            image { large medium }
            description
            dateOfBirth { year month day }
          }
        }
      }
    }
  }
}`;

const Q_SEARCH = `
query ($search: String) {
  Page(page: 1, perPage: 12) {
    media(search: $search, type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) {
      id
      title { romaji english }
      coverImage { large medium }
      genres
      averageScore
      status
      episodes
      nextAiringEpisode { airingAt episode timeUntilAiring }
    }
  }
}`;

// ── API HELPER ────────────────────────────────
async function gql(query, variables = {}) {
  try {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  } catch (e) {
    console.error('API Error:', e);
    throw e;
  }
}

// ── TIME HELPERS ──────────────────────────────
function toWIB(unixTs) {
  return new Date(unixTs * 1000 + WIB_OFFSET);
}

function formatTimeWIB(unixTs) {
  const d = toWIB(unixTs);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m} WIB`;
}

function getDayOfWeekWIB(unixTs) {
  const d = toWIB(unixTs);
  return d.getUTCDay();
}

function formatCountdown(secs) {
  if (secs <= 0) return 'Sudah tayang';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d > 0) return `${d}h ${String(h).padStart(2,'0')}j ${String(m).padStart(2,'0')}m`;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDate(dateObj) {
  if (!dateObj || !dateObj.year) return 'TBA';
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const m = dateObj.month ? months[dateObj.month - 1] : '';
  const d = dateObj.day ? dateObj.day + ' ' : '';
  return `${d}${m} ${dateObj.year}`;
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

// ── LIVE CLOCK ────────────────────────────────
function startLiveClock() {
  const el = document.getElementById('live-clock');
  function tick() {
    const now = new Date(Date.now() + WIB_OFFSET);
    const h = String(now.getUTCHours()).padStart(2,'0');
    const m = String(now.getUTCMinutes()).padStart(2,'0');
    const s = String(now.getUTCSeconds()).padStart(2,'0');
    el.textContent = `${h}:${m}:${s} WIB`;
  }
  tick();
  setInterval(tick, 1000);
}

// ── THEME ─────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const iconDark = document.getElementById('theme-icon-dark');
  const iconLight = document.getElementById('theme-icon-light');
  if (t === 'dark') { iconDark.classList.remove('hidden'); iconLight.classList.add('hidden'); }
  else { iconDark.classList.add('hidden'); iconLight.classList.remove('hidden'); }
  localStorage.setItem('neko_theme', t);
  state.theme = t;
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
});

// ── TOAST ─────────────────────────────────────
function showToast(msg, icon = '✨') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ── NAVIGATION ────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    navigateTo(page);
  });
});

function navigateTo(page) {
  state.activePage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('active');
    b.querySelector('.nav-icon').style.color = 'var(--text-secondary)';
    b.querySelector('.nav-label').style.color = 'var(--text-secondary)';
  });

  document.getElementById(`page-${page}`).classList.add('active');
  const activeBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
  activeBtn.classList.add('active');
  activeBtn.querySelector('.nav-icon').style.color = 'var(--accent)';
  activeBtn.querySelector('.nav-label').style.color = 'var(--accent)';

  if (page === 'jadwal' && Object.keys(state.schedule).length === 0) loadSchedule();
  if (page === 'anime' && state.ongoing.length === 0) loadOngoing();
  if (page === 'profile') renderFavorites();

  // Scroll top
  window.scrollTo(0, 0);
}

// ── SKELETON HELPERS ──────────────────────────
function skeletonCard() {
  return `<div class="anime-card rounded-2xl overflow-hidden">
    <div class="skeleton w-full" style="aspect-ratio:2/3;"></div>
    <div class="p-3 space-y-2">
      <div class="skeleton h-3 rounded-full w-full"></div>
      <div class="skeleton h-3 rounded-full w-2/3"></div>
      <div class="skeleton h-3 rounded-full w-1/2"></div>
    </div>
  </div>`;
}

function skeletonScheduleItem() {
  return `<div class="anime-card rounded-2xl p-3 flex gap-3 mb-3">
    <div class="skeleton rounded-xl flex-shrink-0" style="width:64px;height:88px;"></div>
    <div class="flex-1 space-y-2 py-1">
      <div class="skeleton h-3 rounded-full w-3/4"></div>
      <div class="skeleton h-3 rounded-full w-1/2"></div>
      <div class="skeleton h-3 rounded-full w-2/3"></div>
    </div>
  </div>`;
}

// ── SCHEDULE PAGE ─────────────────────────────
function buildDayTabs() {
  const container = document.getElementById('day-tabs');
  container.innerHTML = '';
  DAYS_ID.forEach((day, idx) => {
    const btn = document.createElement('button');
    btn.className = `day-tab flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all`;
    btn.textContent = day;
    btn.dataset.day = idx;
    if (idx === state.activeDay) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.day-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeDay = idx;
      renderScheduleDay(idx);
    });
    container.appendChild(btn);
  });
}

async function loadSchedule() {
  const list = document.getElementById('schedule-list');
  list.innerHTML = Array(5).fill(skeletonScheduleItem()).join('');

  try {
    // Get schedule for whole week
    const now = nowUnix();
    const weekStart = now - (7 * 86400);
    const weekEnd = now + (7 * 86400);

    const data = await gql(Q_AIRING_SCHEDULE, { weekStart, weekEnd });
    const schedules = data.Page.airingSchedules || [];

    // Group by day of week (WIB)
    state.schedule = {};
    DAYS_ID.forEach((_, i) => { state.schedule[i] = []; });

    schedules.forEach(s => {
      const day = getDayOfWeekWIB(s.airingAt);
      if (!state.schedule[day]) state.schedule[day] = [];
      // Avoid duplicates by media id
      const exists = state.schedule[day].find(x => x.media.id === s.media.id && x.episode === s.episode);
      if (!exists) state.schedule[day].push(s);
    });

    renderScheduleDay(state.activeDay);
  } catch (e) {
    list.innerHTML = renderError('Gagal memuat jadwal. Coba lagi.');
  }
}

function renderScheduleDay(dayIdx) {
  const list = document.getElementById('schedule-list');
  const items = state.schedule[dayIdx] || [];

  if (items.length === 0) {
    list.innerHTML = `<div class="text-center py-16" style="color:var(--text-secondary)">
      <div class="text-4xl mb-3">📭</div>
      <p class="text-sm font-medium">Tidak ada jadwal untuk hari ini</p>
    </div>`;
    return;
  }

  // Sort by airingAt
  items.sort((a, b) => a.airingAt - b.airingAt);

  list.innerHTML = items.map(item => renderScheduleItem(item)).join('');

  // Start countdowns
  startScheduleCountdowns();
}

function renderScheduleItem(item) {
  const { airingAt, episode, timeUntilAiring, media } = item;
  const now = nowUnix();
  const secLeft = airingAt - now;
  const timeStr = formatTimeWIB(airingAt);

  let statusClass, statusText;
  if (secLeft > 0) {
    statusClass = 'status-upcoming';
    statusText = 'Akan Tayang';
  } else if (secLeft > -3600) {
    statusClass = 'status-airing';
    statusText = 'Sedang Tayang';
  } else {
    statusClass = 'status-done';
    statusText = 'Selesai';
  }

  const title = media.title.english || media.title.romaji;
  const cover = media.coverImage?.medium || media.coverImage?.large;
  const score = media.averageScore ? (media.averageScore / 10).toFixed(1) : 'N/A';
  const genres = (media.genres || []).slice(0, 2).map(g => `<span class="genre-badge text-[9px] px-1.5 py-0.5 rounded-md font-medium">${g}</span>`).join('');

  return `<div class="anime-card rounded-2xl p-3 flex gap-3 mb-3 cursor-pointer" onclick="openAnimeModal(${media.id})">
    <img src="${cover}" alt="${title}" loading="lazy" class="rounded-xl flex-shrink-0 object-cover" style="width:64px;height:88px;" onerror="this.src='https://via.placeholder.com/64x88/1a1a1a/888888?text=N/A'" />
    <div class="flex-1 min-w-0">
      <div class="flex items-start justify-between gap-2 mb-1">
        <h3 class="font-display font-bold text-sm leading-tight truncate">${title}</h3>
        <span class="text-xs font-bold flex-shrink-0" style="color:var(--accent)">★ ${score}</span>
      </div>
      <p class="text-xs mb-1.5" style="color:var(--text-secondary)">Ep. <strong style="color:var(--text-primary)">${episode}</strong> &nbsp;•&nbsp; ${timeStr}</p>
      <div class="flex flex-wrap gap-1 mb-2">${genres}</div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusClass}">${statusText}</span>
        ${secLeft > 0 ? `<span class="countdown-chip text-[10px] font-bold" style="color:var(--accent)" data-airing="${airingAt}" data-countdown="${airingAt}">${formatCountdown(secLeft)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

function startScheduleCountdowns() {
  // Clear previous timers
  if (state._scheduleTimer) clearInterval(state._scheduleTimer);
  state._scheduleTimer = setInterval(() => {
    const now = nowUnix();
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const airingAt = parseInt(el.dataset.countdown);
      const secLeft = airingAt - now;
      if (secLeft > 0) {
        el.textContent = formatCountdown(secLeft);
      } else {
        el.textContent = 'Sedang Tayang';
        el.style.color = '#22c55e';
      }
    });
  }, 1000);
}

// ── ANIME PAGE ────────────────────────────────
function buildGenreFilters() {
  const container = document.getElementById('genre-filters');
  container.innerHTML = '';
  GENRES.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'genre-filter-btn flex-shrink-0 text-[11px] px-3 py-1 rounded-full font-medium transition-all';
    btn.textContent = g;
    btn.dataset.genre = g;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      if (state.selectedGenres.includes(g)) {
        state.selectedGenres = state.selectedGenres.filter(x => x !== g);
      } else {
        state.selectedGenres.push(g);
      }
      reloadAnime();
    });
    container.appendChild(btn);
  });
}

function buildSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sortMode = btn.dataset.sort;
      reloadAnime();
    });
  });
}

function reloadAnime() {
  if (state.activeTab === 'ongoing') {
    state.ongoing = [];
    document.getElementById('ongoing-list').innerHTML = Array(6).fill(skeletonCard()).join('');
    loadOngoing();
  } else {
    state.upcoming = [];
    state.upcomingPage = 1;
    state.upcomingHasMore = true;
    document.getElementById('upcoming-list').innerHTML = '';
    loadUpcoming();
  }
}

async function loadOngoing() {
  const list = document.getElementById('ongoing-list');
  if (state.ongoing.length === 0) {
    list.innerHTML = Array(6).fill(skeletonCard()).join('');
  }
  try {
    const genres = state.selectedGenres.length > 0 ? state.selectedGenres : undefined;
    const data = await gql(Q_ONGOING, {
      page: 1,
      sort: [state.sortMode],
      genre_in: genres,
    });
    state.ongoing = data.Page.media || [];
    renderOngoing();
  } catch (e) {
    list.innerHTML = renderError('Gagal memuat anime ongoing.');
  }
}

function renderOngoing() {
  const list = document.getElementById('ongoing-list');
  if (state.ongoing.length === 0) {
    list.innerHTML = `<div class="col-span-2 text-center py-16" style="color:var(--text-secondary)">
      <div class="text-4xl mb-3">🔍</div>
      <p class="text-sm">Tidak ada hasil ditemukan.</p>
    </div>`;
    return;
  }
  list.innerHTML = state.ongoing.map(a => renderAnimeCard(a)).join('');
  startUpcomingCountdowns();
}

function renderAnimeCard(anime) {
  const title = anime.title.english || anime.title.romaji;
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const genres = (anime.genres || []).slice(0, 2).map(g => `<span class="genre-badge text-[9px] px-1.5 py-0.5 rounded-md">${g}</span>`).join('');
  const isFav = state.favorites.some(f => f.id === anime.id);
  const nextEp = anime.nextAiringEpisode;
  const nextStr = nextEp ? `<p class="text-[10px] mt-1" style="color:var(--text-secondary)">Ep.${nextEp.episode} · <span data-airing-cd="${nextEp.airingAt}">${formatCountdown(nextEp.timeUntilAiring)}</span></p>` : '';

  return `<div class="anime-card rounded-2xl overflow-hidden cursor-pointer" onclick="openAnimeModal(${anime.id})">
    <div class="relative">
      <img src="${cover}" alt="${title}" loading="lazy" class="w-full ongoing-poster object-cover" onerror="this.src='https://via.placeholder.com/300x450/1a1a1a/888888?text=N/A'" />
      <div class="absolute inset-0" style="background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)"></div>
      <button class="fav-btn absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 ${isFav ? 'active' : ''}" style="background:rgba(0,0,0,0.6);" onclick="event.stopPropagation(); toggleFavorite(${anime.id}, '${title.replace(/'/g,"\\'")}', '${cover}')" data-fav-id="${anime.id}">
        <svg class="w-4 h-4" fill="${isFav ? 'var(--accent)' : 'none'}" viewBox="0 0 24 24" stroke="${isFav ? 'var(--accent)' : 'currentColor'}" stroke-width="2" style="${isFav ? '' : 'color:white'}">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
      </button>
      <div class="absolute bottom-0 left-0 right-0 p-2">
        <div class="flex flex-wrap gap-1">${genres}</div>
      </div>
    </div>
    <div class="p-2.5">
      <h3 class="font-display font-bold text-xs leading-tight line-clamp-2 mb-1">${title}</h3>
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold" style="color:var(--accent)">★ ${score}</span>
        ${anime.episodes ? `<span class="text-[10px]" style="color:var(--text-secondary)">${anime.episodes} ep</span>` : ''}
      </div>
      ${nextStr}
    </div>
  </div>`;
}

// ── UPCOMING ──────────────────────────────────
function setupTabs() {
  document.getElementById('tab-ongoing').addEventListener('click', () => switchTab('ongoing'));
  document.getElementById('tab-upcoming').addEventListener('click', () => switchTab('upcoming'));
}

function switchTab(tab) {
  state.activeTab = tab;
  const isOngoing = tab === 'ongoing';
  document.getElementById('tab-ongoing').style.background = isOngoing ? 'var(--accent)' : 'var(--bg-card)';
  document.getElementById('tab-ongoing').style.color = isOngoing ? 'white' : 'var(--text-secondary)';
  document.getElementById('tab-upcoming').style.background = !isOngoing ? 'var(--accent)' : 'var(--bg-card)';
  document.getElementById('tab-upcoming').style.color = !isOngoing ? 'white' : 'var(--text-secondary)';

  document.getElementById('ongoing-list').classList.toggle('hidden', !isOngoing);
  document.getElementById('upcoming-list').classList.toggle('hidden', isOngoing);
  document.getElementById('search-results').classList.add('hidden');

  if (!isOngoing && state.upcoming.length === 0) {
    loadUpcoming();
  }
}

async function loadUpcoming() {
  if (state.upcomingLoading || !state.upcomingHasMore) return;
  state.upcomingLoading = true;

  const spinner = document.getElementById('load-more-spinner');
  spinner.classList.remove('hidden');

  try {
    const genres = state.selectedGenres.length > 0 ? state.selectedGenres : undefined;
    const data = await gql(Q_UPCOMING, {
      page: state.upcomingPage,
      sort: [state.sortMode],
      genre_in: genres,
    });
    const { media } = data.Page;
    const { hasNextPage } = data.Page.pageInfo;

    state.upcoming.push(...(media || []));
    state.upcomingHasMore = hasNextPage;
    state.upcomingPage++;

    renderUpcoming(media || []);
  } catch (e) {
    showToast('Gagal memuat upcoming anime.', '⚠️');
  } finally {
    state.upcomingLoading = false;
    document.getElementById('load-more-spinner').classList.add('hidden');
  }
}

function renderUpcoming(newItems) {
  const list = document.getElementById('upcoming-list');

  newItems.forEach(anime => {
    const el = document.createElement('div');
    el.className = 'anime-card rounded-2xl overflow-hidden mb-3 cursor-pointer';
    el.onclick = () => openAnimeModal(anime.id, anime);
    el.innerHTML = renderUpcomingCard(anime);
    list.appendChild(el);
  });

  startUpcomingCountdowns();
}

function renderUpcomingCard(anime) {
  const title = anime.title.english || anime.title.romaji;
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const banner = anime.bannerImage;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'TBA';
  const genres = (anime.genres || []).slice(0, 3).map(g => `<span class="genre-badge text-[9px] px-1.5 py-0.5 rounded-md">${g}</span>`).join('');
  const releaseDate = formatDate(anime.startDate);
  const desc = (anime.description || '').replace(/<[^>]*>/g, '').slice(0, 100);

  // Calculate countdown to startDate
  let countdownHtml = '';
  if (anime.startDate?.year) {
    const releaseTs = new Date(
      anime.startDate.year,
      (anime.startDate.month || 1) - 1,
      anime.startDate.day || 1
    ).getTime() / 1000;
    const secLeft = releaseTs - nowUnix();
    if (secLeft > 0) {
      const d = Math.floor(secLeft / 86400);
      const h = Math.floor((secLeft % 86400) / 3600);
      const m = Math.floor((secLeft % 3600) / 60);
      const s = secLeft % 60;
      countdownHtml = `<span class="countdown-chip text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:var(--accent-dim);color:var(--accent);" data-release-cd="${releaseTs}">${d}h ${String(h).padStart(2,'0')}j ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}d</span>`;
    }
  }

  const isFav = state.favorites.some(f => f.id === anime.id);

  return `
    <div class="flex gap-3 p-3">
      <img src="${cover}" alt="${title}" loading="lazy" class="rounded-xl flex-shrink-0 object-cover" style="width:72px;height:104px;" onerror="this.src='https://via.placeholder.com/72x104/1a1a1a/888888?text=N/A'" />
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-1">
          <h3 class="font-display font-bold text-sm leading-tight line-clamp-2 flex-1">${title}</h3>
          <button class="fav-btn flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${isFav ? 'active' : ''}" style="background:var(--bg-secondary);" onclick="event.stopPropagation(); toggleFavorite(${anime.id}, '${title.replace(/'/g,"\\'")}', '${cover}')" data-fav-id="${anime.id}">
            <svg class="w-3.5 h-3.5" fill="${isFav ? 'var(--accent)' : 'none'}" viewBox="0 0 24 24" stroke="${isFav ? 'var(--accent)' : 'currentColor'}" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
        </div>
        <p class="text-xs mt-1 mb-1.5" style="color:var(--text-secondary)">${desc}${desc.length >= 100 ? '...' : ''}</p>
        <div class="flex flex-wrap gap-1 mb-2">${genres}</div>
        <div class="flex items-center flex-wrap gap-2">
          <span class="text-[10px] font-semibold" style="color:var(--text-secondary)">🗓 ${releaseDate}</span>
          <span class="text-[10px] font-bold" style="color:var(--accent)">★ ${score}</span>
          ${countdownHtml}
        </div>
      </div>
    </div>`;
}

function startUpcomingCountdowns() {
  if (state._upcomingTimer) clearInterval(state._upcomingTimer);
  state._upcomingTimer = setInterval(() => {
    const now = nowUnix();
    document.querySelectorAll('[data-release-cd]').forEach(el => {
      const ts = parseInt(el.dataset.releaseCd);
      const secLeft = ts - now;
      if (secLeft > 0) {
        const d = Math.floor(secLeft / 86400);
        const h = Math.floor((secLeft % 86400) / 3600);
        const m = Math.floor((secLeft % 3600) / 60);
        const s = secLeft % 60;
        el.textContent = `${d}h ${String(h).padStart(2,'0')}j ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}d`;
      } else {
        el.textContent = 'Sudah rilis!';
      }
    });
    document.querySelectorAll('[data-airing-cd]').forEach(el => {
      const ts = parseInt(el.dataset.airingCd);
      const secLeft = ts - now;
      el.textContent = secLeft > 0 ? formatCountdown(secLeft) : 'Sedang Tayang';
    });
  }, 1000);
}

// ── INFINITE SCROLL ───────────────────────────
function setupInfiniteScroll() {
  const sentinel = document.getElementById('scroll-sentinel');
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && state.activeTab === 'upcoming' && state.upcomingHasMore && !state.upcomingLoading) {
      loadUpcoming();
    }
  }, { rootMargin: '200px' });
  observer.observe(sentinel);
}

// ── SEARCH ────────────────────────────────────
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(state.searchTimer);
  const q = e.target.value.trim();
  state.searchQuery = q;

  if (!q) {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('ongoing-list').classList.remove('hidden');
    document.getElementById('upcoming-list').classList.toggle('hidden', state.activeTab !== 'upcoming');
    return;
  }

  document.getElementById('ongoing-list').classList.add('hidden');
  document.getElementById('upcoming-list').classList.add('hidden');
  const results = document.getElementById('search-results');
  results.classList.remove('hidden');
  results.innerHTML = `<div class="grid grid-cols-2 gap-3">${Array(4).fill(skeletonCard()).join('')}</div>`;

  state.searchTimer = setTimeout(() => doSearch(q), 400);
});

async function doSearch(q) {
  try {
    const data = await gql(Q_SEARCH, { search: q });
    const items = data.Page.media || [];
    const results = document.getElementById('search-results');
    if (items.length === 0) {
      results.innerHTML = `<div class="text-center py-12" style="color:var(--text-secondary)"><div class="text-4xl mb-3">🔍</div><p class="text-sm">Tidak ditemukan untuk "<strong>${q}</strong>"</p></div>`;
      return;
    }
    results.innerHTML = `<div class="grid grid-cols-2 gap-3">${items.map(a => renderAnimeCard(a)).join('')}</div>`;
    startUpcomingCountdowns();
  } catch (e) {
    document.getElementById('search-results').innerHTML = renderError('Pencarian gagal. Coba lagi.');
  }
}

// ── ANIME MODAL ───────────────────────────────
const animeCache = {};

async function openAnimeModal(id, preloaded = null) {
  const modal = document.getElementById('anime-modal');
  const inner = document.getElementById('anime-modal-inner');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  inner.innerHTML = `<div class="flex flex-col items-center justify-center py-20">
    <div class="w-10 h-10 border-2 rounded-full animate-spin mb-4" style="border-color:var(--bg-card);border-top-color:var(--accent);"></div>
    <p class="text-sm" style="color:var(--text-secondary)">Memuat detail...</p>
  </div>`;

  try {
    let anime;
    if (animeCache[id]) {
      anime = animeCache[id];
    } else {
      const data = await gql(`
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            genres
            averageScore
            popularity
            episodes
            status
            season
            seasonYear
            description(asHtml: false)
            trailer { id site }
            nextAiringEpisode { airingAt episode timeUntilAiring }
            startDate { year month day }
            endDate { year month day }
            studios(isMain: true) { nodes { name } }
            characters(sort: [ROLE, RELEVANCE], perPage: 12) {
              edges {
                role
                node {
                  id
                  name { full }
                  image { large medium }
                  description
                  dateOfBirth { year month day }
                }
              }
            }
          }
        }`, { id });
      anime = data.Media;
      animeCache[id] = anime;
    }
    inner.innerHTML = renderAnimeModalContent(anime);
    startUpcomingCountdowns();
  } catch (e) {
    inner.innerHTML = renderError('Gagal memuat detail anime.');
  }
}

function renderAnimeModalContent(anime) {
  const title = anime.title.english || anime.title.romaji;
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const banner = anime.bannerImage;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A';
  const genres = (anime.genres || []).map(g => `<span class="genre-badge text-xs px-2 py-0.5 rounded-full font-medium">${g}</span>`).join('');
  const desc = (anime.description || 'Tidak ada deskripsi.').replace(/<[^>]*>/g, '');
  const isFav = state.favorites.some(f => f.id === anime.id);
  const studio = anime.studios?.nodes?.[0]?.name || 'Unknown';
  const statusMap = { RELEASING: '🟢 Ongoing', FINISHED: '🔴 Selesai', NOT_YET_RELEASED: '🔵 Upcoming', CANCELLED: '⚫ Dibatalkan' };
  const statusStr = statusMap[anime.status] || anime.status;

  // Trailer
  let trailerHtml = '';
  if (anime.trailer?.id && anime.trailer?.site === 'youtube') {
    trailerHtml = `
      <div class="px-4 mb-4">
        <h4 class="font-display font-bold text-sm mb-2" style="color:var(--text-secondary)">TRAILER</h4>
        <div class="trailer-wrapper">
          <iframe src="https://www.youtube.com/embed/${anime.trailer.id}?autoplay=1&mute=1&loop=1&playlist=${anime.trailer.id}&controls=1&rel=0"
            allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>`;
  }

  // Characters
  let charsHtml = '';
  const chars = anime.characters?.edges || [];
  if (chars.length > 0) {
    const charItems = chars.map(edge => {
      const char = edge.node;
      const img = char.image?.large || char.image?.medium;
      const role = edge.role;
      const roleColor = role === 'MAIN' ? 'var(--accent)' : 'var(--text-secondary)';
      return `<div class="flex flex-col items-center gap-1 cursor-pointer" onclick="openCharModal(${JSON.stringify(char).replace(/"/g,'&quot;')}, '${role}')">
        <div class="char-avatar">
          <img src="${img}" alt="${char.name.full}" loading="lazy" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${char.id}'" />
        </div>
        <span class="text-[9px] font-medium text-center leading-tight" style="color:${roleColor};max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${char.name.full.split(' ')[0]}</span>
      </div>`;
    }).join('');

    charsHtml = `
      <div class="px-4 mb-4">
        <h4 class="font-display font-bold text-sm mb-2" style="color:var(--text-secondary)">KARAKTER</h4>
        <div class="flex flex-wrap gap-3">${charItems}</div>
      </div>`;
  }

  // Rating bar
  const ratingPct = anime.averageScore || 0;

  // Next airing
  let nextAiringHtml = '';
  if (anime.nextAiringEpisode) {
    const { airingAt, episode, timeUntilAiring } = anime.nextAiringEpisode;
    nextAiringHtml = `<div class="mt-2 p-2 rounded-xl text-xs" style="background:var(--accent-dim);border:1px solid rgba(255,31,163,0.2);">
      <span style="color:var(--accent)" class="font-semibold">Ep.${episode}</span>
      <span style="color:var(--text-secondary)"> tayang </span>
      <span style="color:var(--text-primary)" class="font-semibold">${formatTimeWIB(airingAt)}</span>
      <span style="color:var(--text-secondary)"> · </span>
      <span style="color:var(--accent);font-family:'Syne',monospace;" data-airing-cd="${airingAt}">${formatCountdown(timeUntilAiring)}</span>
    </div>`;
  }

  return `
    <!-- Banner -->
    <div class="relative" style="height:180px;overflow:hidden;">
      ${banner ? `<img src="${banner}" class="w-full h-full object-cover" style="filter:brightness(0.6)" />` : `<div class="w-full h-full" style="background:linear-gradient(135deg,var(--accent-dim),var(--bg-secondary));"></div>`}
      <div class="absolute inset-0" style="background:linear-gradient(to top,var(--bg-secondary) 0%,transparent 60%)"></div>
    </div>

    <!-- Main info -->
    <div class="px-4 -mt-12 mb-4 flex gap-3 items-end">
      <img src="${cover}" alt="${title}" class="rounded-2xl flex-shrink-0 border-2 object-cover shadow-lg" style="width:80px;height:112px;border-color:var(--bg-secondary);" onerror="this.src='https://via.placeholder.com/80x112/1a1a1a/888888?text=N/A'" />
      <div class="flex-1 min-w-0 pb-1">
        <h2 class="font-display font-bold text-lg leading-tight mb-1 line-clamp-2">${title}</h2>
        <p class="text-xs mb-1" style="color:var(--text-secondary)">${anime.title.native || ''}</p>
        <div class="flex flex-wrap gap-1">${genres}</div>
      </div>
    </div>

    <!-- Stats row -->
    <div class="px-4 mb-4 grid grid-cols-4 gap-2">
      <div class="text-center rounded-xl py-2" style="background:var(--bg-card);">
        <div class="font-display font-bold text-sm gradient-text">★ ${score}</div>
        <div class="text-[10px]" style="color:var(--text-secondary)">Rating</div>
      </div>
      <div class="text-center rounded-xl py-2" style="background:var(--bg-card);">
        <div class="font-display font-bold text-sm" style="color:var(--text-primary)">${anime.episodes || '?'}</div>
        <div class="text-[10px]" style="color:var(--text-secondary)">Episode</div>
      </div>
      <div class="text-center rounded-xl py-2" style="background:var(--bg-card);">
        <div class="font-display font-bold text-[11px]" style="color:var(--text-primary)">${anime.seasonYear || '?'}</div>
        <div class="text-[10px]" style="color:var(--text-secondary)">Tahun</div>
      </div>
      <div class="text-center rounded-xl py-2" style="background:var(--bg-card);">
        <div class="font-display font-bold text-[10px]" style="color:var(--text-primary)">${statusStr}</div>
        <div class="text-[10px]" style="color:var(--text-secondary)">Status</div>
      </div>
    </div>

    <!-- Favorite + Studio -->
    <div class="px-4 mb-4 flex items-center gap-3">
      <button onclick="toggleFavorite(${anime.id}, '${title.replace(/'/g,"\\'")}', '${cover}')" class="fav-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-1 ${isFav ? 'active' : ''}" style="background:${isFav ? 'var(--accent)' : 'var(--bg-card)'};color:${isFav ? 'white' : 'var(--text-primary)'};border:1px solid ${isFav ? 'var(--accent)' : 'var(--border)'};" data-fav-id="${anime.id}">
        <svg class="w-4 h-4" fill="${isFav ? 'currentColor' : 'none'}" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
        </svg>
        ${isFav ? 'Difavoritkan' : 'Tambah Favorit'}
      </button>
      <div class="text-xs px-3 py-2 rounded-xl" style="background:var(--bg-card);color:var(--text-secondary);">🏢 ${studio}</div>
    </div>

    ${nextAiringHtml ? `<div class="px-4 mb-4">${nextAiringHtml}</div>` : ''}

    <!-- Description -->
    <div class="px-4 mb-4">
      <h4 class="font-display font-bold text-sm mb-2" style="color:var(--text-secondary)">SINOPSIS</h4>
      <p class="text-xs leading-relaxed" style="color:var(--text-primary)">${desc.slice(0, 350)}${desc.length > 350 ? '...' : ''}</p>
    </div>

    <!-- Rating bar -->
    <div class="px-4 mb-4">
      <div class="flex justify-between text-xs mb-1">
        <span style="color:var(--text-secondary)">Skor AniList</span>
        <span style="color:var(--accent)" class="font-bold">${ratingPct}/100</span>
      </div>
      <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--bg-card);">
        <div class="rating-bar h-full rounded-full" style="width:${ratingPct}%"></div>
      </div>
    </div>

    <!-- Characters -->
    ${charsHtml}

    <!-- Trailer -->
    ${trailerHtml}

    <div class="h-6"></div>
  `;
}

document.getElementById('close-anime-modal').addEventListener('click', closeAnimeModal);
document.getElementById('anime-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('anime-modal')) closeAnimeModal();
});

function closeAnimeModal() {
  document.getElementById('anime-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ── CHARACTER MODAL ───────────────────────────
function openCharModal(char, role) {
  const modal = document.getElementById('char-modal');
  const inner = document.getElementById('char-modal-inner');
  modal.classList.remove('hidden');

  const img = char.image?.large || char.image?.medium;
  const desc = (char.description || 'Tidak ada deskripsi karakter.').replace(/<[^>]*>/g, '');
  const bday = formatDate(char.dateOfBirth);
  const roleLabel = role === 'MAIN' ? 'Main Character' : role === 'SUPPORTING' ? 'Supporting' : 'Background';
  const roleColor = role === 'MAIN' ? 'var(--accent)' : 'var(--text-secondary)';

  inner.innerHTML = `
    <div class="relative">
      <img src="${img}" alt="${char.name.full}" class="w-full object-cover" style="height:240px;object-position:top;" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${char.id}'" />
      <div class="absolute inset-0" style="background:linear-gradient(to top,var(--bg-secondary) 0%,transparent 50%)"></div>
    </div>
    <div class="px-5 pb-6 -mt-6 relative">
      <h2 class="font-display font-bold text-xl mb-0.5">${char.name.full}</h2>
      <p class="text-sm font-semibold mb-3" style="color:${roleColor}">${roleLabel}</p>
      ${bday !== 'TBA' ? `<p class="text-xs mb-3" style="color:var(--text-secondary)">🎂 Lahir: <span style="color:var(--text-primary)">${bday}</span></p>` : ''}
      <p class="text-xs leading-relaxed" style="color:var(--text-secondary)">${desc.slice(0,300)}${desc.length > 300 ? '...' : ''}</p>
    </div>`;
}

document.getElementById('close-char-modal').addEventListener('click', () => {
  document.getElementById('char-modal').classList.add('hidden');
});
document.getElementById('char-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('char-modal')) document.getElementById('char-modal').classList.add('hidden');
});

// ── FAVORITES ─────────────────────────────────
function toggleFavorite(id, title, cover) {
  const idx = state.favorites.findIndex(f => f.id === id);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    showToast(`${title.slice(0,20)} dihapus dari favorit`, '💔');
  } else {
    state.favorites.push({ id, title, cover });
    showToast(`${title.slice(0,20)} ditambahkan ke favorit`, '❤️');
  }
  localStorage.setItem('neko_favorites', JSON.stringify(state.favorites));

  // Update all fav buttons
  document.querySelectorAll(`[data-fav-id="${id}"]`).forEach(btn => {
    const isFav = state.favorites.some(f => f.id === id);
    const svg = btn.querySelector('svg');
    if (isFav) {
      btn.classList.add('active');
      svg.setAttribute('fill', 'var(--accent)');
      svg.setAttribute('stroke', 'var(--accent)');
    } else {
      btn.classList.remove('active');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
    }
  });

  // Update profile fav count
  const favCountEl = document.getElementById('fav-count');
  if (favCountEl) favCountEl.textContent = state.favorites.length;
}

function renderFavorites() {
  const list = document.getElementById('fav-list');
  const empty = document.getElementById('fav-empty');
  const countEl = document.getElementById('fav-count');
  if (countEl) countEl.textContent = state.favorites.length;

  if (state.favorites.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = state.favorites.map(f => `
    <div class="anime-card rounded-xl overflow-hidden cursor-pointer" onclick="openAnimeModal(${f.id})">
      <img src="${f.cover}" alt="${f.title}" loading="lazy" class="w-full object-cover" style="aspect-ratio:2/3;" onerror="this.src='https://via.placeholder.com/100x150/1a1a1a/888888?text=N/A'" />
      <div class="p-1.5">
        <p class="text-[9px] font-semibold line-clamp-1 leading-tight">${f.title}</p>
      </div>
    </div>`).join('');
}

// ── PROFILE BUTTONS ───────────────────────────
document.getElementById('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText('088973461209').then(() => {
    showToast('Nomor HP disalin!', '📋');
  }).catch(() => showToast('Gagal menyalin', '⚠️'));
});

document.getElementById('share-btn').addEventListener('click', () => {
  if (navigator.share) {
    navigator.share({ title: 'NekoTime', text: 'Website anime premium keren!', url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Link disalin!', '🔗'));
  }
});

// ── ERROR UI ──────────────────────────────────
function renderError(msg) {
  return `<div class="text-center py-16">
    <div class="text-4xl mb-3">⚠️</div>
    <p class="text-sm font-medium mb-3" style="color:var(--text-secondary)">${msg}</p>
    <button onclick="location.reload()" class="text-xs px-4 py-2 rounded-full font-semibold" style="background:var(--accent);color:white;">Coba Lagi</button>
  </div>`;
}

// ── INIT ──────────────────────────────────────
function init() {
  // Apply saved theme
  applyTheme(state.theme);

  // Start live clock
  startLiveClock();

  // Build UI elements
  buildDayTabs();
  buildGenreFilters();
  buildSortButtons();
  setupTabs();
  setupInfiniteScroll();

  // Load initial data
  loadSchedule();

  // Update fav count
  const favCountEl = document.getElementById('fav-count');
  if (favCountEl) favCountEl.textContent = state.favorites.length;
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

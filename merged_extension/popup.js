// ─── Domain base-label helpers (mirrors background.js logic) ─────────────────
// Ensures blocking "xhamster.com" also blocks "xhamster.desi", "xhamster.xxx" etc.
function getBaseLabel(hostname) {
  const stripped = hostname
    .toLowerCase()
    .replace(/^(www\d?|m|mobile|wap|en|fr|de|es|ru|jp|cn|web|app|cdn|static|img|images|mail)\./, '');
  const parts = stripped.split('.');
  if (parts.length === 1) return parts[0];
  const twoPartTLDs = [
    'co.uk', 'com.au', 'co.in', 'org.uk', 'net.au', 'co.nz', 'co.za',
    'com.br', 'com.mx', 'co.jp', 'ne.jp', 'or.jp', 'co.kr', 'com.cn',
    'org.cn', 'com.sg', 'com.hk', 'com.tw', 'co.id', 'com.my', 'com.ph'
  ];
  if (twoPartTLDs.includes(parts.slice(-2).join('.'))) {
    return parts.length >= 3 ? parts[parts.length - 3] : parts[0];
  }
  return parts[parts.length - 2];
}

// ─── State ────────────────────────────────────────────────────────────────────
let isLoggedIn = false;
let currentTab = 'blocker';
let selectedTempMinutes = null;
let tempSiteTarget = null;
let countdownIntervals = {};

// ─── Initial categories ────────────────────────────────────────────────────────
const PRESETS = [
  {
    category: '🎮 Gaming',
    sites: [
      // Core
      'roblox.com', 'miniclip.com', 'poki.com', 'friv.com', 'coolmathgames.com', 'y8.com',
      'steampowered.com', 'kongregate.com', 'crazygames.com', 'addictinggames.com', 'agame.com',
      'gameflare.com', 'silvergames.com', 'kizi.com', '1001games.com', 'unblockedgames.com',
      // New
      'armorgames.com', 'hoodamath.com', 'unblockedgames66.com', 'unblockedgames77.com',
      'unblockedgames24h.com', 'tyronesunblockedgames.com', 'extrememath.net', 'now.gg',
      'pogo.com', 'primarygames.com', 'abcya.com', 'funbrain.com', 'mathplayground.com',
      'boredbutton.com', 'gamezhero.com', 'joygames.io', 'gamesgames.com',
      'browsergames.gg', 'insane-games.com', 'gamesloth.com', 'dragongamez.com', 'gamebrew.com',
      'freeonlinegames.com', 'ubg365.com', 'unblockedgamespremium.com',
      'scratch.mit.edu', 'poptropica.com', 'itch.io', 'newgrounds.com',
      'flashgames247.com', 'shockwave.com', 'bigfishgames.com'
    ]
  },
  {
    category: '📱 Social Media',
    sites: [
      // Core
      'facebook.com', 'instagram.com', 'tiktok.com', 'snapchat.com', 'twitter.com', 'x.com',
      'reddit.com', 'discord.com', 'linkedin.com', 'pinterest.com', 'tumblr.com',
      'telegram.org', 'whatsapp.com', 'threads.net', 'mastodon.social', 'bereal.com',
      'quora.com', 'vk.com',
      // New
      'youtube.com', 't.me', 'wechat.com', 'weibo.com', 'qq.com',
      'bluesky.social', 'lemon8-app.com', 'substack.com', 'ok.ru', 'badoo.com',
      'tinder.com', 'hinge.co', 'bumble.com', 'grindr.com', 'clubhouse.com',
      'signal.org', 'element.io', 'matrix.org', 'slack.com', 'microsoftteams.com',
      'twitch.tv', 'mixer.com', 'vimeo.com', 'dailymotion.com', 'flickr.com',
      'deviantart.com', 'patreon.com', 'fansly.com', 'medium.com', 'wordpress.com',
      'blogger.com', 'xing.com', '4chan.org', 'gaiaonline.com', 'habbo.com',
      'imvu.com', 'secondlife.com', 'aminoapps.com', 'nextdoor.com', 'strava.com',
      'meetup.com', 'eventbrite.com', 'douyin.com'
    ]
  },
  {
    category: '▶️ Video & Streaming',
    sites: [
      // Core
      'youtube.com', 'netflix.com', 'twitch.tv', 'disneyplus.com', 'primevideo.com',
      'hulu.com', 'hotstar.com', 'peacocktv.com', 'paramountplus.com', 'crunchyroll.com',
      'dailymotion.com', 'vimeo.com', 'sonyliv.com', 'zee5.com', 'mxplayer.in', 'jiocinema.com',
      // New
      'hbo.com', 'max.com', 'appletv.apple.com', 'britbox.com', 'acorn.tv',
      'starz.com', 'showtime.com', 'amcplus.com', 'sling.com', 'pluto.tv',
      'tubi.tv', 'crackle.com', 'roku.com', 'vudu.com', 'fubo.tv',
      'slingtv.com', 'youtube.tv', 'philo.com', 'directv.com',
      'iq.com', 'bilibili.com', 'iqiyi.com', 'tencentvideo.com', 'youku.com',
      'viaplay.com', 'sky.com', 'itv.com', 'channel4.com', 'my5.tv',
      'altbalaji.com', 'erosnow.com', 'hungama.com'
    ]
  },
  {
    category: '🛒 Shopping',
    sites: [
      // Core
      'amazon.com', 'ebay.com', 'etsy.com', 'aliexpress.com', 'flipkart.com',
      'meesho.com', 'myntra.com', 'nykaa.com', 'walmart.com', 'shein.com',
      'ajio.com', 'snapdeal.com', 'temu.com', 'shopify.com', 'target.com',
      'bestbuy.com', 'jiomart.com', 'bigbasket.com',
      // New
      'alibaba.com', 'taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com',
      'shopee.com', 'lazada.com', 'zalando.com', 'asos.com', 'boohoo.com',
      'nike.com', 'adidas.com', 'zara.com', 'hm.com', 'uniqlo.com',
      'homedepot.com', 'lowes.com', 'costco.com', 'ikea.com', 'wayfair.com',
      'overstock.com', 'macys.com', 'kohls.com', 'sephora.com', 'ulta.com',
      'walgreens.com', 'cvs.com', 'wish.com', 'grofers.com', 'bigcartel.com'
    ]
  },
  {
    category: '💸 Gambling',
    sites: [
      // Core
      'stake.com', 'draftkings.com', 'fanduel.com', 'bet365.com', '1xbet.com',
      'betway.com', '888casino.com', 'ignitioncasino.eu', 'chumbacasino.com',
      'luckylandslots.com', 'pulsz.com', 'mcluck.com', 'wowvegas.com',
      'hellomillions.com', 'high5casino.com', 'fortunecoins.com', 'parimatch.in',
      'dafabet.com', '4rabet.com', 'mostbet.com', 'melbet.com', '22bet.com',
      // New
      'betmgm.com', 'caesars.com', 'bovada.lv', 'slots.lv', 'superslots.ag',
      'wildcasino.ag', 'betonline.ag', 'mybookie.ag', 'sportsbetting.ag',
      'intertops.eu', 'cloudbet.com', 'bitstarz.com', 'fortunejack.com',
      'roobet.com', 'bc.game', 'rollbit.com', 'sportybet.com', '888poker.com',
      'pokerstars.com', 'partypoker.com', 'ladbrokes.com', 'williamhill.com',
      'paddypower.com', 'betfair.com', 'smarkets.com', 'kalshi.com',
      'polymarket.com', 'parimatch.com', 'megapari.com', '1win.com',
      'pin-up.casino', 'vbet.com', 'unibet.com', 'bwin.com', 'betvictor.com'
    ]
  },
  {
    category: '⚠️ Adult Content',
    sites: [
      // Core
      'pornhub.com', 'xvideos.com', 'xhamster.com', 'onlyfans.com', 'redtube.com',
      'youporn.com', 'tube8.com', 'spankbang.com', 'xnxx.com', 'xtube.com',
      'hamster.com', 'brazzers.com', 'chaturbate.com', 'livejasmin.com', 'stripchat.com',
      // New
      'beeg.com', 'youjizz.com', 'pornone.com', 'ixxx.com', 'porn.com',
      'daftsex.com', 'eporner.com', 'porntrex.com', 'veporn.net', 'hqporner.com',
      'porndig.com', 'tnaflix.com', 'motherless.com', 'bongacams.com', 'myfreecams.com',
      'camsoda.com', 'cam4.com', 'flirt4free.com', 'fansly.com', 'manyvids.com',
      'realitykings.com', 'naughtyamerica.com', 'bangbros.com', 'mofos.com',
      'digitalplayground.com', 'evilangel.com', 'blacked.com', 'tushy.com',
      'vixen.com', 'deeper.com', 'adulttime.com', 'xart.com', 'metart.com',
      'hegre-art.com', 'femjoy.com', 'eroticbeauties.net'
    ]
  }
];

// Flat set of all preset domains for quick lookup
const ALL_PRESET_SITES = new Set(PRESETS.flatMap(c => c.sites));

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPasswordSetup() {
  const result = await chrome.storage.local.get(['passwordHash']);
  return !!result.passwordHash;
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
}

function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDurationLong(ms) {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hrs  = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hrs  > 0) parts.push(`${hrs} hour${hrs > 1 ? 's' : ''}`);
  if (mins > 0) parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);
  if (secs > 0 && days === 0) parts.push(`${secs} second${secs > 1 ? 's' : ''}`);
  return parts.length > 0 ? parts.join(', ') : '0 seconds';
}

// ─── Login / Auth ─────────────────────────────────────────────────────────────
// ─── Incognito detection ──────────────────────────────────────────────────────
// Chrome provides chrome.extension.isAllowedIncognitoAccess() to check whether
// the user has toggled "Allow in Incognito" for this extension.
async function isIncognitoAllowed() {
  return new Promise(resolve => {
    chrome.extension.isAllowedIncognitoAccess(resolve);
  });
}

function applyIncognitoStatus(allowed, statusRow, statusIcon, statusText) {
  if (allowed) {
    statusRow.className = 'incognito-status-row ok';
    statusIcon.textContent = '✅';
    statusText.textContent = 'Incognito protection is ENABLED';
  } else {
    statusRow.className = 'incognito-status-row warn';
    statusIcon.textContent = '❌';
    statusText.textContent = 'Incognito NOT enabled — please follow steps above';
  }
}

async function initLoginScreen() {
  const hasPassword = await checkPasswordSetup();
  const setupMessage = document.getElementById('setupMessage');
  const confirmGroup = document.getElementById('confirmPasswordGroup');
  const loginBtn = document.getElementById('loginBtn');
  const firstTimePanel = document.getElementById('firstTimePanel');
  const warningBanner = document.getElementById('incognitoWarningBanner');

  const allowed = await isIncognitoAllowed();

  if (!hasPassword) {
    // ── First-time setup ──
    firstTimePanel.style.display = 'block';
    warningBanner.style.display = 'none';
    setupMessage.style.display = 'block';
    confirmGroup.style.display = 'block';
    loginBtn.textContent = 'Create Password';

    // Show incognito status inside the setup box
    const statusRow = document.getElementById('incognitoStatusRow');
    const statusIcon = document.getElementById('incognitoStatusIcon');
    const statusText = document.getElementById('incognitoStatusText');
    applyIncognitoStatus(allowed, statusRow, statusIcon, statusText);

    // Re-check button
    document.getElementById('recheckIncognitoBtn').onclick = async () => {
      const a = await isIncognitoAllowed();
      applyIncognitoStatus(a, statusRow, statusIcon, statusText);
    };

  } else {
    // ── Returning login ──
    firstTimePanel.style.display = 'none';
    setupMessage.style.display = 'none';
    confirmGroup.style.display = 'none';
    loginBtn.textContent = 'Login';

    // Show compact warning banner if incognito is not enabled
    if (!allowed) {
      warningBanner.style.display = 'block';
    } else {
      warningBanner.style.display = 'none';
    }
  }

  // "How to fix →" link toggle
  const helpLink = document.getElementById('showIncognitoHelpLink');
  const helpBox = document.getElementById('incognitoHelpBox');
  const closeBtn = document.getElementById('closeHelpBtn');
  if (helpLink) {
    helpLink.onclick = (e) => {
      e.preventDefault();
      helpBox.style.display = helpBox.style.display === 'none' ? 'block' : 'none';
    };
  }
  if (closeBtn) {
    closeBtn.onclick = () => { helpBox.style.display = 'none'; };
  }
}

// ─── View-only Log (no password required) ────────────────────────────────────
function initViewLog() {
  const viewLogBtn    = document.getElementById('viewLogBtn');
  const viewLogPanel  = document.getElementById('viewLogPanel');
  const loginForm = document.querySelector('.login-form');
  if (!viewLogBtn) return;

  function openLog() {
    viewLogPanel.style.display = 'flex';
    viewLogBtn.textContent = '✕ Hide Log';
    if (loginForm) loginForm.style.display = 'none';
    renderViewLog();
  }
  function closeLog() {
    viewLogPanel.style.display = 'none';
    viewLogBtn.textContent = '📊 View Browsing Log';
    if (loginForm) loginForm.style.display = '';
  }

  viewLogBtn.addEventListener('click', () => {
    viewLogPanel.style.display === 'flex' ? closeLog() : openLog();
  });
}

async function renderViewLog() {
  const result  = await chrome.storage.local.get(['webLog']);
  const webLog  = result.webLog || [];
  const statsDiv = document.getElementById('viewLogStats');
  const listDiv  = document.getElementById('viewLogList');

  const blockedCount   = webLog.filter(e => e.blocked).length;
  const allowedCount   = webLog.length - blockedCount;
  const incognitoCount = webLog.filter(e => e.incognito).length;

  statsDiv.innerHTML =
    `Total: ${webLog.length} / 500` +
    `<span style="margin-left:10px;">✅ Allowed: ${allowedCount}</span>` +
    `<span style="margin-left:10px;">🚫 Blocked: ${blockedCount}</span>` +
    `<span style="margin-left:10px;">🕵️ Incognito: ${incognitoCount}</span>`;

  if (webLog.length === 0) {
    listDiv.innerHTML = '<div class="empty-state">No browsing history logged yet</div>';
    return;
  }

  listDiv.innerHTML = webLog.slice().reverse().map(entry => {
    let displayUrl = entry.url;
    try {
      const u = new URL(entry.url);
      let path = u.pathname;
      if (path && path !== '/' && path.length > 1) {
        if (path.length > 30) path = path.substring(0, 30) + '…';
        displayUrl = u.hostname.replace(/^www\./, '') + path;
      } else {
        displayUrl = u.hostname.replace(/^www\./, '');
      }
      if (u.search) displayUrl += ' ?…';
    } catch { }

    return `
      <div class="log-item ${entry.blocked ? 'blocked' : ''} ${entry.incognito ? 'incognito' : ''}" title="${entry.url}">
        <div class="log-url">
          ${displayUrl}
          ${entry.incognito ? '<span class="log-incognito-badge">🕵️ INCOGNITO</span>' : ''}
          ${entry.blocked   ? '<span class="log-blocked-badge">🚫 BLOCKED</span>'    : ''}
        </div>
        <div class="log-time">${new Date(entry.timestamp).toLocaleString()}</div>
      </div>`;
  }).join('');
}

async function handleLogin() {
  const password = document.getElementById('passwordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;
  const hasPassword = await checkPasswordSetup();
  if (!password) { showError('Please enter a password'); return; }
  if (!hasPassword) {
    if (password.length < 4) { showError('Password must be at least 4 characters'); return; }
    if (password !== confirmPassword) { showError('Passwords do not match'); return; }
    const hash = await hashPassword(password);
    await chrome.storage.local.set({ passwordHash: hash });
    showMainScreen();
  } else {
    const result = await chrome.storage.local.get(['passwordHash']);
    const hash = await hashPassword(password);
    if (hash === result.passwordHash) {
      showMainScreen();
    } else {
      showError('Incorrect password');
      document.getElementById('passwordInput').value = '';
    }
  }
}

function showMainScreen() {
  isLoggedIn = true;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainScreen').style.display = 'block';
  loadBlockerTab();
  switchTab('blocker');
  updateAlertBadge();
}

function handleLogout() {
  isLoggedIn = false;
  Object.values(countdownIntervals).forEach(clearInterval);
  countdownIntervals = {};
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainScreen').style.display = 'none';
  document.getElementById('passwordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  initLoginScreen();
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.nav-tab').forEach(btn => {
    const tabKey = btn.dataset.tab;
    btn.classList.toggle('active', tabKey === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  if (tabName === 'blocker') {
    document.getElementById('blockerTab').classList.add('active');
  } else if (tabName === 'history') {
    document.getElementById('historyTab').classList.add('active');
    loadWebLog();
  } else if (tabName === 'alerts') {
    document.getElementById('alertsTab').classList.add('active');
    loadAlertsTab();
  }
}

// ─── Load entire blocker tab ──────────────────────────────────────────────────
async function loadBlockerTab() {
  await Promise.all([loadCustomBlocklist(), loadPresetList()]);
}

// ─── Shared: render a single blocked item row ─────────────────────────────────
function renderBlockedItem(site, tempAccess, now, isPreset = false) {
  const tempEntry = tempAccess[site];
  const isTemp = tempEntry && tempEntry.expiresAt > now;
  const remaining = isTemp ? tempEntry.expiresAt - now : 0;
  const key = site.replace(/\./g, '_');
  const baseLabel = getBaseLabel(site);

  const tempPart = isTemp
    ? `<span class="temp-active-badge">✅ <span class="countdown" id="cd-${key}">${formatMs(remaining)}</span></span>
       <button class="remove-btn temp-revoke-btn" data-site="${site}">Revoke</button>`
    : `<button class="temp-btn" data-site="${site}">⏱️ Temp</button>`;

  const removePart = isPreset
    ? `<button class="toggle-preset-btn add-preset" data-site="${site}">Remove</button>`
    : `<button class="remove-btn custom-remove-btn" data-site="${site}">Remove</button>`;

  return `
    <div class="blocked-item" id="item-${key}">
      <div style="flex:1;min-width:0;">
        <span class="site-label" title="${site}">${site}</span>
        <span class="tld-badge" title="Blocks ${baseLabel}.com, ${baseLabel}.net, ${baseLabel}.desi and all other TLDs">🌐 all TLDs</span>
      </div>
      <div class="btn-group">
        ${tempPart}
        ${isTemp ? '' : removePart}
      </div>
    </div>
  `;
}

// ─── Custom Blocklist ─────────────────────────────────────────────────────────
async function loadCustomBlocklist() {
  if (!isLoggedIn) return;

  const _r1 = await chrome.storage.local.get(['blockedSites', 'tempAccess']);
  const allBlocked = _r1.blockedSites || [];
  const tempAccess = _r1.tempAccess || {};
  const now = Date.now();

  // Custom = blocked sites that are NOT in the preset master list
  const customSites = allBlocked.filter(s => !ALL_PRESET_SITES.has(s));

  // Clear countdowns that belong to custom sites
  customSites.forEach(site => {
    const key = site.replace(/\./g, '_');
    if (countdownIntervals['custom_' + key]) {
      clearInterval(countdownIntervals['custom_' + key]);
      delete countdownIntervals['custom_' + key];
    }
  });

  const listDiv = document.getElementById('blockedList');

  if (customSites.length === 0) {
    listDiv.innerHTML = '<div class="empty-state">No custom blocked sites yet</div>';
  } else {
    listDiv.innerHTML = customSites.map(site => renderBlockedItem(site, tempAccess, now, false)).join('');

    // Start countdowns
    customSites.forEach(site => {
      const tempEntry = tempAccess[site];
      if (tempEntry && tempEntry.expiresAt > now) {
        const key = site.replace(/\./g, '_');
        countdownIntervals['custom_' + key] = setInterval(async () => {
          const rem = tempEntry.expiresAt - Date.now();
          const cdEl = document.getElementById('cd-' + key);
          if (rem <= 0) { clearInterval(countdownIntervals['custom_' + key]); loadCustomBlocklist(); }
          else if (cdEl) cdEl.textContent = formatMs(rem);
        }, 1000);
      }
    });

    // Remove buttons
    listDiv.querySelectorAll('.custom-remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await removeSiteFromStorage(e.target.dataset.site);
        loadCustomBlocklist();
      });
    });

    attachTempAndRevokeListeners(listDiv, loadCustomBlocklist);
  }
}

async function addSite() {
  if (!isLoggedIn) return;
  const input = document.getElementById('websiteInput');
  const website = input.value.trim().toLowerCase();
  if (!website) return;
  const cleanSite = website.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
  const result = await chrome.storage.local.get(['blockedSites']);
  const blockedSites = result.blockedSites || [];

  // Check if same base label already blocked under a different TLD
  const newBase = getBaseLabel(cleanSite);
  const existing = blockedSites.find(s => getBaseLabel(s) === newBase);
  if (existing) {
    // Already covered — just confirm to the parent
    input.value = '';
    showTempInfo(`"${newBase}" is already blocked (via ${existing}). All TLDs are covered.`);
    return;
  }

  if (!blockedSites.includes(cleanSite)) {
    blockedSites.push(cleanSite);
    await chrome.storage.local.set({ blockedSites });
    input.value = '';
    loadCustomBlocklist();
    if (ALL_PRESET_SITES.has(cleanSite)) loadPresetList();
  }
}

function showTempInfo(msg) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.style.background = '#e8f5e9';
  errorDiv.style.color = '#2e7d32';
  errorDiv.style.borderColor = '#a5d6a7';
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
    errorDiv.style.background = '';
    errorDiv.style.color = '';
    errorDiv.style.borderColor = '';
  }, 4000);
}

// ─── Preset Blocklist ─────────────────────────────────────────────────────────
// Track which preset categories are open (persist across re-renders)
const presetOpenState = {};

async function loadPresetList() {
  if (!isLoggedIn) return;

  const _rp = await chrome.storage.local.get(['blockedSites', 'tempAccess']);
  const allBlocked = new Set(_rp.blockedSites || []);
  const tempAccess = _rp.tempAccess || {};
  const now = Date.now();

  // Clear preset countdowns
  PRESETS.flatMap(c => c.sites).forEach(site => {
    const key = site.replace(/\./g, '_');
    if (countdownIntervals['preset_' + key]) {
      clearInterval(countdownIntervals['preset_' + key]);
      delete countdownIntervals['preset_' + key];
    }
  });

  const listDiv = document.getElementById('presetList');

  listDiv.innerHTML = PRESETS.map((category, catIdx) => {
    const blockedInCat = category.sites.filter(s => allBlocked.has(s)).length;
    const totalInCat = category.sites.length;
    const allBlockedInCat = blockedInCat === totalInCat;
    const isOpen = !!presetOpenState[catIdx];

    const btnClass = allBlockedInCat ? 'block-all-btn unblock' : 'block-all-btn';
    const btnLabel = allBlockedInCat ? 'Unblock All' : 'Block All';
    const countClass = blockedInCat > 0 ? 'preset-count-badge has-blocked' : 'preset-count-badge';
    const countLabel = `${blockedInCat}/${totalInCat} blocked`;

    const sitesHTML = category.sites.map(site => {
      const isBlocked = allBlocked.has(site);
      const tempEntry = tempAccess[site];
      const isTemp = isBlocked && tempEntry && tempEntry.expiresAt > now;
      const remaining = isTemp ? tempEntry.expiresAt - now : 0;
      const key = site.replace(/\./g, '_');

      if (isBlocked) {
        const tempPart = isTemp
          ? `<span class="temp-active-badge">✅ <span class="countdown" id="cd-${key}">${formatMs(remaining)}</span></span>
             <button class="remove-btn temp-revoke-btn" data-site="${site}">Revoke</button>`
          : `<button class="temp-btn" data-site="${site}">⏱️ Temp</button>
             <button class="toggle-preset-btn add-preset" data-site="${site}">Remove</button>`;
        return `<div class="preset-item active" id="preset-item-${key}">
          <span class="site-label">${site}</span>
          <div class="btn-group">${tempPart}</div>
        </div>`;
      } else {
        return `<div class="preset-item" id="preset-item-${key}">
          <span class="site-label">${site}</span>
          <div class="btn-group">
            <button class="toggle-preset-btn remove-preset" data-site="${site}">+ Block</button>
          </div>
        </div>`;
      }
    }).join('');

    return `
    <div class="preset-category" data-cat-idx="${catIdx}">
      <div class="preset-category-header" data-cat-idx="${catIdx}">
        <span class="preset-chevron ${isOpen ? 'open' : ''}">▶</span>
        <span class="preset-category-title">${category.category}</span>
        <span class="${countClass}">${countLabel}</span>
        <button class="${btnClass}" data-cat-idx="${catIdx}">${btnLabel}</button>
      </div>
      <div class="preset-items-body ${isOpen ? 'open' : ''}" data-cat-idx="${catIdx}">
        ${sitesHTML}
      </div>
    </div>`;
  }).join('');

  // ── Dropdown toggle ──
  listDiv.querySelectorAll('.preset-category-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking the Block All button
      if (e.target.classList.contains('block-all-btn')) return;
      const catIdx = parseInt(header.dataset.catIdx);
      presetOpenState[catIdx] = !presetOpenState[catIdx];
      const body = listDiv.querySelector(`.preset-items-body[data-cat-idx="${catIdx}"]`);
      const chevron = header.querySelector('.preset-chevron');
      if (body) body.classList.toggle('open', !!presetOpenState[catIdx]);
      if (chevron) chevron.classList.toggle('open', !!presetOpenState[catIdx]);
    });
  });

  // ── Block All / Unblock All ──
  listDiv.querySelectorAll('.block-all-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const catIdx = parseInt(e.target.dataset.catIdx);
      const category = PRESETS[catIdx];
      const result = await chrome.storage.local.get(['blockedSites']);
      let blockedSites = result.blockedSites || [];
      const allBlockedInCat = category.sites.every(s => blockedSites.includes(s));
      if (allBlockedInCat) {
        blockedSites = blockedSites.filter(s => !category.sites.includes(s));
      } else {
        category.sites.forEach(s => { if (!blockedSites.includes(s)) blockedSites.push(s); });
      }
      await chrome.storage.local.set({ blockedSites });
      loadPresetList();
    });
  });

  // ── Start countdowns ──
  PRESETS.flatMap(c => c.sites).forEach(site => {
    const tempEntry = tempAccess[site];
    if (allBlocked.has(site) && tempEntry && tempEntry.expiresAt > now) {
      const key = site.replace(/\./g, '_');
      countdownIntervals['preset_' + key] = setInterval(async () => {
        const rem = tempEntry.expiresAt - Date.now();
        const cdEl = document.getElementById('cd-' + key);
        if (rem <= 0) { clearInterval(countdownIntervals['preset_' + key]); loadPresetList(); }
        else if (cdEl) cdEl.textContent = formatMs(rem);
      }, 1000);
    }
  });

  // ── + Block buttons ──
  listDiv.querySelectorAll('.remove-preset').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const site = e.target.dataset.site;
      const result = await chrome.storage.local.get(['blockedSites']);
      const blockedSites = result.blockedSites || [];
      if (!blockedSites.includes(site)) {
        blockedSites.push(site);
        await chrome.storage.local.set({ blockedSites });
      }
      loadPresetList();
    });
  });

  // ── Remove buttons ──
  listDiv.querySelectorAll('.add-preset').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeSiteFromStorage(e.target.dataset.site);
      loadPresetList();
    });
  });

  attachTempAndRevokeListeners(listDiv, loadPresetList);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
async function removeSiteFromStorage(site) {
  const result = await chrome.storage.local.get(['blockedSites']);
  let blockedSites = result.blockedSites || [];
  blockedSites = blockedSites.filter(s => s !== site);
  await chrome.storage.local.set({ blockedSites });
}

function attachTempAndRevokeListeners(container, reloadFn) {
  // Temp buttons → open modal
  container.querySelectorAll('.temp-btn').forEach(btn => {
    btn.addEventListener('click', (e) => openTempModal(e.target.dataset.site, reloadFn));
  });

  // Revoke buttons
  container.querySelectorAll('.temp-revoke-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const site = e.target.dataset.site;
      const localResult = await chrome.storage.local.get(['tempAccess']);
      const tempAccess = localResult.tempAccess || {};
      delete tempAccess[site];
      await chrome.storage.local.set({ tempAccess });
      reloadFn();
    });
  });
}

// ─── Temp access modal ────────────────────────────────────────────────────────
let tempReloadFn = null;

function openTempModal(site, reloadFn) {
  tempSiteTarget = site;
  tempReloadFn = reloadFn;
  selectedTempMinutes = null;
  document.getElementById('modalSiteName').textContent = site;
  document.querySelectorAll('.time-option').forEach(b => b.classList.remove('selected'));
  document.getElementById('tempAccessModal').classList.add('open');
}

function closeTempModal() {
  document.getElementById('tempAccessModal').classList.remove('open');
  document.getElementById('customTimeGroup').style.display = 'none';
  document.getElementById('customHours').value = '';
  document.getElementById('customMinutes').value = '';
  tempSiteTarget = null;
  tempReloadFn = null;
  selectedTempMinutes = null;
}

async function grantTempAccess() {
  if (!tempSiteTarget || !selectedTempMinutes) {
    alert('Please select a time duration.');
    return;
  }

  let totalMinutes;
  if (selectedTempMinutes === 'custom') {
    const h = parseInt(document.getElementById('customHours').value) || 0;
    const m = parseInt(document.getElementById('customMinutes').value) || 0;
    totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) {
      alert('Please enter a valid duration (at least 1 minute).');
      return;
    }
  } else {
    totalMinutes = selectedTempMinutes;
  }

  const expiresAt = Date.now() + totalMinutes * 60 * 1000;
  const localResult = await chrome.storage.local.get(['tempAccess']);
  const tempAccess = localResult.tempAccess || {};
  tempAccess[tempSiteTarget] = { expiresAt };
  await chrome.storage.local.set({ tempAccess });
  const fn = tempReloadFn;
  closeTempModal();
  if (fn) fn();
  if (fn === loadCustomBlocklist) loadPresetList();
  else loadCustomBlocklist();
}

// ─── Web Log ──────────────────────────────────────────────────────────────────
async function loadWebLog() {
  if (!isLoggedIn) return;
  const result = await chrome.storage.local.get(['webLog']);
  const webLog = result.webLog || [];
  const logDiv = document.getElementById('webLog');
  const statsDiv = document.getElementById('logStats');
  const blockedCount = webLog.filter(e => e.blocked).length;
  const allowedCount = webLog.length - blockedCount;
  const incognitoCount = webLog.filter(e => e.incognito).length;
  statsDiv.innerHTML = `Total: ${webLog.length} / 500 visits
    <span style="margin-left:15px;">✅ Allowed: ${allowedCount}</span>
    <span style="margin-left:10px;">🚫 Blocked: ${blockedCount}</span>
    <span style="margin-left:10px;">🕵️ Incognito: ${incognitoCount}</span>`;
  if (webLog.length === 0) {
    logDiv.innerHTML = '<div class="empty-state">No browsing history logged yet</div>';
    return;
  }
  logDiv.innerHTML = webLog.slice().reverse().map(entry => {
    let displayUrl = entry.url;
    try {
      const urlObj = new URL(entry.url);
      let cleanDomain = urlObj.hostname.replace(/^www\./, '');
      let path = urlObj.pathname;
      if (path && path !== '/' && path.length > 1) {
        if (path.length > 30) path = path.substring(0, 30) + '...';
        displayUrl = cleanDomain + path;
      } else {
        displayUrl = cleanDomain;
      }
      if (urlObj.search) displayUrl += ' ?...';
    } catch (e) { /* use original */ }
    return `
      <div class="log-item ${entry.blocked ? 'blocked' : ''} ${entry.incognito ? 'incognito' : ''}" title="${entry.url}">
        <div class="log-url">
          ${displayUrl}
          ${entry.incognito ? '<span class="log-incognito-badge">🕵️ INCOGNITO</span>' : ''}
          ${entry.blocked ? '<span class="log-blocked-badge">🚫 BLOCKED</span>' : ''}
        </div>
        <div class="log-time">${new Date(entry.timestamp).toLocaleString()}</div>
      </div>`;
  }).join('');
}

async function clearWebLog() {
  if (!isLoggedIn) return;
  if (confirm('Are you sure you want to clear the entire web log?')) {
    await chrome.storage.local.set({ webLog: [] });
    loadWebLog();
  }
}

// ─── Keyword Alert System ─────────────────────────────────────────────────────
const PRESET_KEYWORDS = [
  {
    group: '🎰 Gambling',
    keywords: [
      'casino', 'poker', 'jackpot', 'wager', 'lottery', 'blackjack', 'roulette',
      'sportsbook', 'bookie', 'parlay', 'handicap', 'tipster', 'payout', 'gambling',
      'betting site', 'online casino', 'live casino', 'spin wheel', 'scratch card', 'sweepstakes',
      'cryptobet', 'sportsbet', 'craps', 'draftkings', 'fanduel', 'pokerstars',
      'roulette wheel', 'all-in bet', 'prop bet', 'overunder', 'bookmaker', 'handicapper', 'closing line',
      'moneyline', 'pointspread', 'futures bet', 'live betting', 'inplay bet', 'sharp bet',
      'fade the public', 'steam move', 'arbitrage betting', 'matched betting',
      'teaser bet', 'parlay boost', 'risk free bet', 'promo abuse',
      'baccarat', 'pachinko', 'raffle ticket', 'instant win', 'no deposit bonus',
      'welcome bonus', 'reload bonus', 'cashback offer', 'high roller casino',
      'rollbit', 'roobet', 'duelbits', 'gamdom', 'bcgame', 'bitsler', 'trustdice', 'bitkong',
      'duckdice', 'primedice', 'freebitco.in', 'rakeback', 'crash game gambling',
      'plinko gambling', 'mines game gambling', 'aviator game gambling',
      'csgoempire', 'csgoluck', 'daddyskins', 'bloodycase', 'hellcase', 'datdrop', 'key-drop',
      'csgopolygon', 'skin betting', 'csgo case opening', 'crate unboxing gambling',
      '0.6% pity',
      'affiliate rakeback',
      'aviator',
      'aviator game',
      'bcgame aviator',
      'bitcoin dice',
      'blue archive gem scam',
      'case battle',
      'case opening site',
      'crash game',
      'crash multiplier',
      'crash predictor script',
      'crash x100',
      'crypto faucet gambling',
      'cs2 case opening',
      'csgo skin roulette',
      'dota2 item bet',
      'duelbits mines',
      'fate grand order quartz scam',
      'gacha scam',
      'gacha whale flex',
      'gamdom crash',
      'genshin wish simulator scam',
      'guaranteed pity scam',
      'key drop',
      'key drop gambling',
      'lightning network bet',
      'lootbox gambling',
      'mines game',
      'multiplier game',
      'no kyc casino',
      'pity guarantee scam',
      'pity hit',
      'pity rate',
      'pity system',
      'plinko',
      'provably fair',
      'provably rigged',
      'rigged crash',
      'rollbit crash',
      'roobet plinko',
      'rust gambling',
      'rust skin roulette',
      'skin battle',
      'skin casino',
      'stake crash',
      'tf2 unusual gambling',
      'valorant skin trade scam'
    ]
  },
  {
    group: '🔞 Adult',
    keywords: [
      'pornography', 'xxx site', 'nude site', 'onlyfans', 'hentai', 'adult escort', 'nsfw content',
      'explicit content', 'erotic content', 'sex chat', 'adult hookup', 'milf porn', 'camgirl',
      'webcam girl', 'adult video', 'strip club', 'pornstar', 'adult content', 'sexy pics',
      'leaked nudes', 'adult site', 'rule34', 'sexting', 'sugar daddy', 'sugar baby',
      'anal sex', 'boobs', 'gayporn', 'blowjob', 'handjob', 'threesome porn',
      'deepthroat', 'gangbang', 'bukkake', 'fisting', 'watersports kink', 'incest porn',
      'bestiality', 'lolita', 'shotacon', 'cuckold', 'hotwife', 'sissy porn', 'voyeur porn',
      'exhibitionist', 'swinger site', 'sex tape', 'revenge porn', 'mommy kink', 'teacher student sex',
      'bigass porn', 'pegging', 'taboo porn', 'step sis porn', 'step mom porn', 'daddy dom', 'mommy dom',
      'shemale', 'only fans leak', 'porn leak', 'nude leak', 'amateur porn', 'cosplay porn', 'ahegao',
      'pornhub', 'xvideos', 'xhamster', 'spankbang', 'chaturbate', 'myfreecams', 'bongacams',
      'stripchat', 'jerkmate', 'camsoda', 'thothub', 'fapello', 'coomer party',
      'e621', 'gelbooru', 'paheal', 'hentai booru', 'hentai haven', 'nhentai', 'pururin', 'exhentai',
      'porn addiction', 'coomer', 'gooning session', 'porn edging', 'pornhub premium',
      'goon cave', 'denial kink', 'chastity cage', 'ruined orgasm', 'ballbusting', 'cuckquean',
      'femdom', 'findom', 'goddess worship', 'human atm', 'wallet drain', 'blackmail fantasy',
      'giantess fetish', 'vore fetish', 'inflation fetish', 'futa', 'yiff', 'furry porn',
      'knotting', 'oviposition', 'tentacle porn', 'monster girl porn',
      'age gap',
      'anal',
      'asmr erotic',
      'asmr hentai',
      'asmr nsfw',
      'asmr porn',
      'asmr sex',
      'ass',
      'bdsm',
      'big boy videos',
      'brain rot',
      'cock',
      'creampie',
      'cum',
      'daddy kink',
      'dick',
      'dilf',
      'double penetration',
      'dp',
      'edgemaster',
      'edging',
      'erotic',
      'fetish',
      'for when the kids are asleep',
      'foursome',
      'fuck',
      'goon',
      'goon hour',
      'goon sesh',
      'gooncave',
      'goonfuel',
      'gooning',
      'grown up videos',
      'incest',
      'incognito mode porn',
      'late night scroll',
      'lesbian',
      'milf',
      'nsfw',
      'nude',
      'orgasm',
      'orgy',
      'pedophile',
      'porn',
      'porn dopamine',
      'porn rot',
      'porno',
      'pornstars',
      'private tab porn',
      'pussy',
      'scat',
      'scrolling porn',
      'secret tab porn',
      'sex',
      'sexchat',
      'sissy',
      'squirt',
      'swinger',
      'teacher student',
      'the good stuff',
      'the spicy stuff',
      'threesome',
      'tits',
      'tranny',
      'transvestite',
      'triple penetration',
      'voyeur',
      'watersports',
      'xxx'
    ]
  },
  {
    group: '🔫 Violence',
    keywords: [
      'murder', 'assassination', 'mass shooting', 'school shooting', 'gunshot wound',
      'blood bath', 'violent crime', 'brutality video', 'extremist attack', 'jihad attack',
      'hit list', 'death threat', 'snuff film', 'behead', 'decapitate', 'slaughter', 'genocide',
      'dismember', 'lynching', 'manslaughter', 'arson attack', 'homicide', 'infanticide',
      'eviscerate', 'bludgeon', 'disembowel', 'impale', 'crucify', 'vivisect', 'necrophilia',
      'cannibal', 'gore porn', 'execution video', 'beheading video',
      'liveleak', 'bestgore', 'watch people die', 'cartel execution video',
      'torture compilation', 'gore thread', 'shock site', 'faces of death',
      'dnepropetrovsk maniacs', '3 guys 1 hammer', 'no mercy in mexico', 'funky town video',
      "daisy's destruction", 'hurtcore site', 'stream execution', 'neck snap video',
      'curb stomp video', 'knockout game violence', 'one punch murder',
      'waterboarding torture', 'guillotine execution', 'gas chamber', 'firing squad execution',
      'blood eagle', 'murder tourism', 'gorehound', 'shockumentary',
      'two to the dome', 'chest entry exit wound',
      'dnepropetrovsk',
      'execution compilation',
      'gore discord invite',
      'gore site link',
      'gore telegram',
      'happy slapping compilation',
      'head stomp compilation',
      'hurtcore discord',
      'inside mexico gore',
      'isis beheading',
      'jump kick murder',
      'knockout game 2026',
      'lynching video',
      'mexican cartel gore',
      'one punch death',
      'pay to watch torture',
      'public execution stream',
      'red room request',
      'russian pow torture',
      'shock content telegram',
      'sicario execution',
      'taliban stoning video',
      'ukrainian drone gore'
    ]
  },
  {
    group: '💊 Drugs',
    keywords: [
      'cocaine', 'heroin', 'methamphetamine', 'narcotics', 'drug dealer', 'overdose',
      'fentanyl', 'xanax abuse', 'molly drug', 'ecstasy drug', 'mdma', 'lsd drug',
      'magic shrooms', 'drug edibles', 'dab pen drug', 'buy drugs online', 'opioid drugs',
      'crack cocaine', 'ketamine drug', 'adderall abuse', 'lean drug', 'codeine syrup',
      'crystal meth', 'drug plug', 'drug trip report',
      'percocet abuse', 'vicodin abuse', 'china white heroin', 'black tar heroin', 'speedball drug',
      'tina meth', 'yayo cocaine', 'snow cocaine', 'chronic weed', 'kush weed', 'dank weed',
      'weed cart', 'dab weed', 'bong rip', 'blunt weed', 'stoned high',
      'tranq drug', 'xylazine drug', 'percs opioid', 'oxycontin abuse', 'hydrocodone abuse',
      'norco abuse', 'addy drug', 'ritalin abuse', 'vyvanse abuse', 'xanax bars abuse',
      'purple drank', 'promethazine codeine', 'psilocybin drug', 'special k drug',
      'salvia drug', 'dmt drug', 'nitrous oxide abuse', 'whippets drug', 'poppers drug',
      'lean sip', 'wockhardt lean', 'actavis lean', 'sizzurp drink', 'double cup lean',
      'k-hole', 'dmt breakthrough', 'ayahuasca trip', 'salvia divinorum',
      'research chemicals', '4-aco-dmt', '2c-b drug', 'mxe drug', 'mescaline drug',
      'peyote drug', 'ibogaine', 'rc benzos', 'etizolam', 'flualprazolam', 'nbome drug',
      'krokodil drug', 'desomorphine', 'synthetic weed drug', 'bath salts drug', 'flakka drug',
      'zombie drug xylazine', 'fentanyl pressed pills', 'dirty 30s pills', 'pressed xans',
      '2c-e',
      '4-ho-met',
      'actavis',
      'bars benzo',
      'blues 30',
      'bromazolam',
      'clam benzo',
      'death 25i',
      'deso krok',
      'diclazepam',
      'dirty 30s',
      'double cup',
      'etizest',
      'etizolam drug',
      'etizolam press',
      'fent',
      'fent cut',
      'fent laced',
      'fent strip',
      'fent test',
      'fent test positive',
      'fent test strip',
      'fentanyl test strip fail',
      'flakka',
      'flakka bath salt',
      'flubromazolam',
      'hulks',
      'hulks bars',
      'k2',
      'k2 drug',
      'k2 jail high',
      'krok legs',
      'krokodil',
      'krokodil legs',
      'laced xan',
      'm30 fake',
      'm30s',
      'n-bomb trip',
      'nbome',
      'nbome blotter',
      'pressed fent',
      'pressed percs',
      'rc benzo',
      'rc drug',
      'research chem',
      'research chemical',
      'spice',
      'spice drug',
      'spice synthetic',
      'tranq city',
      'tranq dope',
      'tranq wound',
      'wockhardt',
      'xan bars',
      'xylazine',
      'xylazine wound',
      'zombie drug',
      'zombie tranq'
    ]
  },
  {
    group: '🕹️ Gaming (distraction)',
    keywords: [
      'cheat code download', 'game hack', 'free robux hack', 'aimbot download',
      'free v-bucks hack', 'game hack tool', 'wallhack', 'esp hack', 'god mode cheat',
      'skin generator hack', 'game cheat engine', 'exploit script', 'game boosting service',
      'lootbox gambling', 'gacha addiction', 'skin gambling', 'microtransaction trap',
      'pay to win', 'whale spending', 'dolphin spending', 'gacha pity system', 'pull rates gacha',
      'paywall content game', 'stamina refill', 'daily login trap', 'battle pass grind',
      'csgo case opening', 'csgo roulette', 'dota skin betting', 'rocket league gambling',
      'apex pack gambling', 'fortnite gambling', 'valorant gambling', 'genshin impact wish',
      'fgo saint quartz', 'gacha rolls', 'cs2 case opening', 'rust gambling', 'tf2 unusual trading',
      'roblox condo games', 'roblox porn games', 'minecraft anarchy server', '2b2t griefing',
      'hypixel boosting', 'minecraft duping', 'valorant boosting service', 'lol smurf account',
      'genshin reroll account',
      'blue archive gem farming', 'arknights headhunting', 'princess connect pulls',
      'azur lane oil farming', 'nikke recruitment pulls', 'wuthering waves echoes grinding',
      'genshin spending', 'gacha whale', 'event farming trap', 'skin betting site',
      '2b2t dupe glitch',
      'ark genesis duping',
      'case opening',
      'condo game',
      'condo game link',
      'crate unboxing',
      'cs2 skin bet',
      'dayz base raid scam',
      'energy refill scam',
      'f2p bait',
      'gacha pity',
      'hypixel coin scam',
      'last epoch trade scam',
      'lootbox opening',
      'minecraft donator rank scam',
      'nikke goddess mold scam',
      'palworld breeding scam',
      'path of exile rmt',
      'paywall trap',
      'pity system',
      'poe currency bot',
      'poe mirror service scam',
      'real money trading tarkov',
      'roblox avatar trade scam',
      'roblox condo',
      'roblox condo server',
      'roblox oof game',
      'roblox oofie',
      'ruble eft',
      'rust skin bet',
      'scum admin abuse',
      'stamina grind trap',
      'tarkov rmt',
      'wuthering waves reroll service',
      'zenless zone zero poll scam'
    ]
  },
  {
    group: '😔 Self-harm',
    keywords: [
      'suicide method', 'self-harm', 'cutting myself', 'suicidal ideation', 'end my life',
      'kill myself', 'want to die', 'not worth living', 'no reason to live', 'overdose on pills',
      'hang myself', 'slit wrists', 'self-injury', 'harm myself', 'pro-ana tips', 'thinspo',
      'purging tips', 'starve myself', 'eating disorder tips', 'selfharm', 'razor blades sh',
      'killing myself', 'unalive myself', 'sewerslide', 'sh relapse',
      'kms tonight', 'self delete', 'rope maxxing', 'fridge maxxing', 'svv', 'bleedout',
      'carve names skin', 'barcode scars', 'zebra stripes scars', 'fresh cuts sh',
      'sh picture thread', 'sh relapse flex', 'sh recovery sabotage',
      'edtwt', 'meanspo', 'fatspo', 'proana tips', 'promia tips', 'thinspiration',
      'thigh gap goals', 'bonespo', 'armpo', 'hip bones thinspo', 'collarbone thinspo',
      'bone smashing', 'restrict eating disorder',
      'painless suicide method', 'exit bag suicide', 'helium method suicide',
      'nitrogen hypoxia method', 'charcoal burning method', 'train method suicide',
      'wrist check sh', 'butterfly cuts sh', 'vein map sh', 'sh bleed kit',
      'goodbye thread suicide', 'suicide note template', 'ctb method', 'sn method',
      'hanging method suicide', 'partial suspension method', 'inert gas suicide',
      'exit hood bag', 'co poisoning method', 'cliff jumping method', 'bridge jump method',
      'method hopping suicide', 'tourist suicide method',
      'ana buddy discord',
      'barcode cut roadmap',
      'beans deep',
      'beans level',
      'bone smashing routine',
      'charcoal burning',
      'charcoal burning suicide',
      'cut cat scratch method',
      'ed recovery sabotage',
      'exit bag',
      'fresh cuts',
      'goal weight ana',
      'hate thread proana',
      'helium method',
      'mewing fail pics',
      'mia binge purge cycle',
      'nitrogen hypoxia',
      'proana goal weight',
      'proana thread',
      'relapse thread',
      'relapse thread sh',
      'roast me fatspo',
      'scars sh clean streak',
      'sewerslide method',
      'sh flex thread',
      'sh inspo',
      'sh meanspo',
      'sh picture',
      'sh picture dump',
      'sh relapse counter',
      'styro 0',
      'styro 1',
      'styro cuts',
      'styro depth chart',
      'thinspo thread',
      'trigger pics sh',
      'trigger warning sh',
      'unalive method',
      'zebra cut pattern'
    ]
  },
  {
    group: '🤬 Cyberbullying',
    keywords: [
      'kill yourself', 'kys threat', 'go die', 'neck yourself', 'nobody likes you',
      'you are worthless', 'ugly loser', 'fat pig insult', 'doxxing', 'swatting',
      'expose you online', 'sextortion', 'hate raid', 'cyberbully', 'harassment campaign',
      'death threat', 'revenge porn threat', 'leaked nudes threat',
      'faggot slur', 'retard slur', 'cancel campaign', 'flame war',
      'blackpilled', 'doomer fuel', 'incel tears', 'femoid', 'subhuman incel',
      'ethnicel', 'currycel', 'ricecel', 'heightmog', 'suifuel', 'ropefuel',
      'looksmaxxing failure', 'escortmaxxing',
      'an hero', 'become an hero', 'rope time kys', 'fridge yourself', 'pipe yourself',
      'rope yourself', 'neck yourself rope',
      'schizo rant', 'fedposting', 'ngmi forever', "it's so over", 'seethe and dilate',
      'clocked troon', 'manface monday', 'baldcel', 'wristcel', 'framecel',
      'cope harder seethe', 'ngmi doomer', 'redpill blackpill'
    ]
  },
  {
    group: '🚨 Predatory Behavior',
    keywords: [
      'send nudes minor', 'age play sexual', 'secret chat minor', 'dont tell anyone secret',
      'meet up alone minor', 'private chat minor', 'are you alone minor', 'grooming child',
      'minor dating older', 'private video call minor', 'what are you wearing minor',
      'underage dating', 'catfish minor', 'snapchat premium minor',
      'send nudes now', 'sendnudes', 'pic4pic', 'nude trade', 'trading nudes',
      'show me yours', 'send dick pic', 'snap me nudes', 'kik nudes',
      'are u wet', 'touch yourself cam', 'np4np', 'sfw to nsfw trade',
      "daddy's little princess", 'obey daddy', 'good girl reward', 'punishment time',
      'our little secret', 'dont tell mom', 'secret game minor', 'alone time minor',
      'discord kitten minor', 'kik trade nudes', 'snap premium nudes',
      'age regression sexual', 'littlespace sexual', 'cg/l sexual', 'ab/dl sexual',
      'sugaring minor', 'findom minor',
      'cp thread', 'cheese pizza thread', 'loli rp', 'shota rp', 'incest rp',
      'forced breeding rp', 'free use minor', 'petplay minor',
      'map pride', 'minor attracted person', 'virt pedo', 'hurtcore forum',
      'dark web onion trade', 'deep web trade', 'hidden wiki onion', 'pedobook',
      'boychat', 'girllover forum', 'cub sharing', 'loli collector', 'shota archive',
      'age play server', 'ddlg server', 'little boy little girl trade',
      'gaslight groom', 'love bomb minor', 'trauma bond minor'
    ]
  }
];

// Flat list of all preset keyword strings for lookup
const ALL_PRESET_KW = PRESET_KEYWORDS.flatMap(g => g.keywords);

async function updateAlertBadge() {
  const result = await chrome.storage.local.get(['alertsUnread']);
  const unread = result.alertsUnread || 0;
  const badge = document.getElementById('alertBadge');
  if (!badge) return;
  if (unread > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = unread > 99 ? '99+' : String(unread);
  } else {
    badge.style.display = 'none';
    badge.textContent = '';
  }
}

async function loadAlertsTab() {
  if (!isLoggedIn) return;

  // Reset unread count + clear badge
  await chrome.storage.local.set({ alertsUnread: 0 });
  const badge = document.getElementById('alertBadge');
  if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
  // Also clear extension badge
  chrome.action.setBadgeText({ text: '' });

  await Promise.all([loadKeywordManager(), renderAlertsList()]);
  initUrlScanInput();
}

async function loadKeywordManager() {
  const result = await chrome.storage.local.get(['alertKeywords', 'customAlertKeywords', 'customKwCategories', 'alertKeywordsInitialized', 'blurCategories']);
  let enabled;
  const custom = result.customAlertKeywords || [];
  // customKwCategories: { keyword: groupName } — maps custom kw to a preset category
  const customKwCategories = result.customKwCategories || {};
  // blurCategories: Set of group names where blur is ON (default: all ON)
  // Only treat null/undefined as "all on" — an explicit [] means user turned all off
  let blurCats = result.blurCategories;
  if (blurCats === undefined || blurCats === null) {
    blurCats = PRESET_KEYWORDS.map(g => g.group).concat(['✏️ Custom']);
    await chrome.storage.local.set({ blurCategories: blurCats });
  }
  const blurSet = new Set(blurCats);

  if (!result.alertKeywordsInitialized) {
    const allPreset = ALL_PRESET_KW.slice();
    await chrome.storage.local.set({ alertKeywords: allPreset, alertKeywordsInitialized: true });
    enabled = new Set(allPreset);
  } else {
    let kws = result.alertKeywords || [];
    const currentSet = new Set(kws);
    const newlyAdded = ALL_PRESET_KW.filter(kw => !currentSet.has(kw));
    if (newlyAdded.length > 0) {
      kws = kws.concat(newlyAdded);
      await chrome.storage.local.set({ alertKeywords: kws });
    }
    enabled = new Set(kws);
  }

  const container = document.getElementById('keywordManager');

  // ── Render each preset group ──
  const CHIPS_INITIAL = 20; // show first N chips before "show more"
  const presetHTML = PRESET_KEYWORDS.map((group, idx) => {
    const activeCount = group.keywords.filter(kw => enabled.has(kw)).length;
    const totalCount = group.keywords.length;
    const blurOn = blurSet.has(group.group);
    const hasMore = totalCount > CHIPS_INITIAL;
    const chipsHTML = group.keywords.map((kw, ki) => {
      const hidden = ki >= CHIPS_INITIAL ? ' kw-hidden kw-overflow' : '';
      return `<span class="kw-chip${enabled.has(kw) ? ' active' : ''}${hidden}" data-kw="${kw}">${kw}</span>`;
    }).join('');
    return `
    <div class="kw-dropdown" data-group-idx="${idx}" data-group-name="${group.group}">
      <div class="kw-dropdown-header" data-group-idx="${idx}">
        <span class="kw-dropdown-title">${group.group}</span>
        <span class="kw-dropdown-count${activeCount === 0 ? ' all-off' : ''}">${activeCount}/${totalCount}</span>
        <button class="kw-blur-toggle ${blurOn ? 'blur-on' : 'blur-off'}" data-group-name="${group.group}" title="${blurOn ? 'Blur ON — click to disable blur for this category' : 'Blur OFF — click to enable blur for this category'}">
          ${blurOn ? '🫧 Blur ON' : '👁 Blur OFF'}
        </button>
        <span class="kw-dropdown-chevron">▶</span>
      </div>
      <div class="kw-dropdown-body" style="display:none;">
        <div class="kw-search-wrap">
          <input type="text" class="kw-search-input" placeholder="Search keywords…" autocomplete="off">
          <button class="kw-search-clear" title="Clear">✕</button>
        </div>
        <div class="kw-dropdown-actions">
          <button class="kw-enable-all-btn" data-group-idx="${idx}">Enable All</button>
          <button class="kw-disable-all-btn" data-group-idx="${idx}">Disable All</button>
          <span class="kw-active-tally">${activeCount} active</span>
        </div>
        <div class="kw-chips">${chipsHTML}</div>
        <div class="kw-no-results" style="display:none;">No matching keywords</div>
        ${hasMore ? `<button class="kw-show-more" data-expanded="false">▼ Show ${totalCount - CHIPS_INITIAL} more</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const blurOnCustom = blurSet.has('✏️ Custom');
  // Build custom chips showing their assigned category badge if any
  const customChipsHTML = custom.map(kw => {
    const assignedCat = customKwCategories[kw];
    const catBadge = assignedCat ? `<span class="kw-cat-badge">${assignedCat}</span>` : '';
    return `<span class="kw-chip active custom-kw" data-kw="${kw}">${kw}${catBadge} ✕</span>`;
  }).join('');

  // Build category options for the assign dropdown
  const catOptions = PRESET_KEYWORDS.map(g => `<option value="${g.group}">${g.group}</option>`).join('');

  const customHTML = `
    <div class="kw-dropdown" data-group-name="✏️ Custom">
      <div class="kw-dropdown-header custom-dropdown-header">
        <span class="kw-dropdown-title">✏️ Custom Keywords</span>
        <span class="kw-dropdown-count">${custom.length}</span>
        <button class="kw-blur-toggle ${blurOnCustom ? 'blur-on' : 'blur-off'}" data-group-name="✏️ Custom" title="${blurOnCustom ? 'Blur ON' : 'Blur OFF'}">
          ${blurOnCustom ? '🫧 Blur ON' : '👁 Blur OFF'}
        </button>
        <span class="kw-dropdown-chevron">▶</span>
      </div>
      <div class="kw-dropdown-body" style="display:none;">
        <div class="kw-chips" id="customKwChips">${customChipsHTML}</div>
        <div style="margin-top:8px;">
          <div style="font-size:10px;color:var(--text-muted);font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Add Keyword</div>
          <div class="input-group" style="margin-bottom:6px;">
            <input type="text" id="customKwInput" placeholder="Add keyword…" style="font-size:12px;padding:6px 10px;">
            <button id="addCustomKwBtn" style="padding:6px 12px;font-size:12px;">Add</button>
          </div>
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
            <label style="font-size:11px;color:var(--text-muted);font-weight:700;white-space:nowrap;">Assign to category:</label>
            <select id="customKwCatSelect" style="flex:1;font-size:11px;padding:5px 7px;border:none;border-radius:8px;background:var(--bg);color:var(--text-main);box-shadow:inset 3px 3px 6px var(--shadow-dark),inset -3px -3px 6px var(--shadow-light);font-family:var(--font);font-weight:600;cursor:pointer;">
              <option value="">✏️ Custom (no category)</option>
              ${catOptions}
            </select>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">When assigned to a category, alerts will show that category name instead of "Custom".</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = presetHTML + customHTML;

  // ── Accordion toggle (only on header, not on blur button) ──
  container.querySelectorAll('.kw-dropdown-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.kw-blur-toggle')) return;
      const dropdown = header.parentElement;
      const body = dropdown.querySelector('.kw-dropdown-body');
      const chevron = header.querySelector('.kw-dropdown-chevron');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      chevron.classList.toggle('open', !isOpen);
      if (!isOpen) {
        // Focus search when opening
        const searchInput = body.querySelector('.kw-search-input');
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
      }
    });
  });

  // ── Search filter per group ──
  container.querySelectorAll('.kw-search-input').forEach(searchInput => {
    const body = searchInput.closest('.kw-dropdown-body');
    const chipsWrap = body.querySelector('.kw-chips');
    const noResults = body.querySelector('.kw-no-results');
    const showMoreBtn = body.querySelector('.kw-show-more');
    const clearBtn = body.querySelector('.kw-search-clear');

    function applySearch(query) {
      const q = query.trim().toLowerCase();
      clearBtn.style.display = q ? 'block' : 'none';
      let visibleCount = 0;
      chipsWrap.querySelectorAll('.kw-chip').forEach(chip => {
        const match = !q || chip.dataset.kw.includes(q);
        chip.classList.toggle('kw-hidden', !match);
        if (match) visibleCount++;
      });
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      // Hide show-more when searching
      if (showMoreBtn) showMoreBtn.style.display = q ? 'none' : '';
    }

    searchInput.addEventListener('input', e => applySearch(e.target.value));
    searchInput.addEventListener('click', e => e.stopPropagation());
    clearBtn.addEventListener('click', e => {
      e.stopPropagation();
      searchInput.value = '';
      applySearch('');
      searchInput.focus();
    });
  });

  // ── Show More / Show Less ──
  container.querySelectorAll('.kw-show-more').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const expanded = btn.dataset.expanded === 'true';
      const body = btn.closest('.kw-dropdown-body');
      const overflowChips = body.querySelectorAll('.kw-chip.kw-overflow');
      const groupIdx = btn.closest('.kw-dropdown').dataset.groupIdx;
      const totalCount = groupIdx !== undefined ? PRESET_KEYWORDS[parseInt(groupIdx)].keywords.length : 0;
      if (!expanded) {
        overflowChips.forEach(c => c.classList.remove('kw-hidden'));
        btn.dataset.expanded = 'true';
        btn.textContent = '▲ Show less';
      } else {
        overflowChips.forEach(c => c.classList.add('kw-hidden'));
        btn.dataset.expanded = 'false';
        btn.textContent = `▼ Show ${totalCount - CHIPS_INITIAL} more`;
      }
    });
  });

  // ── Blur toggle buttons ──
  container.querySelectorAll('.kw-blur-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupName = btn.dataset.groupName;
      const r = await chrome.storage.local.get(['blurCategories']);
      let cats = r.blurCategories || PRESET_KEYWORDS.map(g => g.group).concat(['✏️ Custom']);
      const isOn = cats.includes(groupName);
      if (isOn) {
        cats = cats.filter(c => c !== groupName);
      } else {
        cats.push(groupName);
      }
      await chrome.storage.local.set({ blurCategories: cats });
      loadKeywordManager();
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_BLUR_CATS', blurCategories: cats });
      } catch { /* ok */ }
    });
  });

  // ── Enable All / Disable All per group ──
  container.querySelectorAll('.kw-enable-all-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupIdx = parseInt(btn.dataset.groupIdx);
      const group = PRESET_KEYWORDS[groupIdx];
      const r = await chrome.storage.local.get(['alertKeywords']);
      let kws = r.alertKeywords || [];
      group.keywords.forEach(kw => { if (!kws.includes(kw)) kws.push(kw); });
      await chrome.storage.local.set({ alertKeywords: kws });
      loadKeywordManager();
    });
  });

  container.querySelectorAll('.kw-disable-all-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupIdx = parseInt(btn.dataset.groupIdx);
      const group = PRESET_KEYWORDS[groupIdx];
      const r = await chrome.storage.local.get(['alertKeywords']);
      let kws = (r.alertKeywords || []).filter(k => !group.keywords.includes(k));
      await chrome.storage.local.set({ alertKeywords: kws });
      loadKeywordManager();
    });
  });

  // ── Preset chip toggle ──
  container.querySelectorAll('.kw-chip:not(.custom-kw)').forEach(chip => {
    chip.addEventListener('click', async () => {
      const kw = chip.dataset.kw;
      const r = await chrome.storage.local.get(['alertKeywords']);
      let kws = r.alertKeywords || [];
      if (kws.includes(kw)) {
        kws = kws.filter(k => k !== kw);
        chip.classList.remove('active');
      } else {
        kws.push(kw);
        chip.classList.add('active');
      }
      await chrome.storage.local.set({ alertKeywords: kws });
      const dropdown = chip.closest('.kw-dropdown');
      if (dropdown) {
        const groupIdx = dropdown.dataset.groupIdx;
        if (groupIdx !== undefined) {
          const group = PRESET_KEYWORDS[parseInt(groupIdx)];
          const countEl = dropdown.querySelector('.kw-dropdown-count');
          const activeNow = dropdown.querySelectorAll('.kw-chip.active').length;
          countEl.textContent = `${activeNow}/${group.keywords.length}`;
          countEl.classList.toggle('all-off', activeNow === 0);
          const tally = dropdown.querySelector('.kw-active-tally');
          if (tally) tally.textContent = `${activeNow} active`;
        }
      }
    });
  });

  // Custom chip remove
  container.querySelectorAll('.custom-kw').forEach(chip => {
    chip.addEventListener('click', async () => {
      const kw = chip.dataset.kw;
      const r = await chrome.storage.local.get(['alertKeywords', 'customAlertKeywords', 'customKwCategories']);
      let kws = (r.alertKeywords || []).filter(k => k !== kw);
      let customKws = (r.customAlertKeywords || []).filter(k => k !== kw);
      let catMap = r.customKwCategories || {};
      delete catMap[kw];
      await chrome.storage.local.set({ alertKeywords: kws, customAlertKeywords: customKws, customKwCategories: catMap });
      chip.remove();
    });
  });

  // Add custom keyword
  const addBtn = document.getElementById('addCustomKwBtn');
  const input = document.getElementById('customKwInput');
  async function addCustomKw() {
    const kw = input.value.trim().toLowerCase();
    if (!kw) return;
    const catSelect = document.getElementById('customKwCatSelect');
    const assignedCat = catSelect ? catSelect.value : '';
    const r = await chrome.storage.local.get(['alertKeywords', 'customAlertKeywords', 'customKwCategories']);
    let kws = r.alertKeywords || [];
    let customKws = r.customAlertKeywords || [];
    let catMap = r.customKwCategories || {};
    if (!kws.includes(kw)) kws.push(kw);
    if (!customKws.includes(kw)) customKws.push(kw);
    if (assignedCat) { catMap[kw] = assignedCat; } else { delete catMap[kw]; }
    await chrome.storage.local.set({ alertKeywords: kws, customAlertKeywords: customKws, customKwCategories: catMap });
    input.value = '';
    loadKeywordManager();
  }
  addBtn.addEventListener('click', addCustomKw);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') addCustomKw(); });

}

// ─── URL Scan ─────────────────────────────────────────────────────────────────
function initUrlScanInput() {
  const scanBtn = document.getElementById('scanUrlBtn');
  const scanInput = document.getElementById('scanUrlInput');
  const scanResult = document.getElementById('scanResult');
  if (!scanBtn || !scanInput) return;

  // Remove old listeners by cloning
  const newBtn = scanBtn.cloneNode(true);
  scanBtn.parentNode.replaceChild(newBtn, scanBtn);

  newBtn.addEventListener('click', () => scanUrl());
  scanInput.addEventListener('keypress', e => { if (e.key === 'Enter') scanUrl(); });
}

async function scanUrl() {
  const input = document.getElementById('scanUrlInput');
  const resultDiv = document.getElementById('scanResult');
  let url = input.value.trim();
  if (!url) { resultDiv.innerHTML = '<span style="color:#999;">Enter a URL to scan.</span>'; return; }

  // Ensure URL has protocol
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  resultDiv.innerHTML = '<span style="color:#1565c0;">⏳ Scanning…</span>';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCAN_URL', url });
    if (response && response.error) {
      resultDiv.innerHTML = `<span style="color:#c62828;">❌ ${response.error}</span>`;
      return;
    }
    if (response && response.keywords && response.keywords.length > 0) {
      resultDiv.innerHTML = `<span style="color:#c62828;">⚠️ Found ${response.keywords.length} keyword(s):</span>
        <div class="kw-chips" style="margin-top:5px;">
          ${response.keywords.map(kw => `<span class="alert-keyword-pill">${kw}</span>`).join('')}
        </div>`;
      // Also refresh alerts list since background.js stores the alert
      renderAlertsList();
    } else {
      resultDiv.innerHTML = '<span style="color:#2e7d32;">✅ No keywords detected.</span>';
    }
  } catch (err) {
    resultDiv.innerHTML = `<span style="color:#c62828;">❌ Could not scan: ${err.message}</span>`;
  }
  input.value = '';
}

// ─── Map each keyword back to its category group ──────────────────────────────
// Async version uses customKwCategories for custom keyword category assignment
async function getKeywordCategoriesAsync(keywords) {
  const result = await chrome.storage.local.get(['customKwCategories']);
  const customKwCategories = result.customKwCategories || {};
  const kwToGroup = {};
  PRESET_KEYWORDS.forEach(g => {
    g.keywords.forEach(kw => { kwToGroup[kw] = g.group; });
  });
  const grouped = {};
  keywords.forEach(kw => {
    const group = kwToGroup[kw] || customKwCategories[kw] || '✏️ Custom';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(kw);
  });
  return grouped;
}

function getKeywordCategories(keywords) {
  const kwToGroup = {};
  PRESET_KEYWORDS.forEach(g => {
    g.keywords.forEach(kw => { kwToGroup[kw] = g.group; });
  });
  const grouped = {};
  keywords.forEach(kw => {
    const group = kwToGroup[kw] || '✏️ Custom';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(kw);
  });
  return grouped;
}

// Track which alert category rows are expanded
const alertExpandState = {};

async function renderAlertsList() {
  const stored = await chrome.storage.local.get(['alerts', 'blurCategories']);
  const alerts = (stored.alerts || []).slice().reverse();
  const listDiv = document.getElementById('alertsList');

  // Blur state — default all categories ON when nothing saved yet
  const allGroupNames = PRESET_KEYWORDS.map(g => g.group).concat(['✏️ Custom']);
  const blurCatsRaw = stored.blurCategories;
  const blurSet = new Set(
    blurCatsRaw !== undefined && blurCatsRaw !== null ? blurCatsRaw : allGroupNames
  );

  if (alerts.length === 0) {
    listDiv.innerHTML = '<div class="empty-state">No alerts yet — keyword monitoring is active</div>';
    return;
  }

  const renderedAlerts = await Promise.all(alerts.map(async (a, alertIdx) => {
    // ── Extension disabled/re-enabled alert ──
    if (a.type === 'extension_disabled') {
      const disabledStr = new Date(a.disabledAt).toLocaleString();
      const enabledStr  = new Date(a.enabledAt).toLocaleString();
      const durStr = formatDurationLong(a.duration);
      return `
        <div class="alert-item extension-disabled">
          <div class="alert-site" style="color:var(--warning);">🔌 Extension Was Disabled</div>
          <div class="alert-ext-detail"><span class="alert-ext-label">Disabled at:</span> ${disabledStr}</div>
          <div class="alert-ext-detail"><span class="alert-ext-label">Re-enabled at:</span> ${enabledStr}</div>
          <div class="alert-ext-detail"><span class="alert-ext-label">Protection off for:</span> <strong style="color:var(--danger);">${durStr}</strong></div>
          <div class="alert-time">${new Date(a.timestamp).toLocaleString()}</div>
        </div>`;
    }

    // ── Normal keyword alert ──
    let displayUrl = a.url;
    try {
      const u = new URL(a.url);
      displayUrl = u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.slice(0, 40) : '');
    } catch { }

    const grouped = await getKeywordCategoriesAsync(a.keywords);
    const categoryRows = Object.entries(grouped).map(([group, kws], catIdx) => {
      const rowId = `alert-cat-${alertIdx}-${catIdx}`;
      const isOpen = !!alertExpandState[rowId];
      const blurOn = blurSet.has(group);
      return `
        <div class="alert-cat-row" data-row-id="${rowId}">
          <div class="alert-cat-header ${isOpen ? 'open' : ''}">
            <span class="alert-cat-name">${group}</span>
            <span class="alert-cat-count">${kws.length} keyword${kws.length > 1 ? 's' : ''}</span>
            <button class="alert-blur-btn ${blurOn ? 'blur-on' : 'blur-off'}" data-group-name="${group}"
              title="${blurOn ? 'Blur ON — click to turn OFF' : 'Blur OFF — click to turn ON'}">
              ${blurOn ? '🫧 Blur ON' : '👁 Blur OFF'}
            </button>
            <span class="alert-cat-chevron ${isOpen ? 'open' : ''}">▶</span>
          </div>
          <div class="alert-cat-body ${isOpen ? 'open' : ''}">
            ${kws.map(kw => `<span class="alert-keyword-pill">${kw}</span>`).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="alert-item">
        <div class="alert-site">⚠️ ${a.site}</div>
        <div class="alert-url" title="${a.url}">${displayUrl}</div>
        <div class="alert-time">${new Date(a.timestamp).toLocaleString()}</div>
        <div class="alert-categories">${categoryRows}</div>
      </div>`;
  }));

  listDiv.innerHTML = renderedAlerts.join('');

  // ── Expand/collapse category rows ──
  listDiv.querySelectorAll('.alert-cat-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.alert-blur-btn')) return;
      const row = header.parentElement;
      const rowId = row.dataset.rowId;
      alertExpandState[rowId] = !alertExpandState[rowId];
      const body = row.querySelector('.alert-cat-body');
      const chevron = header.querySelector('.alert-cat-chevron');
      header.classList.toggle('open', !!alertExpandState[rowId]);
      body.classList.toggle('open', !!alertExpandState[rowId]);
      chevron.classList.toggle('open', !!alertExpandState[rowId]);
    });
  });

  // ── Blur toggle buttons in alert rows ──
  listDiv.querySelectorAll('.alert-blur-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const groupName = btn.dataset.groupName;
      const r = await chrome.storage.local.get(['blurCategories']);
      const allGroups = PRESET_KEYWORDS.map(g => g.group).concat(['✏️ Custom']);
      let cats = (r.blurCategories !== undefined && r.blurCategories !== null)
        ? [...r.blurCategories] : allGroups;
      const isOn = cats.includes(groupName);
      cats = isOn ? cats.filter(c => c !== groupName) : [...cats, groupName];
      await chrome.storage.local.set({ blurCategories: cats });
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_BLUR_CATS', blurCategories: cats });
      } catch { /* ok */ }
      await Promise.all([renderAlertsList(), loadKeywordManager()]);
    });
  });
}

async function clearAlerts() {
  if (!isLoggedIn) return;
  if (confirm('Clear all keyword alerts?')) {
    await chrome.storage.local.set({ alerts: [], alertsUnread: 0 });
    chrome.action.setBadgeText({ text: '' });
    renderAlertsList();
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('passwordInput').addEventListener('keypress', async e => {
  if (e.key === 'Enter') {
    // During first-time setup, Enter on password field moves to confirm field
    const hasPassword = await checkPasswordSetup();
    const confirmGroup = document.getElementById('confirmPasswordGroup');
    if (!hasPassword && confirmGroup.style.display !== 'none') {
      e.preventDefault();
      document.getElementById('confirmPasswordInput').focus();
    } else {
      handleLogin();
    }
  }
});
document.getElementById('confirmPasswordInput').addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });

document.getElementById('addBtn').addEventListener('click', addSite);
document.getElementById('websiteInput').addEventListener('keypress', e => { if (e.key === 'Enter') addSite(); });
document.getElementById('logoutBtn').addEventListener('click', handleLogout);

document.getElementById('clearLogBtn').addEventListener('click', clearWebLog);
document.getElementById('logoutBtn2').addEventListener('click', handleLogout);
document.getElementById('clearAlertsBtn').addEventListener('click', clearAlerts);

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', e => {
    // Walk up in case click landed on inner span/badge
    const tab = e.currentTarget.dataset.tab;
    if (tab) switchTab(tab);
  });
});

document.querySelectorAll('.time-option').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.time-option').forEach(b => b.classList.remove('selected'));
    e.target.classList.add('selected');
    const val = e.target.dataset.minutes;
    if (val === 'custom') {
      selectedTempMinutes = 'custom';
      document.getElementById('customTimeGroup').style.display = 'block';
      document.getElementById('customHours').focus();
    } else {
      selectedTempMinutes = parseInt(val);
      document.getElementById('customTimeGroup').style.display = 'none';
    }
  });
});

document.getElementById('modalConfirmBtn').addEventListener('click', grantTempAccess);
document.getElementById('modalCancelBtn').addEventListener('click', closeTempModal);
document.getElementById('tempAccessModal').addEventListener('click', e => {
  if (e.target === document.getElementById('tempAccessModal')) closeTempModal();
});

// ─── Dark Mode ────────────────────────────────────────────────────────────────
function applyDarkMode(dark) {
  document.body.classList.toggle('dark', dark);
  const icon = dark ? '☀️' : '🌙';
  const toggleLogin = document.getElementById('darkToggleLogin');
  const toggleMain  = document.getElementById('darkToggleMain');
  if (toggleLogin) toggleLogin.textContent = icon;
  if (toggleMain)  toggleMain.textContent  = icon;
}

async function initDarkMode() {
  // Apply instantly on load (no animation flash)
  document.body.classList.add('no-transition');
  const result = await chrome.storage.local.get(['darkMode']);
  applyDarkMode(!!result.darkMode);
  // Re-enable transitions after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('no-transition');
    });
  });
}

async function toggleDarkMode() {
  const isDark = document.body.classList.contains('dark');
  const next = !isDark;
  await chrome.storage.local.set({ darkMode: next });
  applyDarkMode(next);
}

document.getElementById('darkToggleLogin').addEventListener('click', toggleDarkMode);
document.getElementById('darkToggleMain').addEventListener('click', toggleDarkMode);

// ─── Init ─────────────────────────────────────────────────────────────────────
initDarkMode();
initLoginScreen();
initViewLog();

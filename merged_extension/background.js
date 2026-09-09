// ─── Domain matching helpers ──────────────────────────────────────────────────
function getBaseLabel(hostname) {
  const stripped = hostname
    .toLowerCase()
    .replace(/^(www\d?|m|mobile|wap|en|fr|de|es|ru|jp|cn|web|app|cdn|static|img|images|mail)\./, '');
  const parts = stripped.split('.');
  if (parts.length === 1) return parts[0];
  const twoPartTLDs = [
    'co.uk','com.au','co.in','org.uk','net.au','co.nz','co.za',
    'com.br','com.mx','co.jp','ne.jp','or.jp','co.kr','com.cn',
    'org.cn','com.sg','com.hk','com.tw','co.id','com.my','com.ph'
  ];
  if (twoPartTLDs.includes(parts.slice(-2).join('.'))) {
    return parts.length >= 3 ? parts[parts.length - 3] : parts[0];
  }
  return parts[parts.length - 2];
}

function getMatchedSite(hostname, blockedSites) {
  const visitedBase = getBaseLabel(hostname);
  return blockedSites.find(site => getBaseLabel(site.toLowerCase()) === visitedBase);
}

// ─── declarativeNetRequest: sync blocked sites → redirect rules ───────────────
// This is the ONLY method that works in incognito WITHOUT requiring the user to
// enable "Allow in Incognito" in extension settings.
// Rules redirect every request whose eTLD+1 matches a blocked site to blocked.html.

const REDIRECT_BASE = chrome.runtime.getURL('blocked.html');

async function syncBlockRules() {
  const result = await chrome.storage.local.get(['blockedSites', 'tempAccess']);
  const blockedSites = result.blockedSites || [];
  const tempAccess   = result.tempAccess   || {};
  const now = Date.now();

  // Sites with active temp access should not be redirected
  const activeSites = new Set(
    Object.entries(tempAccess)
      .filter(([, v]) => v.expiresAt > now)
      .map(([k]) => k.toLowerCase())
  );

  // Build one rule per blocked site (using urlFilter on the domain label)
  const newRules = [];
  let id = 1;
  for (const site of blockedSites) {
    if (activeSites.has(site.toLowerCase())) continue;
    const label = getBaseLabel(site);
    if (!label) continue;
    // urlFilter matches any URL whose host contains the base label
    // e.g. "xhamster" matches xhamster.com, xhamster.xxx, m.xhamster.net
    newRules.push({
      id,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site)
        }
      },
      condition: {
        urlFilter: `||${label}.`,
        resourceTypes: ['main_frame']
      }
    });
    id++;
  }

  // Remove all existing dynamic rules, then add fresh ones
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: newRules
  });
}

// ─── Storage listener — re-sync rules + schedule expiry timers on changes ──────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.blockedSites || changes.tempAccess) {
    syncBlockRules();
  }
  if (changes.tempAccess) {
    // Schedule precise expiry timers for any newly added temp access entries
    const newVal = changes.tempAccess.newValue || {};
    const now = Date.now();
    for (const [site, entry] of Object.entries(newVal)) {
      if (entry.expiresAt > now) {
        scheduleSiteExpiry(site, entry.expiresAt);
      }
    }
  }
});

// ─── Heartbeat — detect extension disable/re-enable ───────────────────────────
// A persistent alarm fires every 30s to record `lastAliveTimestamp`.
// On startup, if the gap between lastAliveTimestamp and now exceeds 90s,
// we know the extension was disabled and log an alert.

const HEARTBEAT_ALARM = 'extensionHeartbeat';
const HEARTBEAT_INTERVAL = 0.5;            // minutes (30s)
const DISABLE_GAP_THRESHOLD = 90 * 1000;   // 90 seconds

// Record the current time as "alive"
async function recordHeartbeat() {
  await chrome.storage.local.set({ lastAliveTimestamp: Date.now() });
}

// Check the gap between last heartbeat and now — if too large, extension was disabled
async function checkForDisableGap() {
  const result = await chrome.storage.local.get(['lastAliveTimestamp']);
  const lastAlive = result.lastAliveTimestamp;
  const now = Date.now();

  if (lastAlive && (now - lastAlive) > DISABLE_GAP_THRESHOLD) {
    // Extension was likely disabled — log an alert
    const stored = await chrome.storage.local.get(['alerts', 'alertsUnread']);
    let alerts = stored.alerts || [];
    let unread = (stored.alertsUnread || 0) + 1;

    alerts.push({
      type: 'extension_disabled',
      disabledAt: lastAlive,
      enabledAt: now,
      duration: now - lastAlive,
      timestamp: now
    });

    if (alerts.length > 500) alerts = alerts.slice(-500);
    await chrome.storage.local.set({ alerts, alertsUnread: unread });
    chrome.action.setBadgeBackgroundColor({ color: '#ff9800' });
    chrome.action.setBadgeText({ text: unread > 99 ? '99+' : String(unread) });
  }

  // Update heartbeat to now
  await recordHeartbeat();
}

// Listen for heartbeat alarm ticks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    recordHeartbeat();
  }
});

// ─── Top-level startup — runs every time the service worker wakes up ──────────
// This covers ALL startup scenarios:
//   • Extension re-enabled after being disabled in chrome://extensions
//   • Browser launch
//   • Extension installed/updated
//   • Service worker woken by an alarm or navigation event
// onInstalled / onStartup alone do NOT fire on re-enable — top-level code does.
(async () => {
  // 1. Check if the extension was disabled (gap in heartbeat)
  await checkForDisableGap();

  // 2. Ensure the heartbeat alarm exists (create is idempotent — replaces any existing)
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_INTERVAL });
})();

// ─── Startup sync ─────────────────────────────────────────────────────────────
syncBlockRules();

// ─── Incognito block enforcement via webNavigation ────────────────────────────
// declarativeNetRequest redirects to chrome-extension:// URLs fail silently in
// incognito because Chrome disallows navigating to extension URLs in incognito
// tabs. To fix this, we listen for navigation commits on incognito tabs and
// inject the blocked page inline whenever the navigated-to URL matches a
// blocked site. This fires BEFORE the page content renders (onCommitted fires
// after the network request but before page scripts run).

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (
    details.url.startsWith('chrome://') ||
    details.url.startsWith('edge://') ||
    details.url.startsWith('about:') ||
    details.url.startsWith('chrome-extension://')
  ) return;

  // Only handle incognito tabs here — normal tabs are handled by declarativeNetRequest
  let tab;
  try { tab = await chrome.tabs.get(details.tabId); } catch { return; }
  if (!tab.incognito) return;

  const result = await chrome.storage.local.get(['blockedSites', 'tempAccess']);
  const blockedSites = result.blockedSites || [];
  const tempAccess   = result.tempAccess   || {};
  const now = Date.now();

  let hostname;
  try { hostname = new URL(details.url).hostname.toLowerCase(); } catch { return; }

  const matchedSite = getMatchedSite(hostname, blockedSites);
  if (!matchedSite) return;

  const entry = tempAccess[matchedSite.toLowerCase()];
  if (entry && entry.expiresAt > now) return; // temp access active

  // Inject blocked page into the incognito tab
  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      func: injectBlockedPage,
      args: [matchedSite]
    });
  } catch {
    // Page not yet ready — retry once after a short delay
    setTimeout(async () => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          func: injectBlockedPage,
          args: [matchedSite]
        });
      } catch { /* tab may have closed */ }
    }, 400);
  }
});

// ─── Navigation listener (logging only) ───────────────────────────────────────
// declarativeNetRequest silently redirects to blocked.html at the network layer
// for normal tabs. The incognito enforcement listener above handles incognito.
// Here we only handle LOGGING for both cases:
//
//   1. URL is blocked.html  → extract ?site= param and log as BLOCKED (normal tabs)
//   2. URL is anything else → check blocklist and log normally (allowed/blocked)

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (
    details.url.startsWith('chrome://') ||
    details.url.startsWith('edge://') ||
    details.url.startsWith('about:')
  ) return;

  const blockedPageUrl = chrome.runtime.getURL('blocked.html');

  // ── Case 1: declarativeNetRequest redirected the tab to blocked.html ──────
  if (details.url.startsWith(blockedPageUrl)) {
    let siteParam = '';
    try {
      siteParam = new URL(details.url).searchParams.get('site') || '';
    } catch { /* ignore */ }
    // Log the original blocked site URL (reconstruct best-effort as https://<site>)
    const logUrl = siteParam ? `https://${siteParam}` : details.url;
    await logVisit(logUrl, true, details.tabId);
    return;
  }

  // ── Case 2: Normal navigation — check against blocklist ──────────────────
  const result = await chrome.storage.local.get(['blockedSites', 'tempAccess']);
  const blockedSites = result.blockedSites || [];
  const tempAccess   = result.tempAccess   || {};
  const now = Date.now();

  let hostname;
  try { hostname = new URL(details.url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return; }

  const matchedSite = getMatchedSite(hostname, blockedSites);
  if (!matchedSite) {
    await logVisit(details.url, false, details.tabId);
    return;
  }

  const entry = tempAccess[matchedSite.toLowerCase()];
  const hasTempAccess = entry && entry.expiresAt > now;
  // If temp access is active the page loads normally; log as allowed
  await logVisit(details.url, !hasTempAccess, details.tabId);
});

// ─── Temp-access expiry — instant enforcement in all tabs including incognito ──
//
// TWO layers so nothing slips through:
//   Layer 1 — setTimeout per site, fires at the exact millisecond of expiry.
//             Dies if the service worker is killed — Layer 2 catches that case.
//   Layer 2 — setInterval poll every 3 s. Keeps the service worker alive and
//             re-checks storage on every tick, so it catches any grant that
//             expired while the worker was asleep or the timer was lost.
//
// Redirect strategy per tab:
//   • scripting.executeScript  → injects window.location.replace() directly
//     into the already-loaded page — fires instantly without a full navigation.
//     Works for normal AND incognito tabs in spanning mode.
//   • tabs.update fallback     → used when executeScript fails (renderer not
//     ready, CSP blocks, or the tab hasn't finished loading yet).

const _expiryTimers = {};

function scheduleSiteExpiry(site, expiresAt) {
  if (_expiryTimers[site]) { clearTimeout(_expiryTimers[site]); delete _expiryTimers[site]; }
  const delay = expiresAt - Date.now();
  if (delay <= 0) { enforceSiteExpiry(site); return; }
  _expiryTimers[site] = setTimeout(() => enforceSiteExpiry(site), delay);
}

async function redirectTabToBlocked(tab, blockedUrl) {
  // For incognito tabs Chrome blocks navigation to chrome-extension:// URLs.
  // Instead we inject the blocked page HTML directly into the tab so it
  // renders inline — no extension URL needed. Works in both normal & incognito.
  const site = new URL(blockedUrl).searchParams.get('site') || tab.url || '';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectBlockedPage,
      args: [site]
    });
    return;
  } catch { /* renderer not ready — fall back below */ }

  // For normal tabs, navigate to the extension's blocked.html
  if (!tab.incognito) {
    try { await chrome.tabs.update(tab.id, { url: blockedUrl }); } catch { /* gone */ }
    return;
  }

  // For incognito tabs where executeScript failed (page not yet loaded),
  // wait briefly for the page to commit then inject
  setTimeout(async () => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectBlockedPage,
        args: [site]
      });
    } catch { /* tab may have closed */ }
  }, 300);
}

// This function is serialised and injected into the page — it must be self-contained.
function injectBlockedPage(site) {
  const css = `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#f2f4f8;--card:#fff;--border:#e2e6ee;--hbg:#fff5f5;--hborder:#fcd0d4;
      --abg:#fffbf0;--aborder:#fde68a;--primary:#4a67d4;--danger:#c0392b;
      --dlight:#fdecea;--dmid:#e85b6a;--amber:#b45309;--alight:#fef3c7;
      --green:#166534;--glight:#dcfce7;--gmid:#4ab87a;
      --tmain:#1a2340;--tbody:#374151;--tmuted:#6b7280;--tlight:#9ca3af;
      --shadow:0 4px 24px rgba(0,0,0,.08);--r:18px;--rs:10px;
      --font:'Segoe UI',Arial,system-ui,sans-serif}
    body{font-family:var(--font);background:var(--bg);color:var(--tbody);
      min-height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:center;padding:20px;line-height:1.6}
    .wrap{width:100%;max-width:540px;display:flex;flex-direction:column}
    .hdr{background:var(--hbg);border:1.5px solid var(--hborder);border-bottom:none;
      border-radius:var(--r) var(--r) 0 0;padding:26px 30px 20px;text-align:center}
    .badge{display:inline-flex;align-items:center;gap:6px;background:var(--dlight);
      border:1px solid var(--hborder);border-radius:20px;padding:5px 14px;
      font-size:11px;font-weight:800;color:var(--danger);letter-spacing:1px;
      text-transform:uppercase;margin-bottom:12px}
    .dot{width:7px;height:7px;border-radius:50%;background:var(--dmid);
      animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
    h1{font-size:24px;font-weight:900;color:var(--tmain);margin-bottom:10px}
    .srow{display:inline-flex;align-items:center;gap:8px;background:var(--dlight);
      border:1px solid var(--hborder);border-radius:10px;padding:7px 16px;
      font-size:14px;font-weight:800;color:var(--danger)}
    .body{background:var(--card);border:1.5px solid var(--border);border-top:none;
      border-radius:0 0 var(--r) var(--r);box-shadow:var(--shadow)}
    .why{padding:18px 26px;border-bottom:1px solid var(--border);
      background:var(--abg);border-left:4px solid var(--amber)}
    .wlbl{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--amber);margin-bottom:7px}
    .wrow{display:flex;align-items:flex-start;gap:11px}
    .wico{font-size:21px;flex-shrink:0;margin-top:1px}
    .wtxt{font-size:13px;font-weight:600;color:var(--tbody);line-height:1.6}
    .tag{display:inline-block;margin-top:6px;background:var(--alight);
      border:1px solid var(--aborder);color:var(--amber);border-radius:6px;
      padding:2px 9px;font-size:11px;font-weight:800}
    .tips{padding:18px 26px;border-bottom:1px solid var(--border);border-left:4px solid var(--gmid)}
    .tlbl{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--green);margin-bottom:9px}
    .tlist{display:flex;flex-direction:column;gap:7px;list-style:none}
    .tlist li{display:flex;align-items:flex-start;gap:9px;font-size:13px;
      font-weight:600;color:var(--tbody);line-height:1.5}
    .tdot{width:19px;height:19px;border-radius:50%;background:var(--glight);
      border:1.5px solid var(--gmid);display:flex;align-items:center;
      justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px}
    .zones{padding:18px 26px 22px}
    .zlbl{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;
      color:var(--primary);margin-bottom:10px}
    .zgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .zlink{display:flex;align-items:center;gap:8px;padding:9px 12px;
      background:var(--bg);border:1.5px solid var(--border);border-radius:var(--rs);
      text-decoration:none;color:var(--tmain);font-size:12px;font-weight:700}
    .zlink:hover{border-color:var(--primary);color:var(--primary)}
    .zico{font-size:17px;flex-shrink:0}
    .zname{font-size:11px;font-weight:700}
    .zdesc{font-size:10px;color:var(--tmuted);font-weight:600;margin-top:1px}
    .quote{margin-top:14px;text-align:center;padding:11px 18px;background:var(--card);
      border:1.5px solid var(--border);border-radius:var(--r)}
    .qt{font-size:12px;font-weight:700;font-style:italic;color:var(--tmuted)}
    .qa{font-size:10px;font-weight:800;color:var(--tlight);margin-top:3px}
    .footer{margin-top:12px;text-align:center;font-size:11px;font-weight:600;color:var(--tlight)}
  `;

  const TIPS_DEFAULT = [
    ['🛡️','Never share your name, school, or address with a website you dont recognise.'],
    ['💬','If something online makes you feel unsafe, talk to a trusted adult straight away.'],
  ];
  const TIPS_ADULT = [
    ['🛡️','Never share your personal information on websites you dont know.'],
    ['🔒','This content is blocked because it is only meant for adults.'],
  ];
  const TIPS_GAMBLING = [
    ['💰','Real-money gambling can be very addictive. Never share payment information.'],
    ['⚠️','Gambling platforms are designed to make you spend more. They are restricted for your protection.'],
  ];
  const TIPS_SOCIAL = [
    ['🔒','Never share your real name, school, or phone number on social media.'],
    ['👥','Not everyone online is who they say they are. Only connect with people you know.'],
  ];

  const QUOTES = [
    ['The secret of getting ahead is getting started.','Mark Twain'],
    ['The future depends on what you do today.','Mahatma Gandhi'],
    ['Discipline is choosing between what you want now and what you want most.','Abraham Lincoln'],
    ['It always seems impossible until its done.','Nelson Mandela'],
    ['Success is the sum of small efforts, repeated day in and day out.','Robert Collier'],
  ];

  function getLabel(h) {
    const s = h.toLowerCase().replace(/^(www\d?|m|mobile|wap)\./,'');
    const p = s.split('.');
    if (p.length===1) return p[0];
    const two=['co.uk','com.au','co.in','com.br','com.mx'];
    if (two.includes(p.slice(-2).join('.'))) return p.length>=3?p[p.length-3]:p[0];
    return p[p.length-2];
  }

  let hostname = site;
  try { hostname = new URL(site.includes('://') ? site : 'https://'+site).hostname; } catch {}
  const base = getLabel(hostname);

  const DB = {
    pornhub:{ico:'🔞',tag:'Unsafe Content',why:'This site contains explicit adult material not appropriate for minors.',tips:TIPS_ADULT},
    xvideos:{ico:'🔞',tag:'Unsafe Content',why:'This site contains explicit adult material not appropriate for minors.',tips:TIPS_ADULT},
    xhamster:{ico:'🔞',tag:'Unsafe Content',why:'This site contains explicit adult material not appropriate for minors.',tips:TIPS_ADULT},
    onlyfans:{ico:'🔞',tag:'Unsafe Content',why:'This site hosts adult-only content and is restricted for your protection.',tips:TIPS_ADULT},
    chaturbate:{ico:'🔞',tag:'Unsafe Content',why:'This is a live adult webcam site restricted to keep you safe.',tips:TIPS_ADULT},
    stake:{ico:'🎰',tag:'Financial Risk',why:'This is an online gambling site involving real money.',tips:TIPS_GAMBLING},
    draftkings:{ico:'🎰',tag:'Financial Risk',why:'This is a sports betting platform restricted to protect you from financial harm.',tips:TIPS_GAMBLING},
    bet365:{ico:'🎰',tag:'Financial Risk',why:'This is an international gambling site involving real money bets.',tips:TIPS_GAMBLING},
    facebook:{ico:'📱',tag:'Time Management',why:'Social media has been restricted to help you focus and stay safe.',tips:TIPS_SOCIAL},
    instagram:{ico:'📸',tag:'Time Management',why:'Instagram is restricted to help manage screen time.',tips:TIPS_SOCIAL},
    tiktok:{ico:'🎵',tag:'Time Management',why:'TikTok is restricted due to screen time and privacy concerns.',tips:TIPS_SOCIAL},
    snapchat:{ico:'👻',tag:'Privacy Risk',why:'Snapchat has privacy risks for young users.',tips:TIPS_SOCIAL},
    reddit:{ico:'🤖',tag:'Unsafe Content Risk',why:'Reddit contains many unmoderated communities.',tips:TIPS_SOCIAL},
    discord:{ico:'💬',tag:'Privacy Risk',why:'Discord involves messaging strangers and has risks for young users.',tips:TIPS_SOCIAL},
    youtube:{ico:'▶️',tag:'Time Management',why:'Video streaming is restricted to help manage screen time.',tips:TIPS_DEFAULT},
    roblox:{ico:'🎮',tag:'Time Management',why:'Gaming has been restricted to help balance screen time.',tips:TIPS_DEFAULT},
  };

  const info = DB[base] || null;
  const ico  = info ? info.ico  : '🛡️';
  const tag  = info ? info.tag  : 'Custom Block';
  const why  = info ? info.why  : 'This website has been restricted by a parent or guardian.';
  const tips = info ? info.tips : TIPS_DEFAULT;
  const q    = QUOTES[Math.floor(Math.random()*QUOTES.length)];

  const zonesHtml = [
    ['🔍','KidzSearch','Safe search','https://www.kidzsearch.com'],
    ['🎓','Khan Academy','Free lessons','https://www.khanacademy.org'],
    ['📚','Britannica Kids','Facts & info','https://www.britannica.com/kids'],
    ['🦜','Duolingo','Learn a language','https://www.duolingo.com'],
    ['📺','PBS Kids','Safe shows','https://www.pbskids.org'],
    ['🌍','Nat Geo Kids','Science & nature','https://www.nationalgeographic.com/kids'],
    ['🧮','CoolMath Games','Brain games','https://www.coolmath-games.com'],
    ['🐱','Scratch (MIT)','Create & code','https://scratch.mit.edu'],
    ['🚀','NASA Kids','Space & science','https://www.nasa.gov/kids-and-education'],
    ['💻','Tynker','Learn to code','https://www.tynker.com'],
  ].map(([i,n,d,u])=>`<a href="${u}" target="_blank" class="zlink"><span class="zico">${i}</span><div><div class="zname">${n}</div><div class="zdesc">${d}</div></div></a>`).join('');

  const tipsHtml = tips.map(([i,t])=>`<li><span class="tdot">${i}</span><span>${t}</span></li>`).join('');

  document.open();
  document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Access Restricted — Child Safety Module</title>
    <style>${css}</style></head><body>
    <div class="wrap">
      <div class="hdr">
        <div class="badge"><span class="dot"></span>Access Restricted for Your Safety</div>
        <h1>This Site Has Been Blocked</h1>
        <div class="srow">🔒 ${hostname || site}</div>
      </div>
      <div class="body">
        <div class="why">
          <div class="wlbl">⚠️ Why was this blocked?</div>
          <div class="wrow"><div class="wico">${ico}</div>
            <div class="wtxt">${why}<br><span class="tag">${tag}</span></div></div>
        </div>
        <div class="tips">
          <div class="tlbl">✅ Online Safety Reminders</div>
          <ul class="tlist">${tipsHtml}</ul>
        </div>
        <div class="zones">
          <div class="zlbl">🌐 Approved Zones — Safe Places to Go</div>
          <div class="zgrid">${zonesHtml}</div>
        </div>
      </div>
      <div class="quote"><div class="qt">"${q[0]}"</div><div class="qa">— ${q[1]}</div></div>
      <div class="footer">Child Safety Module · Active Protection</div>
    </div>
  </body></html>`);
  document.close();
}

async function enforceSiteExpiry(site) {
  delete _expiryTimers[site];

  // 1. Remove from tempAccess — triggers syncBlockRules via storage.onChanged
  const result = await chrome.storage.local.get(['tempAccess']);
  const tempAccess = result.tempAccess || {};
  if (!tempAccess[site]) return; // already cleaned up
  delete tempAccess[site];
  await chrome.storage.local.set({ tempAccess });

  // 2. Immediately redirect every open tab on this site (normal + incognito)
  const label      = getBaseLabel(site);
  const blockedUrl = chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site);
  let allTabs = [];
  try { allTabs = await chrome.tabs.query({}); } catch { return; }
  for (const tab of allTabs) {
    if (!tab.url || tab.url.startsWith('chrome-extension://')) continue;
    let host; try { host = new URL(tab.url).hostname; } catch { continue; }
    if (getBaseLabel(host) === label) await redirectTabToBlocked(tab, blockedUrl);
  }
}

// Layer 2 — poll every 3 s, catches expired grants the timer missed
async function pollTempAccessExpiry() {
  const result = await chrome.storage.local.get(['tempAccess', 'blockedSites']);
  const tempAccess  = result.tempAccess  || {};
  const blockedSites = result.blockedSites || [];
  const now = Date.now();

  for (const [site, entry] of Object.entries(tempAccess)) {
    if (entry.expiresAt > now) continue; // still valid

    // Expired — enforce exactly like the timer would
    delete tempAccess[site];
    await chrome.storage.local.set({ tempAccess });

    // Only redirect tabs if this site is actually in the blocklist
    if (!blockedSites.some(s => getBaseLabel(s) === getBaseLabel(site))) continue;

    const label      = getBaseLabel(site);
    const blockedUrl = chrome.runtime.getURL('blocked.html') + '?site=' + encodeURIComponent(site);
    let allTabs = [];
    try { allTabs = await chrome.tabs.query({}); } catch { continue; }
    for (const tab of allTabs) {
      if (!tab.url || tab.url.startsWith('chrome-extension://')) continue;
      let host; try { host = new URL(tab.url).hostname; } catch { continue; }
      if (getBaseLabel(host) === label) await redirectTabToBlocked(tab, blockedUrl);
    }
  }
}

setInterval(pollTempAccessExpiry, 3000);

// On startup — reschedule timers for active grants, enforce any that already expired
async function scheduleAllExpiryTimers() {
  const result = await chrome.storage.local.get(['tempAccess']);
  const tempAccess = result.tempAccess || {};
  const now = Date.now();
  for (const [site, entry] of Object.entries(tempAccess)) {
    if (entry.expiresAt > now) scheduleSiteExpiry(site, entry.expiresAt);
    else enforceSiteExpiry(site);
  }
}

scheduleAllExpiryTimers();

// ─── Logging ──────────────────────────────────────────────────────────────────
async function logVisit(url, isBlocked = false, tabId = null) {
  try {
    let incognito = false;
    if (tabId !== null) {
      try {
        const tab = await chrome.tabs.get(tabId);
        incognito = tab.incognito || false;
      } catch { /* tab may have closed */ }
    }
    const result = await chrome.storage.local.get(['webLog']);
    let webLog = result.webLog || [];
    webLog.push({ url, timestamp: Date.now(), blocked: isBlocked, incognito });
    if (webLog.length > 500) webLog = webLog.slice(-500);
    await chrome.storage.local.set({ webLog });
  } catch (e) {
    console.error('logVisit error:', e);
  }
}

// ─── Message handlers ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // ── Keyword Alert ──
  if (message.type === 'KEYWORD_ALERT') {
    (async () => {
      const stored = await chrome.storage.local.get(['alerts', 'alertsUnread']);
      let alerts = stored.alerts || [];
      let unread = (stored.alertsUnread || 0) + 1;
      const lastAlert = alerts[alerts.length - 1];
      if (
        lastAlert &&
        lastAlert.site === message.site &&
        JSON.stringify(lastAlert.keywords) === JSON.stringify(message.keywords) &&
        Date.now() - lastAlert.timestamp < 60_000
      ) { sendResponse({ ok: true }); return; }
      alerts.push({
        url: message.url, site: message.site,
        keywords: message.keywords, timestamp: message.timestamp || Date.now()
      });
      if (alerts.length > 500) alerts = alerts.slice(-500);
      await chrome.storage.local.set({ alerts, alertsUnread: unread });
      chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
      chrome.action.setBadgeText({ text: unread > 99 ? '99+' : String(unread) });
      sendResponse({ ok: true });
    })();
    return true;
  }

  // ── URL Scan ──
  if (message.type === 'SCAN_URL') {
    (async () => {
      try {
        const url = message.url;
        const resp = await fetch(url, {
          headers: { 'Accept': 'text/html' },
          signal: AbortSignal.timeout(10000)
        });
        if (!resp.ok) { sendResponse({ error: `HTTP ${resp.status} — could not fetch page.` }); return; }
        const html = await resp.text();
        const textContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-zA-Z]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 30000).toLowerCase();
        const corpus = `${url.toLowerCase()} ${textContent}`;
        const stored = await chrome.storage.local.get(['alertKeywords']);
        const enabledKeywords = stored.alertKeywords || [];
        const matched = enabledKeywords.filter(kw => {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`\\b${escaped}\\b`, 'i').test(corpus);
        });
        if (matched.length > 0) {
          let hostname;
          try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { hostname = url; }
          const alertData = await chrome.storage.local.get(['alerts', 'alertsUnread']);
          let alerts = alertData.alerts || [];
          let unread = (alertData.alertsUnread || 0) + 1;
          alerts.push({ url, site: `🔍 ${hostname} (scanned)`, keywords: matched, timestamp: Date.now() });
          if (alerts.length > 500) alerts = alerts.slice(-500);
          await chrome.storage.local.set({ alerts, alertsUnread: unread });
          chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
          chrome.action.setBadgeText({ text: unread > 99 ? '99+' : String(unread) });
        }
        sendResponse({ keywords: matched });
      } catch (err) { sendResponse({ error: err.message || 'Scan failed.' }); }
    })();
    return true;
  }

  // ── AI Site Analysis ──
  if (message.type === 'AI_ANALYZE') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['alerts', 'anthropicApiKey']);
        const alerts = stored.alerts || [];
        const apiKey = stored.anthropicApiKey || '';
        if (!apiKey) { sendResponse({ error: 'No API key set. Paste your Anthropic API key in the AI section.' }); return; }
        if (alerts.length === 0) { sendResponse({ sites: [] }); return; }
        const siteMap = {};
        for (const a of alerts) {
          const siteKey = (a.site || '').replace(/^🔍\s*/, '').replace(/\s*\(scanned\)$/, '');
          if (!siteMap[siteKey]) siteMap[siteKey] = { count: 0, keywords: new Set() };
          siteMap[siteKey].count++;
          (a.keywords || []).forEach(k => siteMap[siteKey].keywords.add(k));
        }
        const siteSummary = Object.entries(siteMap)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([site, data]) => `- ${site}: ${data.count} alert(s), keywords: ${[...data.keywords].join(', ')}`)
          .join('\n');
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: `You are a child safety assistant in a parental control browser extension.\nAnalyse this alert data from a child's browsing and identify which sites are most concerning and should be blocked.\n\nAlert data:\n${siteSummary}\n\nRespond ONLY with a raw JSON array — no markdown, no backticks, no explanation. Each element:\n{ "site": "<domain>", "risk": "high"|"medium"|"low", "reason": "<one sentence max 20 words>", "recommend_block": true|false }\n\nOnly include genuinely concerning sites. Order by risk descending.` }]
          })
        });
        const data = await resp.json();
        if (data.error) { sendResponse({ error: data.error.message || 'API error' }); return; }
        const raw = (data.content || []).map(c => c.text || '').join('').trim();
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) { sendResponse({ error: 'No JSON array found in AI response.' }); return; }
        sendResponse({ sites: JSON.parse(match[0]) });
      } catch (err) { sendResponse({ error: err.message || 'Analysis failed.' }); }
    })();
    return true;
  }

  return false;
});

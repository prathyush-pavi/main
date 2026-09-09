// ─── Resolve extension asset URLs ────────────────────────────────────────────
(function () {
  var extBase = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('')
    : '';
  document.querySelectorAll('img[data-ext-src]').forEach(function (img) {
    img.src = extBase + img.dataset.extSrc;
  });
})();

// ─── Category database ────────────────────────────────────────────────────────
var SITE_DB = {
  // Adult
  pornhub:    { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  xvideos:    { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  xhamster:   { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  onlyfans:   { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site hosts adult-only content and is restricted for your protection.',                tips:['ADULT'] },
  redtube:    { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  youporn:    { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  spankbang:  { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  xnxx:       { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  chaturbate: { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This is a live adult webcam site. It is restricted to keep you safe.',                    tips:['ADULT'] },
  stripchat:  { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This is an adult-only live streaming site. Access is restricted.',                        tips:['ADULT'] },
  brazzers:   { cat:'Adult Content',        tag:'Unsafe Content',               icon:'🔞', reason:'This site contains explicit adult material that is not appropriate for minors.',           tips:['ADULT'] },
  // Gambling
  stake:      { cat:'Gambling',             tag:'Privacy & Financial Risk',     icon:'🎰', reason:'This is an online gambling site that involves real money. It can be addictive and financially harmful.', tips:['GAMBLING'] },
  draftkings: { cat:'Gambling',             tag:'Financial Risk',               icon:'🎰', reason:'This is a sports betting and gambling platform. It is restricted to protect you from financial harm.',   tips:['GAMBLING'] },
  fanduel:    { cat:'Gambling',             tag:'Financial Risk',               icon:'🎰', reason:'This is a gambling and sports wagering site restricted for your protection.',              tips:['GAMBLING'] },
  bet365:     { cat:'Gambling',             tag:'Financial Risk',               icon:'🎰', reason:'This is an international gambling site involving real money bets.',                        tips:['GAMBLING'] },
  betway:     { cat:'Gambling',             tag:'Financial Risk',               icon:'🎰', reason:'This is an online gambling platform restricted for your protection.',                     tips:['GAMBLING'] },
  '1xbet':    { cat:'Gambling',             tag:'Financial Risk',               icon:'🎰', reason:'This is a high-risk online betting site with a history of predatory practices.',          tips:['GAMBLING'] },
  // Social Media
  facebook:   { cat:'Social Media',         tag:'Time Management',              icon:'📱', reason:'Social media can be distracting and may expose you to strangers. It has been restricted to help you focus.', tips:['SOCIAL'] },
  instagram:  { cat:'Social Media',         tag:'Time Management & Privacy',    icon:'📸', reason:'Instagram is restricted to help manage screen time and protect your personal information.', tips:['SOCIAL'] },
  tiktok:     { cat:'Social Media',         tag:'Time Management & Privacy Risk',icon:'🎵',reason:'TikTok has been linked to excessive screen time and data privacy concerns. It is restricted here.', tips:['SOCIAL'] },
  snapchat:   { cat:'Social Media',         tag:'Privacy Risk',                 icon:'👻', reason:'Snapchat enables private messaging with strangers and has privacy risks for young users.', tips:['SOCIAL'] },
  twitter:    { cat:'Social Media',         tag:'Time Management',              icon:'🐦', reason:'Twitter/X is restricted to help reduce distractions and limit exposure to unmoderated content.', tips:['SOCIAL'] },
  x:          { cat:'Social Media',         tag:'Time Management',              icon:'🐦', reason:'Twitter/X is restricted to help reduce distractions and limit exposure to unmoderated content.', tips:['SOCIAL'] },
  reddit:     { cat:'Social Media',         tag:'Unsafe Content Risk',          icon:'🤖', reason:'Reddit contains many unmoderated communities that may have inappropriate content.',       tips:['SOCIAL'] },
  discord:    { cat:'Social Media',         tag:'Privacy Risk',                 icon:'💬', reason:'Discord involves messaging strangers online and has risks for young users.',              tips:['SOCIAL'] },
  // Gaming
  roblox:     { cat:'Gaming',               tag:'Time Management',              icon:'🎮', reason:'Gaming has been restricted here to help you balance screen time and other activities.',   tips:['GAMING'] },
  steam:      { cat:'Gaming',               tag:'Time Management',              icon:'🎮', reason:'Gaming platforms are restricted here to help manage screen time.',                        tips:['GAMING'] },
  // Streaming
  youtube:    { cat:'Video & Streaming',    tag:'Time Management',              icon:'▶️', reason:'Video streaming is restricted here to help manage screen time and keep you focused.',     tips:['STREAMING'] },
  netflix:    { cat:'Video & Streaming',    tag:'Time Management',              icon:'🎬', reason:'Streaming services are restricted here to help manage screen time.',                      tips:['STREAMING'] },
  twitch:     { cat:'Video & Streaming',    tag:'Time Management',              icon:'🟣', reason:'Live streaming platforms are restricted here to help manage screen time.',                tips:['STREAMING'] },
};

// ─── Tip library ──────────────────────────────────────────────────────────────
var TIPS = {
  ADULT: [
    { icon:'🛡️', text:'Never share your personal information — like your real name, school, or address — on websites you don\'t know.' },
    { icon:'💬', text:'If you ever see something online that makes you feel uncomfortable, tell a trusted adult right away.' },
    { icon:'🔒', text:'Your online safety matters. This content is blocked because it is only meant for adults.' },
  ],
  GAMBLING: [
    { icon:'💰', text:'Real-money gambling can be very addictive. Never share payment information on sites you were directed to by others.' },
    { icon:'⚠️', text:'Online gambling platforms are designed to make you spend more money. They are restricted for your protection.' },
    { icon:'🛡️', text:'If you ever feel pressured to pay money for a game or website, tell a trusted adult immediately.' },
  ],
  SOCIAL: [
    { icon:'🔒', text:'Never share your real name, school name, home address, or phone number on social media or chat apps.' },
    { icon:'👥', text:'Not everyone online is who they say they are. Only accept friend requests from people you know in real life.' },
    { icon:'📸', text:'Think before you post — anything you share online can be seen by many people and can be hard to take back.' },
  ],
  GAMING: [
    { icon:'⏱️', text:'Taking regular breaks from screens is good for your eyes and your brain. Try the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.' },
    { icon:'💳', text:'Never share your parents\' payment details online or in games, even if a game asks for them.' },
    { icon:'🛡️', text:'Some games have chat features — be careful about what you share and who you talk to online.' },
  ],
  STREAMING: [
    { icon:'⏱️', text:'Too much screen time can affect your sleep and focus. Balance video time with reading, exercise, or hobbies.' },
    { icon:'🔒', text:'Do not click on pop-up ads or links that appear on streaming sites — they can lead to unsafe places.' },
    { icon:'👍', text:'There are great educational videos and documentaries available on approved platforms. Ask a parent for recommendations.' },
  ],
  DEFAULT: [
    { icon:'🛡️', text:'Never share your real name, school, or address with a website you don\'t recognise.' },
    { icon:'💬', text:'If something online ever makes you feel unsafe or uncomfortable, talk to a trusted adult straight away.' },
    { icon:'🔒', text:'Use strong, unique passwords and never share them with friends or strangers online.' },
  ],
};

// ─── Quotes ───────────────────────────────────────────────────────────────────
var QUOTES = [
  { text:'The secret of getting ahead is getting started.',                         author:'Mark Twain' },
  { text:'Small daily improvements over time lead to stunning results.',            author:'Robin Sharma' },
  { text:'Focus on being productive instead of busy.',                             author:'Tim Ferriss' },
  { text:'The future depends on what you do today.',                               author:'Mahatma Gandhi' },
  { text:'Discipline is choosing between what you want now and what you want most.',author:'Abraham Lincoln' },
  { text:'It always seems impossible until it\'s done.',                           author:'Nelson Mandela' },
  { text:'Don\'t watch the clock; do what it does. Keep going.',                  author:'Sam Levenson' },
  { text:'Success is the sum of small efforts, repeated day in and day out.',      author:'Robert Collier' },
  { text:'The only way to do great work is to love what you do.',                 author:'Steve Jobs' },
  { text:'Your time is limited, so don\'t waste it living someone else\'s life.', author:'Steve Jobs' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBaseLabel(hostname) {
  var stripped = hostname.toLowerCase()
    .replace(/^(www\d?|m|mobile|wap|en|fr|de|es|ru|jp|cn|web|app)\./, '');
  var parts = stripped.split('.');
  if (parts.length === 1) return parts[0];
  var twoPartTLDs = ['co.uk','com.au','co.in','org.uk','net.au','co.nz','co.za','com.br','com.mx'];
  if (twoPartTLDs.includes(parts.slice(-2).join('.'))) {
    return parts.length >= 3 ? parts[parts.length - 3] : parts[0];
  }
  return parts[parts.length - 2];
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────
var inExtension = (typeof chrome !== 'undefined') && !!(chrome.storage && chrome.storage.local);

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  var icon  = document.getElementById('toggleIcon');
  var label = document.getElementById('toggleLabel');
  if (icon)  icon.textContent  = dark ? '\uD83C\uDF19' : '\u2600\uFE0F'; // 🌙 ☀️
  if (label) label.textContent = dark ? 'Dark' : 'Light';
}

function saveTheme(dark) {
  if (inExtension) {
    chrome.storage.local.set({ darkMode: dark }, function () {
      if (chrome.runtime.lastError) {
        console.warn('[blocked.js] saveTheme error:', chrome.runtime.lastError.message);
      }
    });
  } else {
    try { localStorage.setItem('darkMode', dark ? '1' : '0'); } catch (e) {}
  }
}


// Keep in sync with popup / options page changes
if (inExtension) {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && 'darkMode' in changes) {
      applyTheme(!!changes.darkMode.newValue);
    }
  });
}

// ─── Incognito-safe storage helper ───────────────────────────────────────────
// chrome.storage.local.get can silently stall in incognito if the extension
// context is not fully ready. We race it against a 400 ms timeout so the page
// always finishes loading regardless.
function safeStorageGet(keys, cb) {
  var done = false;
  function finish(result) {
    if (done) return;
    done = true;
    cb(result || {});
  }
  var timer = setTimeout(function () { finish({}); }, 400);
  try {
    if (inExtension) {
      chrome.storage.local.get(keys, function (result) {
        clearTimeout(timer);
        finish(chrome.runtime.lastError ? {} : result);
      });
    } else {
      clearTimeout(timer);
      // Non-extension context: try localStorage
      try {
        var stored = localStorage.getItem('darkMode');
        finish(stored !== null ? { darkMode: stored === '1' } : {});
      } catch (e) { finish({}); }
    }
  } catch (e) {
    clearTimeout(timer);
    finish({});
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

  // Populate site name
  var params  = new URLSearchParams(window.location.search);
  var rawSite = params.get('site') || 'this site';
  document.getElementById('siteName').textContent = rawSite;

  var base = getBaseLabel(rawSite);
  var info = SITE_DB[base] || null;

  // Why section
  if (info) {
    document.getElementById('whyIcon').textContent     = info.icon;
    document.getElementById('whyText').innerHTML       = info.reason;
    document.getElementById('categoryTag').textContent = info.tag;
  } else {
    document.getElementById('whyIcon').textContent     = '\uD83D\uDEE1\uFE0F';
    document.getElementById('whyText').innerHTML       = 'This website has been restricted by a parent or guardian. <strong>Custom blocked</strong> sites are not allowed on this device.';
    document.getElementById('categoryTag').textContent = 'Custom Block';
  }

  // Tips
  var tipKey  = info ? info.tips[0] : 'DEFAULT';
  var tipSet  = TIPS[tipKey] || TIPS.DEFAULT;
  var tipsList = document.getElementById('tipsList');
  tipSet.slice(0, 2).forEach(function (t) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="tip-dot">' + t.icon + '</span><span>' + t.text + '</span>';
    tipsList.appendChild(li);
  });

  // Quote
  var q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('quoteText').textContent   = '\u201C' + q.text + '\u201D';
  document.getElementById('quoteAuthor').textContent = '\u2014 ' + q.author;

  // Wire up theme toggle button
  var btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var isDark = !document.body.classList.contains('dark');
      applyTheme(isDark);
      saveTheme(isDark);
    });
  }

  // ── Apply saved theme without flash, then unlock smooth transitions ──
  // <body class="no-transition"> is set in the HTML so the initial paint is
  // always flash-free. After the theme is applied we remove that class on the
  // next two animation frames so every subsequent change (toggle, storage sync)
  // animates smoothly — including across light/dark mode.
  safeStorageGet(['darkMode'], function (result) {
    applyTheme(!!result.darkMode);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.remove('no-transition');
      });
    });
  });

});

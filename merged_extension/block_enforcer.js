// ─── Block Enforcer — runs at document_start ──────────────────────────────────
// Fires before ANY HTML is parsed or rendered. Checks if the current URL is
// blocked and immediately overwrites the document with the blocked page.
// This is the ONLY reliable method for incognito — content scripts at
// document_start bypass CSP and chrome-extension:// URL restrictions entirely.

(function () {
  if (
    location.href.startsWith('chrome://') ||
    location.href.startsWith('chrome-extension://') ||
    location.href.startsWith('about:') ||
    location.href.startsWith('data:')
  ) return;

  function getBaseLabel(hostname) {
    const stripped = hostname.toLowerCase()
      .replace(/^(www\d?|m|mobile|wap|en|fr|de|es|ru|jp|cn|web|app|cdn|static|img|images|mail)\./, '');
    const parts = stripped.split('.');
    if (parts.length === 1) return parts[0];
    const twoPartTLDs = ['co.uk','com.au','co.in','org.uk','net.au','co.nz','co.za',
      'com.br','com.mx','co.jp','ne.jp','or.jp','co.kr','com.cn','org.cn',
      'com.sg','com.hk','com.tw','co.id','com.my','com.ph'];
    if (twoPartTLDs.includes(parts.slice(-2).join('.'))) {
      return parts.length >= 3 ? parts[parts.length - 3] : parts[0];
    }
    return parts[parts.length - 2];
  }

  function showBlockedPage(site, hostname) {
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
        text-decoration:none;color:var(--tmain);font-size:12px;font-weight:700;cursor:pointer}
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
    const q    = QUOTES[Math.floor(Math.random() * QUOTES.length)];

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
    ].map(([i,n,d,u]) =>
      `<a href="${u}" target="_blank" class="zlink">` +
      `<span class="zico">${i}</span>` +
      `<div><div class="zname">${n}</div><div class="zdesc">${d}</div></div></a>`
    ).join('');

    const tipsHtml = tips.map(([i,t]) =>
      `<li><span class="tdot">${i}</span><span>${t}</span></li>`
    ).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Access Restricted — Child Safety Module</title>
      <style>${css}</style></head><body>
      <div class="wrap">
        <div class="hdr">
          <div class="badge"><span class="dot"></span>Access Restricted for Your Safety</div>
          <h1>This Site Has Been Blocked</h1>
          <div class="srow">🔒 ${hostname}</div>
        </div>
        <div class="body">
          <div class="why">
            <div class="wlbl">⚠️ Why was this blocked?</div>
            <div class="wrow">
              <div class="wico">${ico}</div>
              <div class="wtxt">${why}<br><span class="tag">${tag}</span></div>
            </div>
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
        <div class="quote">
          <div class="qt">"${q[0]}"</div>
          <div class="qa">— ${q[1]}</div>
        </div>
        <div class="footer">Child Safety Module · Active Protection</div>
      </div>
    </body></html>`;

    // Stop any further loading of the real site
    window.stop();

    // Replace the document entirely
    document.open();
    document.write(html);
    document.close();
  }

  // chrome.storage is available in content scripts at document_start
  chrome.storage.local.get(['blockedSites', 'tempAccess'], function (result) {
    const blockedSites = result.blockedSites || [];
    if (blockedSites.length === 0) return;

    const tempAccess = result.tempAccess || {};
    const now = Date.now();

    let hostname;
    try { hostname = new URL(location.href).hostname.toLowerCase(); } catch { return; }

    const visitedBase = getBaseLabel(hostname);
    const matchedSite = blockedSites.find(s => getBaseLabel(s.toLowerCase()) === visitedBase);
    if (!matchedSite) return;

    const entry = tempAccess[matchedSite.toLowerCase()];
    if (entry && entry.expiresAt > now) return; // temp access active

    showBlockedPage(matchedSite, hostname);
  });

})();

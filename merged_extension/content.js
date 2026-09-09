// ─── Blocked Site Enforcement (works in incognito) ────────────────────────────
// Content scripts run in incognito even when chrome-extension:// URLs cannot be
// navigated to. This block runs first — before keyword scanning — and replaces
// the page with the blocked page HTML if the current site is on the blocklist.
// This is the ONLY method that reliably works in incognito.

(function () {
  if (
    location.href.startsWith('chrome://') ||
    location.href.startsWith('chrome-extension://') ||
    location.href.startsWith('about:')
  ) return;

  function _getBaseLabel(hostname) {
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

  chrome.storage.local.get(['blockedSites', 'tempAccess'], function (result) {
    const blockedSites = result.blockedSites || [];
    if (blockedSites.length === 0) return;

    const tempAccess = result.tempAccess || {};
    const now = Date.now();

    let hostname;
    try { hostname = new URL(location.href).hostname.toLowerCase(); } catch { return; }
    const visitedBase = _getBaseLabel(hostname);

    const matchedSite = blockedSites.find(
      s => _getBaseLabel(s.toLowerCase()) === visitedBase
    );
    if (!matchedSite) return;

    const entry = tempAccess[matchedSite.toLowerCase()];
    if (entry && entry.expiresAt > now) return; // temp access active

    // ── Inject the blocked page ──
    _showBlockedPage(matchedSite, hostname);
  });

  function _showBlockedPage(site, hostname) {
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
    ].map(([i,n,d,u]) => `<a href="${u}" target="_blank" class="zlink"><span class="zico">${i}</span><div><div class="zname">${n}</div><div class="zdesc">${d}</div></div></a>`).join('');

    const tipsHtml = tips.map(([i,t]) => `<li><span class="tdot">${i}</span><span>${t}</span></li>`).join('');

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
})();

// ─── Keyword Alert Content Script ─────────────────────────────────────────────
// Scans page title, URL, visible body text, meta tags, and dynamically loaded
// content for alert keywords. Works on SPAs like Reddit, Discord, etc.
// Blurs matched keyword text in the DOM — only for blur-enabled categories.

(async function () {
    if (
        location.href.startsWith('chrome://') ||
        location.href.startsWith('chrome-extension://') ||
        location.href.startsWith('about:')
    ) return;

    const result = await chrome.storage.local.get(['alertKeywords', 'customKwCategories', 'blurCategories']);
    const enabledKeywords = result.alertKeywords || [];
    if (enabledKeywords.length === 0) return;

    const customKwCategories = result.customKwCategories || {};
    // Default: ALL categories have blur ON when no preference saved yet.
    // Only treat null/undefined as "all on" — an explicit [] means user turned all off.
    const ALL_GROUP_NAMES = [
      '🎰 Gambling','🔞 Adult','🔫 Violence','💊 Drugs',
      '🕹️ Gaming (distraction)','😔 Self-harm','🤬 Cyberbullying',
      '🚨 Predatory Behavior','✏️ Custom'
    ];
    let blurCategories = new Set(
      result.blurCategories !== undefined && result.blurCategories !== null
        ? result.blurCategories
        : ALL_GROUP_NAMES
    );

    const site = location.hostname.replace(/^www\./, '');

    // ── Build reverse keyword→group lookup ──
    // (mirrors PRESET_KEYWORDS from popup.js — we inline category names here)
    const PRESET_KW_GROUPS = {
      '🎰 Gambling': ['casino','poker','jackpot','wager','lottery','blackjack','roulette','sportsbook','bookie','parlay','handicap','tipster','payout','gambling','betting site','online casino','live casino','spin wheel','scratch card','sweepstakes','cryptobet','sportsbet','craps','draftkings','fanduel','pokerstars','roulette wheel','all-in bet','prop bet','overunder','bookmaker','handicapper','closing line','moneyline','pointspread','futures bet','live betting','inplay bet','sharp bet','fade the public','steam move','arbitrage betting','matched betting','teaser bet','parlay boost','risk free bet','promo abuse','baccarat','pachinko','raffle ticket','instant win','no deposit bonus','welcome bonus','reload bonus','cashback offer','high roller casino','rollbit','roobet','duelbits','gamdom','bcgame','bitsler','trustdice','bitkong','duckdice','primedice','freebitco.in','rakeback','crash game gambling','plinko gambling','mines game gambling','aviator game gambling','csgoempire','csgoluck','daddyskins','bloodycase','hellcase','datdrop','key-drop','csgopolygon','skin betting','csgo case opening','crate unboxing gambling','0.6% pity','affiliate rakeback','aviator','aviator game','bcgame aviator','bitcoin dice','blue archive gem scam','case battle','case opening site','crash game','crash multiplier','crash predictor script','crash x100','crypto faucet gambling','cs2 case opening','csgo skin roulette','dota2 item bet','duelbits mines','fate grand order quartz scam','gacha scam','gacha whale flex','gamdom crash','genshin wish simulator scam','guaranteed pity scam','key drop','key drop gambling','lightning network bet','lootbox gambling','mines game','multiplier game','no kyc casino','pity guarantee scam','pity hit','pity rate','pity system','plinko','provably fair','provably rigged','rigged crash','rollbit crash','roobet plinko','rust gambling','rust skin roulette','skin battle','skin casino','stake crash','tf2 unusual gambling','valorant skin trade scam'],
      '🔞 Adult': ['pornography','xxx site','nude site','onlyfans','hentai','adult escort','nsfw content','explicit content','erotic content','sex chat','adult hookup','milf porn','camgirl','webcam girl','adult video','strip club','pornstar','adult content','sexy pics','leaked nudes','adult site','rule34','sexting','sugar daddy','sugar baby','anal sex','boobs','gayporn','blowjob','handjob','threesome porn','deepthroat','gangbang','bukkake','fisting','watersports kink','incest porn','bestiality','lolita','shotacon','cuckold','hotwife','sissy porn','voyeur porn','exhibitionist','swinger site','sex tape','revenge porn','mommy kink','teacher student sex','bigass porn','pegging','taboo porn','step sis porn','step mom porn','daddy dom','mommy dom','shemale','only fans leak','porn leak','nude leak','amateur porn','cosplay porn','ahegao','pornhub','xvideos','xhamster','spankbang','chaturbate','myfreecams','bongacams','stripchat','jerkmate','camsoda','thothub','fapello','coomer party','e621','gelbooru','paheal','hentai booru','hentai haven','nhentai','pururin','exhentai','porn addiction','coomer','gooning session','porn edging','pornhub premium','goon cave','denial kink','chastity cage','ruined orgasm','ballbusting','cuckquean','femdom','findom','goddess worship','human atm','wallet drain','blackmail fantasy','giantess fetish','vore fetish','inflation fetish','futa','yiff','furry porn','knotting','oviposition','tentacle porn','monster girl porn','age gap','anal','asmr erotic','asmr hentai','asmr nsfw','asmr porn','asmr sex','ass','bdsm','big boy videos','brain rot','cock','creampie','cum','daddy kink','dick','dilf','double penetration','dp','edgemaster','edging','erotic','fetish','for when the kids are asleep','foursome','fuck','goon','goon hour','goon sesh','gooncave','goonfuel','gooning','grown up videos','incest','incognito mode porn','late night scroll','lesbian','milf','nsfw','nude','orgasm','orgy','pedophile','porn','porn dopamine','porn rot','porno','pornstars','private tab porn','pussy','scat','scrolling porn','secret tab porn','sex','sexchat','sissy','squirt','swinger','teacher student','the good stuff','the spicy stuff','threesome','tits','tranny','transvestite','triple penetration','voyeur','watersports','xxx'],
      '🔫 Violence': ['murder','assassination','mass shooting','school shooting','gunshot wound','blood bath','violent crime','brutality video','extremist attack','jihad attack','hit list','death threat','snuff film','behead','decapitate','slaughter','genocide','dismember','lynching','manslaughter','arson attack','homicide','infanticide','eviscerate','bludgeon','disembowel','impale','crucify','vivisect','necrophilia','cannibal','gore porn','execution video','beheading video','liveleak','bestgore','watch people die','cartel execution video','torture compilation','gore thread','shock site','faces of death','dnepropetrovsk maniacs','3 guys 1 hammer','no mercy in mexico','funky town video',"daisy's destruction",'hurtcore site','stream execution','neck snap video','curb stomp video','knockout game violence','one punch murder','waterboarding torture','guillotine execution','gas chamber','firing squad execution','blood eagle','murder tourism','gorehound','shockumentary','two to the dome','chest entry exit wound','dnepropetrovsk','execution compilation','gore discord invite','gore site link','gore telegram','happy slapping compilation','head stomp compilation','hurtcore discord','inside mexico gore','isis beheading','jump kick murder','knockout game 2026','lynching video','mexican cartel gore','one punch death','pay to watch torture','public execution stream','red room request','russian pow torture','shock content telegram','sicario execution','taliban stoning video','ukrainian drone gore'],
      '💊 Drugs': ['cocaine','heroin','methamphetamine','narcotics','drug dealer','overdose','fentanyl','xanax abuse','molly drug','ecstasy drug','mdma','lsd drug','magic shrooms','drug edibles','dab pen drug','buy drugs online','opioid drugs','crack cocaine','ketamine drug','adderall abuse','lean drug','codeine syrup','crystal meth','drug plug','drug trip report','percocet abuse','vicodin abuse','china white heroin','black tar heroin','speedball drug','tina meth','yayo cocaine','snow cocaine','chronic weed','kush weed','dank weed','weed cart','dab weed','bong rip','blunt weed','stoned high','tranq drug','xylazine drug','percs opioid','oxycontin abuse','hydrocodone abuse','norco abuse','addy drug','ritalin abuse','vyvanse abuse','xanax bars abuse','purple drank','promethazine codeine','psilocybin drug','special k drug','salvia drug','dmt drug','nitrous oxide abuse','whippets drug','poppers drug','lean sip','wockhardt lean','actavis lean','sizzurp drink','double cup lean','k-hole','dmt breakthrough','ayahuasca trip','salvia divinorum','research chemicals','4-aco-dmt','2c-b drug','mxe drug','mescaline drug','peyote drug','ibogaine','rc benzos','etizolam','flualprazolam','nbome drug','krokodil drug','desomorphine','synthetic weed drug','bath salts drug','flakka drug','zombie drug xylazine','fentanyl pressed pills','dirty 30s pills','pressed xans','2c-e','4-ho-met','actavis','bars benzo','blues 30','bromazolam','clam benzo','death 25i','deso krok','diclazepam','dirty 30s','double cup','etizest','etizolam drug','etizolam press','fent','fent cut','fent laced','fent strip','fent test','fent test positive','fent test strip','fentanyl test strip fail','flakka','flakka bath salt','flubromazolam','hulks','hulks bars','k2','k2 drug','k2 jail high','krok legs','krokodil','krokodil legs','laced xan','m30 fake','m30s','n-bomb trip','nbome','nbome blotter','pressed fent','pressed percs','rc benzo','rc drug','research chem','research chemical','spice','spice drug','spice synthetic','tranq city','tranq dope','tranq wound','wockhardt','xan bars','xylazine','xylazine wound','zombie drug','zombie tranq'],
      '🕹️ Gaming (distraction)': ['cheat code download','game hack','free robux hack','aimbot download','free v-bucks hack','game hack tool','wallhack','esp hack','god mode cheat','skin generator hack','game cheat engine','exploit script','game boosting service','lootbox gambling','gacha addiction','skin gambling','microtransaction trap','pay to win','whale spending','dolphin spending','gacha pity system','pull rates gacha','paywall content game','stamina refill','daily login trap','battle pass grind','csgo case opening','csgo roulette','dota skin betting','rocket league gambling','apex pack gambling','fortnite gambling','valorant gambling','genshin impact wish','fgo saint quartz','gacha rolls','cs2 case opening','rust gambling','tf2 unusual trading','roblox condo games','roblox porn games','minecraft anarchy server','2b2t griefing','hypixel boosting','minecraft duping','valorant boosting service','lol smurf account','genshin reroll account','blue archive gem farming','arknights headhunting','princess connect pulls','azur lane oil farming','nikke recruitment pulls','wuthering waves echoes grinding','genshin spending','gacha whale','event farming trap','skin betting site','2b2t dupe glitch','ark genesis duping','case opening','condo game','condo game link','crate unboxing','cs2 skin bet','dayz base raid scam','energy refill scam','f2p bait','gacha pity','hypixel coin scam','last epoch trade scam','lootbox opening','minecraft donator rank scam','nikke goddess mold scam','palworld breeding scam','path of exile rmt','paywall trap','pity system','poe currency bot','poe mirror service scam','real money trading tarkov','roblox avatar trade scam','roblox condo','roblox condo server','roblox oof game','roblox oofie','ruble eft','rust skin bet','scum admin abuse','stamina grind trap','tarkov rmt','wuthering waves reroll service','zenless zone zero poll scam'],
      '😔 Self-harm': ['suicide method','self-harm','cutting myself','suicidal ideation','end my life','kill myself','want to die','not worth living','no reason to live','overdose on pills','hang myself','slit wrists','self-injury','harm myself','pro-ana tips','thinspo','purging tips','starve myself','eating disorder tips','selfharm','razor blades sh','killing myself','unalive myself','sewerslide','sh relapse','kms tonight','self delete','rope maxxing','fridge maxxing','svv','bleedout','carve names skin','barcode scars','zebra stripes scars','fresh cuts sh','sh picture thread','sh relapse flex','sh recovery sabotage','edtwt','meanspo','fatspo','proana tips','promia tips','thinspiration','thigh gap goals','bonespo','armpo','hip bones thinspo','collarbone thinspo','bone smashing','restrict eating disorder','painless suicide method','exit bag suicide','helium method suicide','nitrogen hypoxia method','charcoal burning method','train method suicide','wrist check sh','butterfly cuts sh','vein map sh','sh bleed kit','goodbye thread suicide','suicide note template','ctb method','sn method','hanging method suicide','partial suspension method','inert gas suicide','exit hood bag','co poisoning method','cliff jumping method','bridge jump method','method hopping suicide','tourist suicide method','ana buddy discord','barcode cut roadmap','beans deep','beans level','bone smashing routine','charcoal burning','charcoal burning suicide','cut cat scratch method','ed recovery sabotage','exit bag','fresh cuts','goal weight ana','hate thread proana','helium method','mewing fail pics','mia binge purge cycle','nitrogen hypoxia','proana goal weight','proana thread','relapse thread','relapse thread sh','roast me fatspo','scars sh clean streak','sewerslide method','sh flex thread','sh inspo','sh meanspo','sh picture','sh picture dump','sh relapse counter','styro 0','styro 1','styro cuts','styro depth chart','thinspo thread','trigger pics sh','trigger warning sh','unalive method','zebra cut pattern'],
      '🤬 Cyberbullying': ['kill yourself','kys threat','go die','neck yourself','nobody likes you','you are worthless','ugly loser','fat pig insult','doxxing','swatting','expose you online','sextortion','hate raid','cyberbully','harassment campaign','death threat','revenge porn threat','leaked nudes threat','faggot slur','retard slur','cancel campaign','flame war','blackpilled','doomer fuel','incel tears','femoid','subhuman incel','ethnicel','currycel','ricecel','heightmog','suifuel','ropefuel','looksmaxxing failure','escortmaxxing','an hero','become an hero','rope time kys','fridge yourself','pipe yourself','rope yourself','neck yourself rope','schizo rant','fedposting','ngmi forever',"it's so over",'seethe and dilate','clocked troon','manface monday','baldcel','wristcel','framecel','cope harder seethe','ngmi doomer','redpill blackpill'],
      '🚨 Predatory Behavior': ['send nudes minor','age play sexual','secret chat minor','dont tell anyone secret','meet up alone minor','private chat minor','are you alone minor','grooming child','minor dating older','private video call minor','what are you wearing minor','underage dating','catfish minor','snapchat premium minor','send nudes now','sendnudes','pic4pic','nude trade','trading nudes','show me yours','send dick pic','snap me nudes','kik nudes','are u wet','touch yourself cam','np4np','sfw to nsfw trade',"daddy's little princess",'obey daddy','good girl reward','punishment time','our little secret','dont tell mom','secret game minor','alone time minor','discord kitten minor','kik trade nudes','snap premium nudes','age regression sexual','littlespace sexual','cg/l sexual','ab/dl sexual','sugaring minor','findom minor','cp thread','cheese pizza thread','loli rp','shota rp','incest rp','forced breeding rp','free use minor','petplay minor','map pride','minor attracted person','virt pedo','hurtcore forum','dark web onion trade','deep web trade','hidden wiki onion','pedobook','boychat','girllover forum','cub sharing','loli collector','shota archive','age play server','ddlg server','little boy little girl trade','gaslight groom','love bomb minor','trauma bond minor']
    };

    function getKeywordGroup(kw) {
      for (const [group, kws] of Object.entries(PRESET_KW_GROUPS)) {
        if (kws.includes(kw)) return group;
      }
      // Custom keyword — check assigned category
      return customKwCategories[kw] || '✏️ Custom';
    }

    function isBlurEnabled(kw) {
      const group = getKeywordGroup(kw);
      return blurCategories.has(group);
    }

    // ── Build regex patterns once ──
    const patterns = enabledKeywords.map(kw => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return { kw, regex: new RegExp(`\\b${escaped}\\b`, 'i') };
    });

    function scanText(text) {
        return patterns.filter(p => p.regex.test(text)).map(p => p.kw);
    }

    function getMetaContent() {
        const parts = [];
        document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[property="og:title"], meta[name="keywords"]').forEach(m => {
            if (m.content) parts.push(m.content);
        });
        document.querySelectorAll('[aria-label]').forEach(el => {
            parts.push(el.getAttribute('aria-label'));
        });
        return parts.join(' ').toLowerCase();
    }

    // ── Blur keyword occurrences in text nodes ──
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'HEAD', 'META', 'LINK']);
    const processedNodes = new WeakSet();

    let combinedRegex = null;

    function buildCombinedRegex(keywords) {
        const blurableKeywords = keywords.filter(isBlurEnabled);
        if (blurableKeywords.length === 0) return null;
        const combined = blurableKeywords
            .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
        return new RegExp(`(\\b(?:${combined})\\b)`, 'gi');
    }

    function blurKeywordsInNode(root, keywords) {
        if (!keywords || keywords.length === 0) return;
        if (!combinedRegex) combinedRegex = buildCombinedRegex(keywords);
        if (!combinedRegex) return; // no blur-enabled keywords

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
                if (parent.dataset && parent.dataset.csmBlurred) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodesToReplace = [];
        let node;
        while ((node = walker.nextNode())) {
            if (processedNodes.has(node)) continue;
            if (!combinedRegex.test(node.textContent)) { combinedRegex.lastIndex = 0; continue; }
            combinedRegex.lastIndex = 0;
            nodesToReplace.push(node);
        }

        for (const node of nodesToReplace) {
            const text = node.textContent;
            const parts = text.split(combinedRegex);
            combinedRegex.lastIndex = 0;
            if (parts.length <= 1) continue;

            const frag = document.createDocumentFragment();
            for (const part of parts) {
                combinedRegex.lastIndex = 0;
                if (combinedRegex.test(part)) {
                    const span = document.createElement('span');
                    span.dataset.csmBlurred = 'true';
                    span.style.cssText = 'filter:blur(6px);display:inline;pointer-events:none;user-select:none;';
                    span.textContent = part;
                    frag.appendChild(span);
                } else {
                    frag.appendChild(document.createTextNode(part));
                }
                combinedRegex.lastIndex = 0;
            }

            try {
                node.parentNode.replaceChild(frag, node);
                processedNodes.add(node);
            } catch (e) { /* node already removed */ }
        }
    }

    // ── Main scan ──
    let lastAlertedKey = '';
    let detectedKeywords = [];

    function performScan() {
        const title = document.title.toLowerCase();
        const url = location.href.toLowerCase();
        const body = (document.body ? document.body.innerText : '').slice(0, 20000).toLowerCase();
        const meta = getMetaContent();
        const corpus = `${title} ${url} ${body} ${meta}`;

        const matched = scanText(corpus);
        if (matched.length === 0) return;

        if (document.body) {
            blurKeywordsInNode(document.body, matched);
        }

        const key = matched.sort().join('|');
        if (key === lastAlertedKey) return;
        lastAlertedKey = key;
        detectedKeywords = matched;
        combinedRegex = buildCombinedRegex(matched);

        try {
            chrome.runtime.sendMessage({
                type: 'KEYWORD_ALERT',
                url: location.href,
                site,
                keywords: matched,
                timestamp: Date.now()
            });
        } catch (e) { /* context invalidated */ }
    }

    // ── Listen for blur category updates from popup ──
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'UPDATE_BLUR_CATS') {
            blurCategories = new Set(message.blurCategories || []);
            combinedRegex = null; // force rebuild
            // Re-apply blur immediately on existing DOM with updated categories
            if (detectedKeywords.length > 0 && document.body) {
                combinedRegex = buildCombinedRegex(detectedKeywords);
                if (combinedRegex) blurKeywordsInNode(document.body, detectedKeywords);
            }
        }
    });

    // ── Initial scan ──
    performScan();

    // ── MutationObserver for SPA/dynamic content ──
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
        if (detectedKeywords.length > 0) {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        blurKeywordsInNode(node, detectedKeywords);
                    }
                }
            }
        }

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performScan, 1500);
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
    });

    setTimeout(() => observer.disconnect(), 5 * 60 * 1000);
})();

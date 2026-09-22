/* =====================================================================
   PACIFIC SPORTS — 공용 데이터 레이어 (pacific-data.js)
   ---------------------------------------------------------------------
   모든 화면이 여기서만 데이터를 읽습니다. 화면 코드는 데이터를 직접 안 들고 있어요.
   그래서 실제 IMS(Supabase)로 전환할 때 화면은 하나도 안 건드리고 이 파일만 고치면 됩니다.

   ===== 실제 IMS로 켜는 법 (재고를 진짜로 다 옮긴 뒤) =====
     1) 아래 SOURCE 를 'supabase' 로 변경
     2) SUPABASE_URL / SUPABASE_ANON_KEY 두 줄 채우기
        (Supabase → Settings → API 에서: Project URL, anon public key)
   그게 전부예요. 색상·사이즈는 skus 에서, 재고는 inventory 에서 자동으로 읽어옵니다.
   ===================================================================== */

window.PacificData = (function () {

  /* ===== ① 데이터 소스 ================================================
     pacific-config.js 가 있고 URL/키가 채워져 있으면 자동으로 'supabase',
     없으면 'mock'. (config 파일만 빼면 즉시 예시 모드로 안전하게 동작)
  ====================================================================== */
  const CFG = (window.PACIFIC_CONFIG || {});
  const SUPABASE_URL      = CFG.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || '';
  const IMAGE_BUCKET      = CFG.IMAGE_BUCKET || 'product-images';
  const SOURCE = (SUPABASE_URL && SUPABASE_ANON_KEY) ? 'supabase' : 'mock';


  /* ===== ② 케이스 규칙 + 사이즈 표시 순서 ===============================
     IMS와 동일. XS–2XL = 72/case, 3XL–5XL = 48/case. 낱장(PC) 허용, MOQ 없음.
     실제로 보여줄 사이즈는 각 스타일이 skus 에 가진 것만 (아래 순서대로 정렬).
  ====================================================================== */
  // 토들러/키즈(2T~5T)가 가장 앞, 그다음 일반 사이즈
  const SIZE_ORDER = ['2T','3T','4T','5T','XS','S','M','L','XL','2XL','3XL','4XL','5XL'];
  // 케이스 환산: 일반 XS–2XL=72, 3XL+ =48. 토들러/유스 사이즈는 작은 케이스(48)로 둠.
  const CASE_PER = { '2T':48,'3T':48,'4T':48,'5T':48,
                     XS:72, S:72, M:72, L:72, XL:72, '2XL':72, '3XL':48, '4XL':48, '5XL':48 };

  // 창고 표시: SC = SC + SC-PCR, CA = CA + CA-PCR (PCR=낱장룸 합산)
  const WAREHOUSES = ['SC', 'CA'];
  const WH_MERGE = { 'SC':'SC', 'SC-PCR':'SC', 'CA':'CA', 'CA-PCR':'CA' };


  /* ===== ③ 색상명 표기 변환 ============================================
     IMS는 대문자(ABYSS, BABY BLUE). 화면엔 예쁘게(Abyss, Baby Blue) 보이게.
     hex(미리보기 색)는 알려진 것만 매핑, 없으면 회색.
  ====================================================================== */
  function prettyColor(name) {
    return String(name).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── 색상 표시 규칙 (IMS는 그대로, 화면 표시만 조정) ──
  // hide: 화면에서 숨길 IMS 색상 (대문자 raw)
  // rename: IMS 색상(raw) → 화면에 보일 이름
  const COLOR_RULES = {
    '1210': {
      hide: ['CHARCOAL (DS)'],
      rename: { 'CHARCOAL (HT)': 'Charcoal' }
    },
    /* PFD 스타일: 색 이름에 실번수를 **붙이지 않는다** (2026-09-14).
       [stated] 하윤: "16/1 pfd는 pfd안에 들어가야하는거 아닌가?? 따로 16/1 Pfd로 나오는게 아니라"
       실번수는 스타일 이름에 이미 들어 있다(#1690 Adult 16/1 …). 색까지 나누면 Shop by
       Color 에서 'Pfd' 와 '16/1 PFD' 가 딴 칩으로 갈라져 같은 색이 두 군데로 보인다.
       ⚠ **숨기는 규칙은 그대로 둔다.** 세컨(S)·중복(L) 로트는 손님에게 보이면 안 된다 —
         이름을 합치는 것과는 다른 이야기다.
       참고: `skus` 는 이 스타일들 색이 모두 `PFD` 이고, `inventory_web` 뷰도 이름을
         정규화해 `PFD` 로 내려준다 — 그래서 (F)/(J) 로 이름을 바꾸던 규칙은 이미
         아무것도 걸리지 않는 죽은 규칙이었다 (실측 확인). */
    '1390': { hide: ['PFD (L)', 'PFD (S)'], rename: {} }
  };
  function colorRules(style){ return COLOR_RULES[style] || { hide:[], rename:{} }; }
  function isHiddenColor(style, raw){
    const up=String(raw||'').toUpperCase();
    return colorRules(style).hide.map(x=>x.toUpperCase()).includes(up);
  }
  function displayColorName(style, raw){
    const up=String(raw||'').toUpperCase();
    const rn=colorRules(style).rename;
    for(const k in rn){ if(k.toUpperCase()===up) return rn[k]; }
    return prettyColor(raw);
  }
  const COLOR_HEX = {
    'ABYSS':'#2c3e4f','ARTICHOKE':'#7d8064','BABY BLUE':'#a9c9e0','BERMUDA':'#5bbcb6',
    'BLACK':'#232323','BLACK PEARL':'#33353a','BROWN':'#6b4a36','BUTTER':'#f3e3a0',
    'CANARY':'#f5d935','CANTALOUPE':'#f0a875','CARDINAL':'#8e2535','CHAMBRAY':'#6d8aa8',
    'CHARCOAL HTR':'#4a4a4d','CHARCOAL (HT)':'#4a4a4d','CHARCOAL (DS)':'#3f3f42','CHARCOAL':'#4a4a4d','CINNAMON':'#b05c33','CLOVER':'#3f7d4f','FROST BLUE':'#bcd6dc',
    'FUTURE DUSK':'#6b7a99','GREY HTR':'#a8a8a4','GREY HEATHER':'#a8a8a4',
    'HONEYCOMB':'#e8b84a','ICEBERG':'#aac6cc','KEY LIME':'#cfe08a',
    'LIGHT BLUE HTR':'#9fb8cc','MAKO':'#3a4a52','MIDNIGHT BLUE':'#27314a','MONACO BLUE':'#2f5b8f',
    'NATURAL':'#ede6d6','NAVY':'#27314f','NAVY HTR':'#3a4660','OLIVE':'#6b6a3f',
    'PAPAYA':'#f0905a','PEACH ROSE':'#e8b0a0','PEWTER':'#8c8c86','PINK ICE':'#edc6cf',
    'PISTACHIO':'#bcd09a','PURPLE':'#5a3f7a','RED HTR':'#b04a4a','RIVER GREEN':'#4f8a7a',
    'ROOT BEER':'#4a2f26','ROYAL HTR':'#3a5a9c','RUST':'#a85636','SAND':'#d8c4a0',
    'SAPPHIRE':'#2f4f8f','SEASIDE':'#7ab0bc','SHADOW GREY':'#6e6e6e','SLATE':'#5a6470',
    'SMOKE':'#8a9aa0','TABASCO':'#9c2f2f','TAN':'#c9a87c','TURQUOISE':'#3aa8b0',
    'WHEAT':'#e0cd9a','WHITE':'#f7f7f4','WINE':'#5a2733'
  };
  function colorHex(rawName) {
    return COLOR_HEX[String(rawName).toUpperCase()] || '#c9c7bf';
  }
  const IMG = 'https://epacificsports.com/wp-content/uploads/2022/03/';


  /* ===== ③-b 전체 스타일 목록 ==========================================
     제품 목록/카테고리 화면이 쓰는 카탈로그. mock엔 IMS의 진짜 67개를 넣어둠.
     supabase에선 styles 테이블에서 그대로 읽어옴.
  ====================================================================== */
  const STYLE_LIST = [
    {no:'1180',desc:'Adult 18/1 100% Combed Ring Spun Cotton Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1210',desc:'Adult 22/1 100% Cotton Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1212',desc:'Adult 22/1 100% Cotton Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1214',desc:'Adult 22/1 100% Cotton Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1230',desc:'Adult Tri Color Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1232',desc:'Adult Tri Color Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1234',desc:'Adult Tri Color Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1240',desc:'Adult 24/1 Slub Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1248',desc:'Adult 24/1 Slub Hoodie Long Sleeve Tee',cat:'Adult Hoodie L/S',sr:'XS-5XL'},
    {no:'1260',desc:'Adult 22/1 Color Htr Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1262',desc:'Adult 22/1 Color Htr Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1264',desc:'Adult 22/1 Color Htr Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1280',desc:'Adult 22/1 100% Combed Ring Spun Cotton Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1290',desc:'Adult 20/1 100% Cotton PFD Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1292',desc:'Adult 20/1 100% Cotton PFD Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1311',desc:'Adult 30/1 100% Cotton V-Neck Short Sleeve Tee',cat:'Adult S/S',sr:'S-3XL'},
    {no:'1314',desc:'Adult 30/1 100% Cotton Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1315',desc:'Adult 30/1 100% Cotton Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1315R',desc:'Adult 30/1 100% Cotton Short Sleeve Ringer Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1322',desc:'Adult 30/1 100% Cotton Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1330',desc:'Adult Omni Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1332',desc:'Adult Omni Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1348',desc:'Adult 30/1 CVC Hoodie Long Sleeve Tee',cat:'Adult Hoodie L/S',sr:'XS-5XL'},
    {no:'1350',desc:'Adult Snow Htr Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1351',desc:'Adult Snow Htr V-Neck Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1352',desc:'Adult Snow Htr Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1354',desc:'Adult Snow Htr Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1360',desc:'Adult 30/1 Color Htr Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1362',desc:'Adult 30/1 CVC Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1364',desc:'Adult 30/1 CVC Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1368',desc:'Adult 30/1 CVC Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1388',desc:'Adult 30/1 CVC Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1390',desc:'Adult 30/1 100% Cotton PFD Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1392',desc:'Adult 30/1 100% Cotton PFD Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1394',desc:'Adult 30/1 100% Cotton PFD Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1530',desc:'Adult Triblend Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1532',desc:'Adult Triblend Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1534',desc:'Adult Triblend Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1543',desc:'Adult Raglan Tee',cat:'Adult Raglan',sr:'XS-5XL'},
    {no:'1580',desc:'Adult Poly Linen Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1595',desc:'Adult Poly Rayon Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1600',desc:'Adult 16/1 100% Cotton Heavyweight Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL',brand:'Pacific Sports Inc'},
    {no:'1615',desc:'Adult 16/1 100% Cotton Heavyweight Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1650',desc:'Adult Siro Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1652',desc:'Adult Siro Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1690',desc:'Adult 16/1 100% Cotton Heavyweight PFD Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'2210',desc:'Youth 22/1 100% Cotton Short Sleeve Tee',cat:'Youth S/S',sr:'XS-XL'},
    {no:'2212',desc:'Youth 22/1 100% Cotton Long Sleeve Tee',cat:'Youth L/S',sr:'XS-XL'},
    {no:'2310',desc:'Youth 30/1 100% Cotton Short Sleeve Tee',cat:'Youth S/S',sr:'XS-XL'},
    {no:'2382',desc:'Kids 30/1 CVC Long Sleeve Tee',cat:'Kids L/S',sr:'2T-XL'},
    {no:'2316',desc:'Kids 30/1 100% Cotton Short Sleeve Tee',cat:'Kids S/S',sr:'2T-XL'},
    {no:'2350',desc:'Youth Snow Htr Short Sleeve Tee',cat:'Youth S/S',sr:'XS-XL'},
    {no:'2388',desc:'Kids 30/1 CVC Short Sleeve Tee',cat:'Kids S/S',sr:'2T-XL'},
    {no:'3210',desc:'Juvy 22/1 100% Cotton Short Sleeve Tee',cat:'Juvy S/S',sr:'S-L'},
    {no:'3212',desc:'Juvy 22/1 100% Cotton Long Sleeve Tee',cat:'Juvy L/S',sr:'S-L'},
    {no:'3310',desc:'Juvy 30/1 100% Cotton Short Sleeve Tee',cat:'Juvy S/S',sr:'S-L'},
    {no:'3350',desc:'Juvy Snow Htr Short Sleeve Tee',cat:'Juvy S/S',sr:'S-L'},
    {no:'5210',desc:'Toddler 22/1 100% Cotton Short Sleeve Tee',cat:'Toddler S/S',sr:'2T-4T'},
    {no:'5212',desc:'Toddler 22/1 100% Cotton Long Sleeve Tee',cat:'Toddler L/S',sr:'2T-4T'},
    {no:'5310',desc:'Toddler 30/1 100% Cotton Short Sleeve Tee',cat:'Toddler S/S',sr:'2T-4T'},
    {no:'5350',desc:'Toddler Snow Htr Short Sleeve Tee',cat:'Toddler S/S',sr:'2T-4T'},
    {no:'6535',desc:'Adult Galaxy Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'8110',desc:'Adult Polyester Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8150',desc:'Adult Cationic Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8155',desc:'Adult Spacedye Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8180',desc:'Adult Mesh Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8255',desc:'Youth Spacedye Performance Short Sleeve Tee',cat:'Youth S/S',sr:'XS-XL'},
    {no:'8368',desc:'Adult 30/1 CVC Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'9307',desc:'Adult Infinite Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'}
  ];


  /* ===== ④ MOCK (예시) — 실제 1368 구조에 맞춤 ==========================
     색상·사이즈는 IMS 구조 그대로, 재고만 예시 숫자.
  ====================================================================== */
  const MOCK_COLORS = [
    'ABYSS','ARTICHOKE','BABY BLUE','BERMUDA','BLACK','BROWN','BUTTER','CANARY',
    'CARDINAL','CLOVER','FROST BLUE','MAKO','MONACO BLUE','NATURAL','NAVY','OLIVE',
    'PAPAYA','PEWTER','SAND','SEASIDE','SLATE','TAN','TURQUOISE','WHITE','WINE'
  ];
  const MOCK_SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'];

  function _seedRand(seed){let x=0;for(const c of seed)x=(x*31+c.charCodeAt(0))%9973;
    return m=>{x=(x*1103515245+12345)%2147483648;return Math.floor((x/2147483648)*m);};}

  function _mockProduct(styleNo) {
    const sNo = styleNo || '1368';
    const meta = STYLE_LIST.find(s => s.no === sNo);
    const name = meta ? (sNo + ' ' + meta.desc) : (sNo + ' Short Sleeve Crew');
    // mock 사이즈: 스타일의 size_range 에 맞춰 자르기 (예: Youth=XS-XL, Toddler=2T-4T)
    let sz = MOCK_SIZES.slice();
    if (meta && meta.sr) {
      const [lo, hi] = meta.sr.split('-');
      const order = SIZE_ORDER;
      const a = order.indexOf(lo), b = order.indexOf(hi);
      if (a !== -1 && b !== -1) sz = order.slice(a, b + 1);
    }
    return {
      styleNo: sNo, name, category: meta ? meta.cat : 'Adult / Short Sleeve',
      sizes: sz,
      colors: MOCK_COLORS.map(c => ({ name:prettyColor(c), raw:c, hex:colorHex(c), img:'', sizes: sz.slice() })),
      casePer: CASE_PER
    };
  }
  function _mockInventory(styleNo, product) {
    const sz = (product && product.sizes) || MOCK_SIZES;
    const tiers=[0,0,0,72,144,216,288,500,1000,1500];
    const out={};
    MOCK_COLORS.forEach(c=>{
      const pretty=prettyColor(c);
      const g=(rnd)=>sz.map(()=>tiers[rnd(tiers.length)]);
      out[pretty]={ SC:g(_seedRand(c+sNoSeed(styleNo)+'SC')), CA:g(_seedRand(c+sNoSeed(styleNo)+'CA')) };
    });
    return out;
  }
  function sNoSeed(s){ return s||''; }


  /* ===== ⑤ SUPABASE — 실제 IMS 읽기 ===================================
     skus  → 색상·사이즈 (카탈로그)
     inventory → 재고 (warehouse_id 를 SC/CA 로 합산, 중복행 합산)
  ====================================================================== */
  async function _sb(path) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
      throw new Error('Supabase 미설정: pacific-data.js 상단 SUPABASE_URL / SUPABASE_ANON_KEY 를 채워주세요.');
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers:{ apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY }
    });
    if (!res.ok) throw new Error('IMS 조회 실패: ' + res.status + ' ' + path);
    return res.json();
  }

  /* ═══ RPC(함수) 읽기 — POST 라서 캐시에 걸리지 않는다 (2026-09-22) ═══ */
  async function _sbRpc(fn, body, sel) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY)
      throw new Error('Supabase 미설정: pacific-data.js 상단 SUPABASE_URL / SUPABASE_ANON_KEY 를 채워주세요.');
    const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn + (sel ? ('?select=' + sel) : ''), {
      method: 'POST',
      headers: { apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+SUPABASE_ANON_KEY,
                 'Content-Type':'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!res.ok) throw new Error('IMS 조회 실패: ' + res.status + ' rpc/' + fn);
    return res.json();
  }

  // 창고 id → SC/CA 코드 매핑 (한 번 읽어서 캐시)
  let _whCache = null;
  async function _warehouseMap() {
    if (_whCache) return _whCache;
    const rows = await _sb('warehouses?select=id,code');
    const map = {};
    rows.forEach(r => { const m = WH_MERGE[r.code]; if (m) map[r.id] = m; });
    _whCache = map;
    return map;
  }

  function _sizeSort(a,b){ return SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b); }

  // Storage 공개 URL 만들기 (image_path → 실제 보이는 주소)
  function _imageUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;  // 이미 전체 URL이면 그대로
    return SUPABASE_URL + '/storage/v1/object/public/' + IMAGE_BUCKET + '/' + path;
  }

  /* ═══ 카드 표지(모델) 사진 — 예약 색 이름 `__COVER__` (2026-09-15) ═══
     제품 목록 **카드에만** 쓰는 사진이다. 색이 아니라서 `skus` 에 없고, 색 목록을 만드는
     곳은 전부 skus 를 보므로 상품 페이지·Shop by Color·색상 수에는 **절대 안 나온다**.
     ⚠⚠ 모델 사진을 색 사진 **위에 덮어쓰지 말 것.** 1214 에서 그렇게 했더니 칼라칩에
       얼굴이 들어가고([stated] "칼라칩은 칼라로 꽉 차야하는데") 주문표 자동 크기조절이
       사람을 재고, 그 색 평면 사진이 영구히 사라졌다. 반드시 이 예약 줄로 넣는다. */
  const COVER_COLOR = '__COVER__';
  function isCoverColor(c){ return String(c || '').trim().toUpperCase() === COVER_COLOR; }

  // product_images 에서 한 스타일의 색상별 사진 읽기 → { 색상(예쁜표기): URL }
  async function _supabaseImages(styleNo) {
    /* ⚠ 한 색에 줄이 여러 개일 수 있다 — 대소문자만 다른 옛 줄(Charcoal / CHARCOAL)이 대표적이다.
       예전에는 sort_order 만 보고 정렬해서, 같은 순위 안에서는 **가장 먼저 들어간 줄**,
       즉 제일 오래된 사진이 이겼다. 그래서 새로 올린 사진이 화면에 영영 안 나왔다
       (2026-09-03, 1314 CHARCOAL). 이제 같은 sort_order 안에서는 최신이 이긴다. */
    const rows = await _sb('product_images?style_number=eq.'+encodeURIComponent(styleNo)
                          +'&select=color,image_path,sort_order,created_at&order=sort_order.asc,created_at.desc');
    const out = {};
    rows.forEach(r => {
      /* 표지(모델) 사진은 색이 아니다 — **색 이름 자리에는 안 넣고** 예약 키에 담는다
         (2026-09-15). 색 이름으로 넣으면 `prettyColor('__COVER__')` 가 색처럼 생긴 칸을
         만든다. 예약 키 `__cover` 는 색 이름이 될 수 없어 안전하다 (`_default` 와 같은 방식).
         ⚠ 이렇게 담아두면 상품 페이지가 표지를 **조회 없이** 쓸 수 있다. */
      if (isCoverColor(r.color)) { if (!out.__cover) out.__cover = _imageUrl(r.image_path); return; }
      const key = r.color ? prettyColor(r.color) : '_default';
      if (!out[key]) out[key] = _imageUrl(r.image_path);   // 색상별 첫 사진
    });
    return out;
  }

  async function _supabaseProduct(styleNo) {
    // skus 에서 이 스타일의 색상·사이즈 (활성만)
    const rows = await _sb('skus?style_number=eq.'+encodeURIComponent(styleNo)
                          +'&is_active=eq.true&select=color,color_code,size');
    // styles 에서 설명/카테고리 (있으면)
    let meta = [];
    try { meta = await _sb('styles?style_number=eq.'+encodeURIComponent(styleNo)
                          +'&select=description,category'); } catch(e){}

    const colorMap = {};   // raw색상 → {sizes:Set}
    const sizeSet = new Set();
    rows.forEach(r=>{
      if (!r.color) return;
      const raw = r.color.toUpperCase();
      if (!colorMap[raw]) colorMap[raw] = new Set();
      if (r.size) { colorMap[raw].add(r.size); sizeSet.add(r.size); }
    });

    const sizes = [...sizeSet].sort(_sizeSort);

    // 사진 붙이기 (있으면 색상별 img 채움)
    let imgMap = {};
    try { imgMap = await _supabaseImages(styleNo); } catch(e){}

    const colors = Object.keys(colorMap).sort()
      .filter(raw => !isHiddenColor(styleNo, raw))            // 숨길 색 제외
      .map(raw=>{
        const display = displayColorName(styleNo, raw);       // 화면 이름 (Charcoal 등)
        return {
          name: display, raw, hex: colorHex(raw),
          img: imgMap[display] || imgMap[prettyColor(raw)] || imgMap['_default'] || '',
          sizes: [...colorMap[raw]].sort(_sizeSort)
        };
      });

    /* styles 테이블이 비어 있으면 내장 카탈로그(STYLE_LIST)로 채운다.
       2026-08-29: styles 는 지금 0행이라 filter 조회가 늘 빈 배열을 준다.
       그래서 category 가 '' 로 내려가고, 제품 페이지의 빵부스러기가 스타일과
       상관없이 전부 'Short Sleeve' 로, Kids 스타일(2388)도 "Men's" 로 나왔다.
       getStyles() 는 이미 같은 폴백을 쓰고 있었는데 여기만 빠져 있었다. */
    const _fb   = STYLE_LIST.find(s => String(s.no) === String(styleNo)) || null;
    const _desc = (meta[0] && meta[0].description) || (_fb && _fb.desc) || '';
    const _cat  = (meta[0] && meta[0].category)    || (_fb && _fb.cat)  || '';

    return {
      styleNo,
      name: _desc ? (styleNo+' '+_desc) : styleNo,
      category: _cat,
      /* 표지(모델) 사진 — 목록 카드와 상품 페이지 **큰 사진**에만 쓴다.
         색이 아니므로 `colors` 에는 들어가지 않는다 (2026-09-15). */
      coverImg: imgMap.__cover || '',
      sizes, colors, casePer: CASE_PER
    };
  }

  /* ═══ 재고 한 스타일 읽기 (2026-09-22) ══════════════════════════════
     왜 함수로 바꿨나: inventory_web 은 inventory_web_exact 를 감싼 뷰인데, 그 안의
     b0 CTE(pr_boxes WHERE status='IN') 가 **두 번** 참조돼서 Postgres 가 인라인을
     못 한다. 그래서 style_number=eq.X 필터가 pr_boxes 까지 내려가지 못하고, 한 줄을
     읽어도 IN 박스 전체를 훑는다. 게다가 묶음 키가 btrim(upper(btrim(style))) 식이라
     일반 인덱스도 안 걸렸다. 실측 뷰 712~721ms — 한 번 몰리면 anon 문장 제한에
     걸려 500 이 뜬다(그게 9/22 상품페이지가 통째로 안 뜬 이유였다).
     DB 쪽 조치: pr_boxes_in_style_norm_idx(부분·식 인덱스) + inventory_web_style()
     (SECURITY DEFINER — anon 은 pr_boxes 를 RLS 때문에 직접 못 읽는다).
     계산식과 7501/5001/3001 자르기는 뷰와 **똑같다**(0/0 로 대조 확인).
     실측 함수 202~256ms.
     ⚠ 함수가 없어도 사이트는 멀쩡해야 한다 — 아래처럼 뷰로 자동 되돌아간다. */
  let _invRpcOk = true;   // 404/401/403 이면 false 로 내려앉아 이후엔 뷰만 쓴다
  function _invView(styleNo) {
    return _sb('inventory_web?style_number=eq.'+encodeURIComponent(styleNo)
              +'&select=color,size,wh,qty_on_hand');
  }
  async function _invRows(styleNo) {
    if (_invRpcOk) {
      try {
        const rows = await _sbRpc('inventory_web_style', { p_style: styleNo },
                                  'color,size,wh,qty_on_hand');
        if (Array.isArray(rows)) return rows;
        throw new Error('rpc 응답이 배열이 아니다');
      } catch (e) {
        const msg = String((e && e.message) || e);
        if (/\b(400|401|403|404)\b/.test(msg)) _invRpcOk = false;   // 함수가 없거나 권한이 없다
        console.warn('inventory_web_style 실패 -> inventory_web 뷰로:', msg);
      }
    }
    return _invView(styleNo);
  }

  async function _supabaseInventory(styleNo) {
    // 2026-08-26: inventory 테이블 → inventory_live 뷰로 교체.
    //   inventory 는 버린 IMS 가 쓰던 테이블이라 2026-08-18 에 갱신이 멈춰 있었다(270만장 차이).
    // 2026-08-29: inventory_live → inventory_web 으로 교체.
    //   inventory_live = pr_boxes(풀박스) + pr_pcroom(낱장) − 예약분 이라 웹에 낱장까지
    //   섞여 나왔다(409·523 처럼 박스 배수가 아닌 숫자). 웹은 psflowx 풀박스만 판다.
    //   inventory_web = pr_boxes(status='IN') − 예약분. 색 이름 정규화·7,500 자르기는 동일.
    // 2026-09-22: 읽기를 inventory_web_style() 함수로 교체 (_invRows 주석 참고).
    const rows = await _invRows(styleNo);
    const out = {};   // 화면색상명 → { SC:{size:qty}, CA:{size:qty} }
    rows.forEach(r=>{
      const wh = (String(r.wh||'').toUpperCase() === 'CA') ? 'CA' : 'SC';
      if (isHiddenColor(styleNo, r.color)) return;                // 숨긴 색(예: DS)의 재고는 제외
      const color = displayColorName(styleNo, r.color); const size = r.size;  // 화면 이름으로(Charcoal=HT만)
      if (!out[color]) out[color] = { SC:{}, CA:{} };
      out[color][wh][size] = (out[color][wh][size]||0) + (r.qty_on_hand||0);  // 중복행 합산
    });
    return out;  // 배열 변환은 화면이 product.sizes 순서로 매핑
  }


  /* ═══ 가격 (2026-08-29) ═══════════════════════════════════════════════
     테이블은 이미 있었는데(style_prices · customer_prices · sale_prices) 사이트가
     한 번도 읽지 않아서 장바구니 금액이 늘 '—' 였다. 여기서 한 곳에 모아 읽는다.

       style_prices    스타일 기본가 + 2XL~5XL 할증
       customer_prices 거래처별 가격 (2T~5XL, Youth/Juvy/Toddler 까지)
       sale_prices     스타일 + 색 + 사이즈 (각각 비우면 '전체') → 세일가 또는 %할인

     우선순위: 거래처가 > 기본가 → 그 위에 세일 적용.
     로그인 안 했으면 아무것도 안 가져온다 (가격은 승인된 거래처만 본다). */
  function _sess(){ try{ return JSON.parse(localStorage.getItem('pacific_user')||'null'); }catch(e){ return null; } }
  async function _authGet(path){
    const ss=_sess(); if(!ss||!ss.token) return null;
    try{
      const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,
        {headers:{apikey:SUPABASE_ANON_KEY, Authorization:'Bearer '+ss.token}});
      if(!r.ok) return null;
      return await r.json();
    }catch(e){ return null; }
  }
  let _myCustomerId; // undefined=아직 안 봄, null=없음
  async function _customerId(){
    if(_myCustomerId!==undefined) return _myCustomerId;
    const ss=_sess();
    if(!ss||!ss.userId){ _myCustomerId=null; return null; }
    const rows=await _authGet('customer_applications?user_id=eq.'+encodeURIComponent(ss.userId)+'&select=customer_id,status');
    const ok=(rows||[]).find(x=>x.status==='approved'&&x.customer_id);
    _myCustomerId = ok ? ok.customer_id : null;
    return _myCustomerId;
  }

  const _BIGSZ={'2XL':'price_2xl','3XL':'price_3xl','4XL':'price_4xl','5XL':'price_5xl'};
  const _TOTSZ={'2T':'price_2t','3T':'price_3t','4T':'price_4t','5T':'price_5t'};

  async function _pricing(styleNo, category){
    const cid=await _customerId();
    const [sp, cp, sale] = await Promise.all([
      _authGet('style_prices?style_number=eq.'+encodeURIComponent(styleNo)+'&select=*'),
      cid ? _authGet('customer_prices?customer_id=eq.'+encodeURIComponent(cid)
                     +'&style_number=eq.'+encodeURIComponent(styleNo)+'&select=*') : Promise.resolve(null),
      _authGet('sale_prices?style_number=eq.'+encodeURIComponent(styleNo)+'&select=*')
    ]);
    return { base:(sp&&sp[0])||null, cust:(cp&&cp[0])||null, sales:sale||[], cat:String(category||'') };
  }

  /* 큰 사이즈 할증은 위로 올라갈수록 비싸진다. 4XL·5XL 칸이 비어 있다고 기본가로
     떨어뜨리면 3XL($4.95)보다 4XL($3.75)이 싸지는 이상한 표가 된다.
     빈 칸은 바로 아래 사이즈의 할증을 그대로 물려받게 한다. (2026-08-30) */
  const _BIGORDER=['2XL','3XL','4XL','5XL'];
  const _TOTORDER=['2T','3T','4T','5T'];
  /* ⭐⭐ 확장사이즈 할증표 — **이 파일에서 단 하나다** (2026-09-21).
     [stated] 하윤: "통일할꺼면 우리 psflowx increase로 통일시켜줘"
     한 단계 올라갈 때마다 붙는 금액 (앞 사이즈 기준):
         2XL = XS~XL + 0.60
         3XL = 2XL   + 0.60
         4XL = 3XL   + 0.80
         5XL = 4XL   + 1.20
     -> 기본가 기준 누적: 2XL +0.60 · 3XL +1.20 · 4XL +2.00 · 5XL +3.20
     이 값은 psflowx 의 거래처 가격표 할증(psUp)·Quick Add 자동가와 **똑같은 숫자**다.
     ⚠⚠ 예전에는 표가 둘이었다 — 웹 0.60/1.00/1.50/2.50 vs psflowx 0.60/0.60/0.80/1.20.
        그래서 같은 스타일의 5XL 이 psflowx 에서는 6.95, 웹에서는 9.35 로 갈렸다.
        **표를 다시 둘로 쪼개지 말 것.** 바꿀 일이 있으면 이 한 줄만 바꾼다.
     ⚠ 칸에 값이 직접 들어 있으면 언제나 그 값이 먼저다 — 할증은 빈 칸을 채울 때만 쓴다. */
  const _XLSTEP={'2XL':0.60,'3XL':0.60,'4XL':0.80,'5XL':1.20};
  const _BIGSTEP=_XLSTEP;   /* 거래처 가격표의 빈 칸 채우기 */
  const _WEBSTEP=_XLSTEP;   /* 웹 기본가(style_prices)의 빈 칸 채우기 — 같은 표다 */
  const _WEBBIG=(function(){ const o={}; let a=0; _BIGORDER.forEach(z=>{ a+=_WEBSTEP[z]; o[z]=Math.round(a*100)/100; }); return o; })();
  /* => 2XL +0.60 · 3XL +1.20 · 4XL +2.00 · 5XL +3.20 */

  /* 💲 가격 칸 하나를 읽는 단 하나의 창구 (2026-09-21).
     [stated] 하윤: "만약 계약가에 0이나 가격이 안들어가 있으면 우리가 만들어놓은
              standard price가 적용되게 하자"
     0 은 "값이 없다" 와 똑같이 취급한다 -> undefined 를 주면 부르는 쪽이 저절로
     다음 출처(style_prices = Standard Price)로 흘러내려간다.
     ⚠ 판정을 `!=null` 로 되돌리지 말 것 — 0 이 진짜 가격으로 통과해서 $0.00 에 팔린다.
        실측 2026-09-21: customer_prices 에 base_price 0 인 줄이 173개(거래처 11곳) 있다. */
  function _pnum(v){
    if(v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return (isFinite(n) && n > 0) ? n : undefined;
  }

  function _stepUp(row, order, map, sz, steps){
    const i=order.indexOf(sz);
    if(i<0) return undefined;
    let add=0;
    for(let k=i;k>=0;k--){
      const col=map[order[k]];
      const cv=_pnum(row[col]);
      if(cv!==undefined) return Math.round((cv+add)*100)/100;
      if(steps && steps[order[k]]!=null) add+=steps[order[k]];   // 이 단계는 못 찾았으니 아래로 가면서 값을 더한다
    }
    return undefined;   // 아래로 내려가도 값이 없으면 기본가로
  }

  /* 정가 (세일 적용 전) — 사이즈에 따라 다르다 */
  function _listPrice(P, size){
    const sz=String(size||'').toUpperCase();
    const c=P.cust;
    if(c){
      /* ⭐ 여기서 하나도 못 찾으면 아래 const b=P.base 로 흘러내려가 Standard Price 가 된다.
         계약가 줄이 있어도 값이 0/빈칸이면 "계약가 없음" 과 같다 (2026-09-21 하윤 결정) */
      let v=_stepUp(c,_TOTORDER,_TOTSZ,sz,null);   if(v!==undefined) return v;
      v=_stepUp(c,_BIGORDER,_BIGSZ,sz,_BIGSTEP); if(v!==undefined) return v;
      let kv;
      if(/youth/i.test(P.cat)   && (kv=_pnum(c.price_youth))!==undefined)   return kv;
      if(/juvy/i.test(P.cat)    && (kv=_pnum(c.price_juvy))!==undefined)    return kv;
      if(/toddler/i.test(P.cat) && (kv=_pnum(c.price_toddler))!==undefined) return kv;
      /* 📈 계약가에 2XL~5XL 이 하나도 안 적혀 있으면 **기본가에 같은 할증**을 태운다 (2026-09-21).
         [stated] 하윤: "contract price가 있을경우 2XL 3XL 4XL 5XL 우리가 psflowx시스템에
                  사용하는 increase 로 적용"
         예전에는 여기서 기본가를 그냥 돌려줘서 **5XL 도 M 값**이었다 (실측 117줄 · 거래처 20곳).
         ⚠ 칸에 값이 적혀 있으면 위 _stepUp 에서 이미 잡혔다 — 여기까지 오면 정말 빈 것이다.
         ⚠ XS~XL 과 2T~5T 는 _WEBBIG 에 없으므로 0 이 더해진다 = 기본가 그대로 (부동) */
      if((kv=_pnum(c.base_price))!==undefined) return Math.round((kv+(_WEBBIG[sz]||0))*100)/100;
    }
    const b=P.base;
    if(b){
      /* 아동 계열 — 거래처 가격표(customer_prices)와 같은 칸을 웹 기본가에도 둔다 (2026-09-09).
         한 스타일은 자기 계열 칸 하나만 쓴다:
           Toddler price_toddler · Juvy price_juvy · Youth price_youth
           Kids  2T-5T price_2t · XS-XL base_price
         이렇게 두면 나중에 "이 거래처는 거래처가, 저 거래처는 웹 기본가" 로 바꿔도 두 표가 그대로 맞는다. */
      const vk=_stepUp(b,_TOTORDER,_TOTSZ,sz,null); if(vk!==undefined) return vk;
      let bk;
      if(/youth/i.test(P.cat)   && (bk=_pnum(b.price_youth))!==undefined)   return Math.round(bk*100)/100;
      if(/juvy/i.test(P.cat)    && (bk=_pnum(b.price_juvy))!==undefined)    return Math.round(bk*100)/100;
      if(/toddler/i.test(P.cat) && (bk=_pnum(b.price_toddler))!==undefined) return Math.round(bk*100)/100;
      /* 표(Price Management)에 값이 적혀 있으면 그 값이 먼저다 — 스타일별 예외를 손으로 넣을 수 있어야 한다.
         비어 있으면 기본가에서 _WEBBIG 규칙으로 계산한다. */
      const col=_BIGSZ[sz];
      const bc=col ? _pnum(b[col]) : undefined;
      if(bc!==undefined) return Math.round(bc*100)/100;
      const bb=_pnum(b.base_price);
      if(bb!==undefined) return Math.round((bb+(_WEBBIG[sz]||0))*100)/100;
      const v=_stepUp(b,_BIGORDER,_BIGSZ,sz,_BIGSTEP); if(v!==undefined) return v;
    }
    return null;
  }

  /* ⏳ 세일 종료일 (2026-09-22) ─────────────────────────────────────
     sale_prices.ends_on = 세일 마지막 날 (그 날까지 세일가). NULL 이면 종료일 없음.
     [stated] 하윤: "세일한 가격 나오는거 옆에 언제까지 한다 날짜 나오게 하자"

     ⚠⚠ 이 규칙은 checkout 워커의 _saleFor 에도 **똑같이** 들어 있다.
        한쪽만 고치면 화면 금액과 워커 금액이 갈려서 결제가 409 로 막힌다.
     ⚠ "오늘" 은 America/New_York 으로 못 박는다. UTC 로 재면 미국 저녁에 이미
        다음 날이라 세일이 하루 일찍 끝난다. 브라우저(손님 시간대)와 워커(UTC)가
        서로 다른 답을 내면 역시 409 다.
     ⚠ new Date('2026-10-15') 로 파싱하지 말 것 — UTC 로 읽어서 하루 밀린다.
        'YYYY-MM-DD' 는 글자 비교만으로 날짜 비교가 된다. */
  function _saleToday(){
    try{
      return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',
        year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    }catch(e){ return new Date().toISOString().slice(0,10); }
  }
  function _saleLive(s){
    const e = (s && s.ends_on) ? String(s.ends_on).slice(0,10) : '';
    if(!e) return true;                /* 종료일 없음 = 계속 (칸이 아예 없는 DB 도 여기로 온다) */
    return e >= _saleToday();          /* 마지막 날까지는 세일가 */
  }

  /* 이 색·사이즈에 걸린 세일 중 제일 구체적인 것 하나 */
  function _saleFor(P, color, size){
    const c=String(color||'').toUpperCase(), z=String(size||'').toUpperCase();
    const hit=(P.sales||[]).filter(s=>{
      if(!_saleLive(s)) return false;      /* ⏳ 지난 세일은 없는 것으로 본다 */
      const sc=s.color?String(s.color).toUpperCase():null;
      const sz=s.size ?String(s.size ).toUpperCase():null;
      return (!sc||sc===c) && (!sz||sz===z);
    });
    if(!hit.length) return null;
    // 색+사이즈 둘 다 지정한 게 제일 구체적 → 그 다음 하나만 → 전체
    hit.sort((a,b)=>((b.color?1:0)+(b.size?1:0))-((a.color?1:0)+(a.size?1:0)));
    return hit[0];
  }

  /* 최종 단가 — { list, price, onSale, endsOn } */
  /* ⭐⭐ 세일가에도 확장사이즈 할증이 붙는다 (2026-09-22)
     [stated] 하윤: "XS-XL 가 세일을 $3.40에 하면 거기에 2XL 3XL 4XL 5XL은 우리가
              정해놓은 increase amount가 추가 되서 나오는건데. 저렇케 전체 다 3.40이아니라"
     그래서 **사이즈를 안 집은 세일의 sale_price 는 XS~XL 값**이고, 큰 사이즈는 정가가
     쓰는 것과 **같은 폭**을 얹는다: 2XL +0.60 · 3XL +1.20 · 4XL +2.00 · 5XL +3.20
     ⭐ 폭을 여기서 다시 적지 않는다 — 정가끼리 빼서 구한다. 그래야 style_prices 에
       값이 직접 적힌 스타일(할증표를 안 쓰는 예외)도 그 스타일의 폭을 그대로 따른다.
     ⚠ **사이즈를 딱 집은 세일(size='2XL')은 그 사이즈 값 그대로다** — 할증을 또 얹으면
       "2XL 만 $4.00 에" 라고 적은 것이 $4.60 이 되어 버린다.
     ⚠ % 할인은 손댈 것이 없다 — 사이즈별 정가에 곱하니 폭이 저절로 따라간다.
     ⚠⚠ 이 규칙은 checkout 워커의 _priceOf 에도 **똑같이** 들어 있다. 한쪽만 고치면
        화면 금액과 워커 금액이 갈려서 /quote 가 409 로 주문을 막는다. */
  const _SALE_REF='M';   /* 확장사이즈가 아닌 기준 사이즈 — 어느 계열이든 기본가가 나온다 */
  function _priceOf(P, color, size){
    const list=_listPrice(P, size);
    if(list==null) return {list:null, price:null, onSale:false, endsOn:null};
    const s=_saleFor(P, color, size);
    if(!s) return {list:list, price:list, onSale:false, endsOn:null};
    /* 💲 세일가 0 도 빈칸으로 본다 — 0 을 적어 공짜로 나가는 일이 없게 (2026-09-21) */
    const sv=_pnum(s.sale_price);
    let v;
    if(sv!==undefined){
      if(s.size){ v=sv; }                                  /* 사이즈를 집은 세일 = 그대로 */
      else {
        const refList=_listPrice(P, _SALE_REF);
        v = (refList==null) ? sv : (sv + (list - refList)); /* 정가와 같은 폭을 얹는다 */
      }
    } else if(s.percent_off!=null){ v = list*(1-Number(s.percent_off)/100); }
    else { v = list; }
    v = Math.round(v*100)/100;
    const on = (v<list);
    /* endsOn 은 **세일이 실제로 값을 깎았을 때만** 준다 — 화면이 "언제까지" 를 찍는 조건과 같다 */
    return {list:list, price:v, onSale:on, endsOn:(on && s.ends_on) ? String(s.ends_on).slice(0,10) : null};
  }

  /* ===== ⑥ 공개 API =================================================== */
  return {
    /* 가격: getPricing() 으로 한 번 받아서 priceOf() 로 칸마다 계산한다 */
    getPricing: function(styleNo, category){ return _pricing(styleNo, category); },
    priceOf: function(P, color, size){ return _priceOf(P, color, size); },
    listPrice: function(P, size){ return _listPrice(P, size); },
    config: {
      sizeOrder: SIZE_ORDER, casePer: CASE_PER,
      warehouses: WAREHOUSES, source: SOURCE
    },

    getProduct: async function (styleNo) {
      return SOURCE === 'supabase' ? _supabaseProduct(styleNo) : _mockProduct(styleNo);
    },

    /* 색 이름 규칙을 바깥에서도 쓴다 (2026-09-12).
       Shop by Color 처럼 **여러 스타일의 색을 한 자리에 모으는** 화면은 상품 페이지와
       똑같은 규칙을 써야 한다 — 안 그러면 1210 의 `CHARCOAL (HT)` 가 `Charcoal` 과
       따로 떠서 같은 색이 두 칸으로 보이고, 숨긴 색(1390 `PFD (L)`)까지 나온다.
       규칙은 위 `COLOR_RULES` 한 곳에만 둔다 — 베끼면 반드시 어긋난다. */
    colorDisplay: function (styleNo, raw) { return displayColorName(String(styleNo), raw); },
    colorHidden:  function (styleNo, raw) { return isHiddenColor(String(styleNo), raw); },
    colorPretty:  function (raw) { return prettyColor(raw); },

    // 전체 스타일 목록 (제품 목록/카테고리 화면용)
    getStyles: async function () {
      if (SOURCE === 'supabase') {
        try {
          const rows = await _sb('styles?select=style_number,description,category,brand,size_range&order=style_number');
          if (rows && rows.length) return rows.map(r => ({
            no: r.style_number, desc: r.description || '', cat: r.category || '',
            sr: r.size_range || '', brand: r.brand || null
          }));
        } catch (e) { /* styles 조회 실패 → 아래 내장 카탈로그로 폴백 */ }
        // styles 테이블이 비었거나 실패하면 내장 카탈로그(STYLE_LIST)로 대체 → 브라우징 항상 동작
        return STYLE_LIST.map(s => Object.assign({}, s));
      }
      return STYLE_LIST.map(s => Object.assign({}, s));
    },

    // 재고를 화면이 쓰기 쉬운 형태 { 색상: { SC:[사이즈순 숫자], CA:[...] } } 로 정규화
    /* 📦 장바구니를 **한 창고에서 전부** 보낼 수 있나 (2026-09-18).
       두 창고에서 나가면 운임을 두 번 내게 된다 — 한쪽에 재고가 다 있으면 합치는 게 싸다.
       ⚠ 재고는 **양쪽 수량을 합쳐서** 본다. SC 1장 + CA 1장이면 그 창고에 2장이 있어야 한다.
       ⚠ 못 읽으면 조용히 {SC:false, CA:false} — 못 합치는 걸로 본다 (체크아웃은 그대로 돈다). */
    canCombine: async function (items) {
      const out = { SC:false, CA:false };
      try{
        const list = (items||[]).filter(i=>i && i.style && (Number(i.qty)||0) > 0);
        if (!list.length) return out;
        const styles = Array.from(new Set(list.map(i=>String(i.style))));
        const inv = {};
        for (const st of styles) inv[st] = await _supabaseInventory(st);
        // (스타일|색|사이즈) 별로 양쪽 수량을 합친다
        const need = {};
        list.forEach(i=>{
          const k = String(i.style)+'|'+String(i.color)+'|'+String(i.size);
          need[k] = (need[k]||0) + (Number(i.qty)||0);
        });
        ['SC','CA'].forEach(wh=>{
          out[wh] = Object.keys(need).every(k=>{
            const p = k.split('|'); const st = p[0], color = p[1], size = p[2];
            const have = ((inv[st]||{})[color]||{})[wh];
            return have ? (Number(have[size]||0) >= need[k]) : false;
          });
        });
      }catch(e){ return { SC:false, CA:false }; }
      return out;
    },

    getInventory: async function (styleNo, product) {
      const sizes = (product && product.sizes) || SIZE_ORDER;
      if (SOURCE === 'supabase') {
        const raw = await _supabaseInventory(styleNo);
        const out = {};
        Object.keys(raw).forEach(color=>{
          out[color] = {
            SC: sizes.map(s => raw[color].SC[s] || 0),
            CA: sizes.map(s => raw[color].CA[s] || 0)
          };
        });
        // skus엔 있는데 inventory엔 없는 색상 → 0으로 채움
        (product ? product.colors : []).forEach(c=>{
          if (!out[c.name]) out[c.name] = { SC:sizes.map(()=>0), CA:sizes.map(()=>0) };
        });
        return out;
      }
      return _mockInventory(styleNo, product);
    },

    // 한 스타일의 색상별 사진 (관리 화면/상세에서 사용)
    getImages: async function (styleNo) {
      return SOURCE === 'supabase' ? _supabaseImages(styleNo) : {};
    },

    // 모든 스타일의 "대표 사진 1장" (제품 목록 카드용) → { style_number: URL }
    getStyleThumbs: async function () {
      if (SOURCE !== 'supabase') return {};
      try {
        const rows = await _sb('product_images?select=style_number,color,image_path,sort_order,created_at&order=sort_order.asc,created_at.desc');
        const out = {}, cover = {};
        rows.forEach(r => {
          if (isCoverColor(r.color)) { if (!cover[r.style_number]) cover[r.style_number] = _imageUrl(r.image_path); return; }
          if (!out[r.style_number]) out[r.style_number] = _imageUrl(r.image_path);
        });
        /* ⚠ 표지는 **무조건 이긴다.** 아니면 카드 사진이 "사진이 들어온 순서"(우연)에
           따라 정해진다 — 1315R 이 그랬다. (카테고리 화면의 ★ 보다도 뒤에 와야 해서
           그쪽에서도 한 번 더 덮는다 — epacific-category.html 참고) */
        Object.keys(cover).forEach(n => { out[n] = cover[n]; });
        return out;
      } catch (e) { return {}; }
    },

    imageUrl: function (path) { return _imageUrl(path); },

    prettyColor, colorHex,
    isHiddenColor, displayColorName,
    /* 표지(모델) 사진 예약 색 이름 — 화면들이 같은 글자를 써야 한다 (2026-09-15) */
    COVER_COLOR, isCoverColor
  };
})();

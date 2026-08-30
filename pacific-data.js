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
    // PFD 스타일: 실번수 붙인 이름으로 통일 표시
    '1290': { hide: [], rename: { 'PFD (F)': '20/1 PFD' } },
    // 1390: 1급 로트 (J)+(L) 합쳐 '30/1 PFD' 하나로 표시(재고는 'PFD (J)' 행에 합산). 세컨(S)/중복(L)은 숨김.
    '1390': { hide: ['PFD (L)', 'PFD (S)'], rename: { 'PFD (J)': '30/1 PFD' } },
    '1690': { hide: [], rename: { 'PFD': '16/1 PFD' } }
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
    {no:'1314',desc:'Adult 30/1 100% Cotton Tank Top',cat:'Adult Tank Top',sr:'XS-5XL'},
    {no:'1315',desc:'Adult 30/1 100% Cotton Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1315R',desc:'Adult 30/1 100% Cotton Short Sleeve Ringer Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1322',desc:'Adult 30/1 100% Cotton Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1330',desc:'Adult Omni Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1332',desc:'Adult Omni Long Sleeve Tee',cat:'Adult L/S',sr:'XS-5XL'},
    {no:'1348',desc:'Adult 30/1 CVC Hoodie Long Sleeve Tee',cat:'Adult Hoodie L/S',sr:'XS-5XL'},
    {no:'1350',desc:'Adult Snow Htr Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'1351',desc:'Adult Snow Htr V-Neck Short Sleeve Tee',cat:'Adult V-Neck S/S',sr:'XS-5XL'},
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

  // product_images 에서 한 스타일의 색상별 사진 읽기 → { 색상(예쁜표기): URL }
  async function _supabaseImages(styleNo) {
    const rows = await _sb('product_images?style_number=eq.'+encodeURIComponent(styleNo)
                          +'&select=color,image_path,sort_order&order=sort_order');
    const out = {};
    rows.forEach(r => {
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
      sizes, colors, casePer: CASE_PER
    };
  }

  async function _supabaseInventory(styleNo) {
    // 2026-08-26: inventory 테이블 → inventory_live 뷰로 교체.
    //   inventory 는 버린 IMS 가 쓰던 테이블이라 2026-08-18 에 갱신이 멈춰 있었다(270만장 차이).
    // 2026-08-29: inventory_live → inventory_web 으로 교체.
    //   inventory_live = pr_boxes(풀박스) + pr_pcroom(낱장) − 예약분 이라 웹에 낱장까지
    //   섞여 나왔다(409·523 처럼 박스 배수가 아닌 숫자). 웹은 psflowx 풀박스만 판다.
    //   inventory_web = pr_boxes(status='IN') − 예약분. 색 이름 정규화·7,500 자르기는 동일.
    const rows = await _sb('inventory_web?style_number=eq.'+encodeURIComponent(styleNo)
                          +'&select=color,size,wh,qty_on_hand');
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
  /* 빈 칸을 채울 때 한 단계 올라갈 때마다 붙는 금액 (2026-08-30, 사장님 규칙)
       4XL = 3XL + 0.80
       5XL = 4XL + 1.20   (→ 3XL 만 있으면 5XL = 3XL + 2.00)
     값이 직접 들어 있으면 그 값이 먼저다. 규칙이 없는 단계는 아래 값을 그대로 쓴다. */
  const _BIGSTEP={'4XL':0.80,'5XL':1.20};
  function _stepUp(row, order, map, sz, steps){
    const i=order.indexOf(sz);
    if(i<0) return undefined;
    let add=0;
    for(let k=i;k>=0;k--){
      const col=map[order[k]];
      if(row[col]!=null) return Math.round((Number(row[col])+add)*100)/100;
      if(steps && steps[order[k]]!=null) add+=steps[order[k]];   // 이 단계는 못 찾았으니 아래로 가면서 값을 더한다
    }
    return undefined;   // 아래로 내려가도 값이 없으면 기본가로
  }

  /* 정가 (세일 적용 전) — 사이즈에 따라 다르다 */
  function _listPrice(P, size){
    const sz=String(size||'').toUpperCase();
    const c=P.cust;
    if(c){
      let v=_stepUp(c,_TOTORDER,_TOTSZ,sz,null);   if(v!==undefined) return v;
      v=_stepUp(c,_BIGORDER,_BIGSZ,sz,_BIGSTEP); if(v!==undefined) return v;
      if(/youth/i.test(P.cat)   && c.price_youth!=null)   return Number(c.price_youth);
      if(/juvy/i.test(P.cat)    && c.price_juvy!=null)    return Number(c.price_juvy);
      if(/toddler/i.test(P.cat) && c.price_toddler!=null) return Number(c.price_toddler);
      if(c.base_price!=null) return Number(c.base_price);
    }
    const b=P.base;
    if(b){
      const v=_stepUp(b,_BIGORDER,_BIGSZ,sz,_BIGSTEP); if(v!==undefined) return v;
      if(b.base_price!=null) return Number(b.base_price);
    }
    return null;
  }

  /* 이 색·사이즈에 걸린 세일 중 제일 구체적인 것 하나 */
  function _saleFor(P, color, size){
    const c=String(color||'').toUpperCase(), z=String(size||'').toUpperCase();
    const hit=(P.sales||[]).filter(s=>{
      const sc=s.color?String(s.color).toUpperCase():null;
      const sz=s.size ?String(s.size ).toUpperCase():null;
      return (!sc||sc===c) && (!sz||sz===z);
    });
    if(!hit.length) return null;
    // 색+사이즈 둘 다 지정한 게 제일 구체적 → 그 다음 하나만 → 전체
    hit.sort((a,b)=>((b.color?1:0)+(b.size?1:0))-((a.color?1:0)+(a.size?1:0)));
    return hit[0];
  }

  /* 최종 단가 — { list, price, onSale } */
  function _priceOf(P, color, size){
    const list=_listPrice(P, size);
    if(list==null) return {list:null, price:null, onSale:false};
    const s=_saleFor(P, color, size);
    if(!s) return {list:list, price:list, onSale:false};
    let v = (s.sale_price!=null) ? Number(s.sale_price)
          : (s.percent_off!=null) ? (list*(1-Number(s.percent_off)/100)) : list;
    v = Math.round(v*100)/100;
    return {list:list, price:v, onSale:(v<list)};
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
        const rows = await _sb('product_images?select=style_number,image_path,sort_order&order=sort_order');
        const out = {};
        rows.forEach(r => { if (!out[r.style_number]) out[r.style_number] = _imageUrl(r.image_path); });
        return out;
      } catch (e) { return {}; }
    },

    imageUrl: function (path) { return _imageUrl(path); },

    prettyColor, colorHex,
    isHiddenColor, displayColorName
  };
})();

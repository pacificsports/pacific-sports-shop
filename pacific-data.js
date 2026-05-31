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
  const COLOR_HEX = {
    'ABYSS':'#2c3e4f','ARTICHOKE':'#7d8064','BABY BLUE':'#a9c9e0','BERMUDA':'#5bbcb6',
    'BLACK':'#232323','BLACK PEARL':'#33353a','BROWN':'#6b4a36','BUTTER':'#f3e3a0',
    'CANARY':'#f5d935','CANTALOUPE':'#f0a875','CARDINAL':'#8e2535','CHAMBRAY':'#6d8aa8',
    'CINNAMON':'#b05c33','CLOVER':'#3f7d4f','FROST BLUE':'#bcd6dc','GREY HEATHER':'#a8a8a4',
    'HONEYCOMB':'#e8b84a','ICEBERG':'#aac6cc','KEY LIME':'#cfe08a','MAKO':'#3a4a52',
    'MIDNIGHT BLUE':'#27314a','MONACO BLUE':'#2f5b8f','NATURAL':'#ede6d6','NAVY':'#27314f',
    'OLIVE':'#6b6a3f','PAPAYA':'#f0905a','PEWTER':'#8c8c86','PINK ICE':'#edc6cf',
    'PISTACHIO':'#bcd09a','PURPLE':'#5a3f7a','RIVER GREEN':'#4f8a7a','ROOT BEER':'#4a2f26',
    'RUST':'#a85636','SAND':'#d8c4a0','SAPPHIRE':'#2f4f8f','SEASIDE':'#7ab0bc',
    'SHADOW GREY':'#6e6e6e','SLATE':'#5a6470','SMOKE':'#8a9aa0','TABASCO':'#9c2f2f',
    'TAN':'#c9a87c','TURQUOISE':'#3aa8b0','WHEAT':'#e0cd9a','WHITE':'#f7f7f4','WINE':'#5a2733'
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
    {no:'1690',desc:'Adult 16/1 100% Cotton Heavyweight Short Sleeve Tee',cat:'Adult S/S',sr:'XS-5XL'},
    {no:'2210',desc:'Youth 22/1 100% Cotton Short Sleeve Tee',cat:'Youth S/S',sr:'XS-XL'},
    {no:'2212',desc:'Youth 22/1 100% Cotton Long Sleeve Tee',cat:'Youth L/S',sr:'XS-XL'},
    {no:'2310',desc:'Youth 30/1 100% Cotton Short Sleeve Tee',cat:'Youth S/S',sr:'XS-XL'},
    {no:'2312',desc:'Kids 30/1 CVC Long Sleeve Tee',cat:'Kids L/S',sr:'2T-XL'},
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
    {no:'8110',desc:'Adult Polyester Performance Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8150',desc:'Adult Cationic Performance Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8155',desc:'Adult Spacedye Performance Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
    {no:'8180',desc:'Adult Mesh Performance Short Sleeve Tee',cat:'Adult Performance',sr:'XS-5XL'},
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
      styleNo: sNo, name, category: meta ? meta.cat : "Men's / Short Sleeve",
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

    const colors = Object.keys(colorMap).sort().map(raw=>{
      const pretty = prettyColor(raw);
      return {
        name: pretty, raw, hex: colorHex(raw),
        img: imgMap[pretty] || imgMap['_default'] || '',
        sizes: [...colorMap[raw]].sort(_sizeSort)
      };
    });

    return {
      styleNo,
      name: (meta[0] && meta[0].description) ? (styleNo+' '+meta[0].description) : styleNo,
      category: (meta[0] && meta[0].category) || '',
      sizes, colors, casePer: CASE_PER
    };
  }

  async function _supabaseInventory(styleNo) {
    const whMap = await _warehouseMap();
    const rows = await _sb('inventory?style_number=eq.'+encodeURIComponent(styleNo)
                          +'&select=color,size,warehouse_id,qty_on_hand');
    const out = {};   // prettyColor → { SC:{size:qty}, CA:{size:qty} }
    rows.forEach(r=>{
      const wh = whMap[r.warehouse_id]; if (!wh) return;          // SC/CA/PCR만
      const color = prettyColor(r.color); const size = r.size;
      if (!out[color]) out[color] = { SC:{}, CA:{} };
      out[color][wh][size] = (out[color][wh][size]||0) + (r.qty_on_hand||0);  // 중복행 합산
    });
    return out;  // 배열 변환은 화면이 product.sizes 순서로 매핑
  }


  /* ===== ⑥ 공개 API =================================================== */
  return {
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
        const rows = await _sb('styles?select=style_number,description,category,brand,size_range&order=style_number');
        return rows.map(r => ({
          no: r.style_number, desc: r.description || '', cat: r.category || '',
          sr: r.size_range || '', brand: r.brand || null
        }));
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

    prettyColor, colorHex
  };
})();

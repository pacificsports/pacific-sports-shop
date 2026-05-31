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

  /* ===== ① 데이터 소스 스위치 ===========================================
     'mock'     = 예시 데이터로 동작 (Supabase 불필요). 지금 단계.
     'supabase' = 실제 IMS 재고/카탈로그를 읽어옴.
  ====================================================================== */
  const SOURCE = 'mock';

  const SUPABASE_URL      = '';   // 예: 'https://abcd1234.supabase.co'
  const SUPABASE_ANON_KEY = '';   // anon public key (service_role 키는 절대 넣지 말 것)


  /* ===== ② 케이스 규칙 + 사이즈 표시 순서 ===============================
     IMS와 동일. XS–2XL = 72/case, 3XL–5XL = 48/case. 낱장(PC) 허용, MOQ 없음.
     실제로 보여줄 사이즈는 각 스타일이 skus 에 가진 것만 (아래 순서대로 정렬).
  ====================================================================== */
  const SIZE_ORDER = ['XS','S','M','L','XL','2XL','3XL','4XL','5XL'];
  const CASE_PER = { XS:72, S:72, M:72, L:72, XL:72, '2XL':72, '3XL':48, '4XL':48, '5XL':48 };

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

  function _mockProduct() {
    return {
      styleNo:'1368', name:'1368 Short Sleeve Crew', category:"Men's / Short Sleeve",
      sizes: MOCK_SIZES.slice(),
      colors: MOCK_COLORS.map(c => ({ name:prettyColor(c), raw:c, hex:colorHex(c), img:'' })),
      casePer: CASE_PER
    };
  }
  function _mockInventory() {
    const tiers=[0,0,0,72,144,216,288,500,1000,1500];
    const out={};
    MOCK_COLORS.forEach(c=>{
      const pretty=prettyColor(c);
      const g=(rnd)=>MOCK_SIZES.map(()=>tiers[rnd(tiers.length)]);
      out[pretty]={ SC:g(_seedRand(c+'SC')), CA:g(_seedRand(c+'CA')) };
    });
    return out;
  }


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
    const colors = Object.keys(colorMap).sort().map(raw=>({
      name: prettyColor(raw), raw, hex: colorHex(raw), img:'',
      sizes: [...colorMap[raw]].sort(_sizeSort)
    }));

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
      return _mockInventory(styleNo);
    },

    prettyColor, colorHex
  };
})();

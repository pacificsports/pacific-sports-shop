/* =====================================================================
   PACIFIC SPORTS — 공용 데이터 레이어 (pacific-data.js)
   ---------------------------------------------------------------------
   모든 화면(상품/장바구니/주문내역/색상별/명세서)이 여기서만 데이터를 읽어요.
   화면 코드는 절대 데이터를 직접 들고 있지 않습니다. 그래서 나중에 실제
   재고(Supabase/IMS)로 바꿀 때, 화면은 하나도 안 건드리고 이 파일만 고치면 돼요.

   사용법 (화면에서):
     const cfg     = PacificData.config;                 // 사이즈/창고 규칙
     const product = await PacificData.getProduct('1368'); // 카탈로그
     const inv     = await PacificData.getInventory('1368');// 창고별 재고

   ===== 실제 재고로 전환할 때 (나중에) =====
     1) 아래 SOURCE 를 'supabase' 로 변경
     2) SUPABASE_URL / SUPABASE_ANON_KEY 채우기 (IMS 프로젝트 값)
     3) _supabaseInventory() 안의 테이블·컬럼명을 IMS 스키마에 맞추기
   ===================================================================== */

window.PacificData = (function () {

  /* ===== ① 데이터 소스 스위치 ===========================================
     'mock'     = 지금. 예시 데이터로 동작 (인터넷/Supabase 불필요)
     'supabase' = 나중. 실제 IMS 재고를 읽어옴
  ====================================================================== */
  const SOURCE = 'mock';

  // ↓↓↓ SOURCE='supabase' 일 때만 사용 (지금은 비워둬도 됨) ↓↓↓
  const SUPABASE_URL      = '';   // 예: 'https://abcd1234.supabase.co'
  const SUPABASE_ANON_KEY = '';   // IMS 프로젝트의 anon public key


  /* ===== ② 케이스 규칙 (IMS와 동일) =====================================
     XS–2XL = 72 pcs/case, 3XL = 48 pcs/case. 낱장(PC) 주문 허용, MOQ 없음.
  ====================================================================== */
  const SIZES = [
    { label: 'XS',  per: 72 },
    { label: 'S',   per: 72 },
    { label: 'M',   per: 72 },
    { label: 'L',   per: 72 },
    { label: 'XL',  per: 72 },
    { label: '2XL', per: 72 },
    { label: '3XL', per: 48 }
  ];
  const WAREHOUSES = ['SC', 'CA'];


  /* ===== ③ 카탈로그 ====================================================
     지금은 스타일 1368 한 개. 나중에 Supabase products 테이블에서 불러올 자리.
     색상명(name)은 IMS와 철자까지 동일하게. hex는 미리보기용, img는 실제 사진 URL.
  ====================================================================== */
  const IMG = 'https://epacificsports.com/wp-content/uploads/2022/03/';

  const PRODUCTS = {
    '1368': {
      styleNo:  '1368',
      name:     '1368 Short Sleeve Crew',
      category: "Men's / Short Sleeve",
      // 사이즈별 도매가 (로그인 후 표시). 나중에 거래처 등급별 가격으로 확장 가능.
      sizePrice: { XS:3.75, S:3.75, M:3.75, L:3.75, XL:3.75, '2XL':4.35, '3XL':4.95 },
      colors: [
        { name:'Natural',        hex:'#ede6d6', img:IMG+'NATURAL-2-300x300.jpg' },
        { name:'White',          hex:'#f7f7f4', img:IMG+'1368_WHITE_0071.jpg' },
        { name:'Black',          hex:'#232323', img:IMG+'BLACK_0041.jpg' },
        { name:'Black Pearl',    hex:'#33353a', img:IMG+'BLACKPEARL_0237.jpg' },
        { name:'Abyss',          hex:'#2c3e4f', img:IMG+'ABYSS_0130.jpg' },
        { name:'Artichoke',      hex:'#7d8064', img:IMG+'ARTICHOKE_0056.jpg' },
        { name:'Baby Blue',      hex:'#a9c9e0', img:IMG+'BABY-BLUE-300x300.png' },
        { name:'Bermuda',        hex:'#5bbcb6', img:IMG+'BERMUDA_0046.jpg' },
        { name:'Brown',          hex:'#6b4a36', img:IMG+'BROWN_0288.jpg' },
        { name:'Butter',         hex:'#f3e3a0', img:IMG+'BUTTER-300x300.png' },
        { name:'Canary',         hex:'#f5d935', img:IMG+'CANARY_0100.jpg' },
        { name:'Cantaloupe',     hex:'#f0a875', img:IMG+'CANTALOUPE_0033.jpg' },
        { name:'Cardinal',       hex:'#8e2535', img:IMG+'CARDINAL_0264.jpg' },
        { name:'Chambray',       hex:'#6d8aa8', img:IMG+'CHAMBRAY_0257.jpg' },
        { name:'Charcoal Htr',   hex:'#595959', img:IMG+'CHARCOALHEATHER_0319-1.jpg' },
        { name:'Cinnamon',       hex:'#b05c33', img:IMG+'CINNAMON_0009.jpg' },
        { name:'Clover',         hex:'#3f7d4f', img:IMG+'CLOVER_0116.jpg' },
        { name:'Frost Blue',     hex:'#bcd6dc', img:IMG+'FROSTBLUE_0108.jpg' },
        { name:'Future Dusk',    hex:'#6a6480', img:IMG+'FUTURE-DUSK-300x300.png' },
        { name:'Grey Htr',       hex:'#a8a8a4', img:IMG+'GREYHEATHER_0304.jpg' },
        { name:'Honeycomb',      hex:'#e8b84a', img:IMG+'HONEYCOMB_0148.jpg' },
        { name:'Iceberg',        hex:'#aac6cc', img:IMG+'ICEBERG_0242.jpg' },
        { name:'Key Lime',       hex:'#cfe08a', img:IMG+'KEY-LIME-300x300.png' },
        { name:'Light Blue Htr', hex:'#bcccd8', img:IMG+'LIGHTBLUEHEATHER_0155.jpg' },
        { name:'Mako',           hex:'#3a4a52', img:IMG+'MAKO_0313.jpg' },
        { name:'Midnight Blue',  hex:'#27314a', img:IMG+'MIDNIGHTBLUE_0298.jpg' },
        { name:'Monaco Blue',    hex:'#2f5b8f', img:IMG+'MONACOBLUE_0084.jpg' },
        { name:'Navy',           hex:'#27314f', img:IMG+'1368_NAVY_0063.jpg' },
        { name:'Navy Htr',       hex:'#3a4360', img:IMG+'1368_NAVYHEATHER_0141.jpg' },
        { name:'Olive',          hex:'#6b6a3f', img:IMG+'1368_Olive_0026.jpg' },
        { name:'Papaya',         hex:'#f0905a', img:IMG+'1368_PAPAYA_0270.jpg' },
        { name:'Peach Rose',     hex:'#e8a99c', img:IMG+'PEACH-ROSE-300x300.png' },
        { name:'Pewter',         hex:'#8c8c86', img:IMG+'1368_PEWTER_0123.jpg' },
        { name:'Pink Ice',       hex:'#edc6cf', img:IMG+'1368_PINKICE_0202.jpg' },
        { name:'Pistachio',      hex:'#bcd09a', img:IMG+'1368_PISTACHIO_0166.jpg' },
        { name:'Purple',         hex:'#5a3f7a', img:IMG+'1368_PURPLE_0227.jpg' },
        { name:'Red Htr',        hex:'#b0464a', img:IMG+'1368_REDHEATHER_0211.jpg' },
        { name:'River Green',    hex:'#4f8a7a', img:IMG+'1368_RIVERGREEN_0173.jpg' },
        { name:'Root Beer',      hex:'#4a2f26', img:IMG+'1368_ROOTBEER_0278.jpg' },
        { name:'Royal Htr',      hex:'#3a4a8c', img:IMG+'1368_ROYALHEATHER_0187.jpg' },
        { name:'Rust',           hex:'#a85636', img:IMG+'RUST-300x300.png' },
        { name:'Sand',           hex:'#d8c4a0', img:IMG+'1368_SAND_0180.jpg' },
        { name:'Sapphire',       hex:'#2f4f8f', img:IMG+'SAPPHIRE-300x300.png' },
        { name:'Seaside',        hex:'#7ab0bc', img:IMG+'1368_SEASIDE_0161.jpg' },
        { name:'Shadow Grey',    hex:'#6e6e6e', img:IMG+'1368_SHADOWGREY_0194.jpg' },
        { name:'Slate',          hex:'#5a6470', img:IMG+'1368_SLATE_0019.jpg' },
        { name:'Smoke',          hex:'#8a9aa0', img:IMG+'1368_SMOKE_0324.jpg' },
        { name:'Tabasco',        hex:'#9c2f2f', img:IMG+'1368_TABASCO_0219.jpg' },
        { name:'Tan',            hex:'#c9a87c', img:IMG+'1368_TAN_0093.jpg' },
        { name:'Turquoise',      hex:'#3aa8b0', img:IMG+'1368_TURQUOISE_0249.jpg' },
        { name:'Wheat',          hex:'#e0cd9a', img:IMG+'1368_WHEAT_0077.jpg' },
        { name:'Wine',           hex:'#5a2733', img:IMG+'1368_WINE_0335.jpg' }
      ]
    }
  };


  /* ===== ④ MOCK 재고 (예시) ============================================
     반환 형태(중요 — 이 형태가 화면이 기대하는 "계약"입니다):
       { [색상명]: { SC:[7개 숫자], CA:[7개 숫자] } }
       배열 순서는 SIZES 순서(XS,S,M,L,XL,2XL,3XL)와 1:1.
     실제 Supabase 함수도 똑같은 형태로 돌려주기만 하면 화면은 그대로 동작.
  ====================================================================== */
  function _seedRand(seed) {
    let x = 0;
    for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) % 9973;
    return (mult) => { x = (x * 1103515245 + 12345) % 2147483648; return Math.floor((x / 2147483648) * mult); };
  }
  function _mockInventory(styleNo) {
    const product = PRODUCTS[styleNo];
    if (!product) return {};
    const tiers = [0, 72, 144, 216, 288, 500, 1000, 1500, 2500];
    const out = {};
    product.colors.forEach(c => {
      const gen = (rnd) => SIZES.map(() => {
        const r = rnd(10);
        return r === 0 ? 0 : tiers[rnd(tiers.length)];
      });
      out[c.name] = {
        SC: gen(_seedRand(c.name + 'SC')),
        CA: gen(_seedRand(c.name + 'CA'))
      };
    });
    return out;
  }


  /* ===== ⑤ SUPABASE 재고 (나중에 채울 곳 — 지금은 비활성) ===============
     IMS의 재고를 읽어 위 ④와 "똑같은 형태"로 변환해서 돌려주면 끝.
     아래는 PostgREST(Supabase 자동 API) 예시. 테이블/컬럼명은 IMS 스키마에 맞춰 수정.

     기대 테이블 예시 (inventory):
       style(text) | color(text) | warehouse('SC'|'CA') | size('XS'..'3XL') | qty(int)
  ====================================================================== */
  async function _supabaseInventory(styleNo) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase 미설정: pacific-data.js 상단의 SUPABASE_URL / SUPABASE_ANON_KEY 를 채워주세요.');
    }
    // ↓ TODO: 테이블명(inventory)·컬럼명(style/color/warehouse/size/qty)을 IMS에 맞게 수정
    const url = `${SUPABASE_URL}/rest/v1/inventory`
              + `?style=eq.${encodeURIComponent(styleNo)}`
              + `&select=color,warehouse,size,qty`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    });
    if (!res.ok) throw new Error('재고 조회 실패: ' + res.status);
    const rows = await res.json();

    // rows(평면 행들) → { 색상: { SC:[...], CA:[...] } } 로 변환
    const sizeIndex = {}; SIZES.forEach((s, i) => sizeIndex[s.label] = i);
    const out = {};
    rows.forEach(r => {
      if (!out[r.color]) out[r.color] = { SC: Array(SIZES.length).fill(0), CA: Array(SIZES.length).fill(0) };
      const i = sizeIndex[r.size];
      if (i != null && (r.warehouse === 'SC' || r.warehouse === 'CA')) {
        out[r.color][r.warehouse][i] = r.qty || 0;
      }
    });
    return out;
  }


  /* ===== ⑥ 공개 API (화면이 쓰는 부분) ================================= */
  return {
    config: { sizes: SIZES, warehouses: WAREHOUSES, source: SOURCE },

    // 카탈로그 (지금은 mock 한 곳에서. 나중에 products 테이블로 확장 가능)
    getProduct: async function (styleNo) {
      return PRODUCTS[styleNo] || null;
    },

    // 재고 — SOURCE 스위치에 따라 mock / supabase 자동 선택
    getInventory: async function (styleNo) {
      return SOURCE === 'supabase'
        ? _supabaseInventory(styleNo)
        : _mockInventory(styleNo);
    }
  };
})();

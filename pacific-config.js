/* =====================================================================
   PACIFIC SPORTS — Supabase 연결 설정 (pacific-config.js)
   ---------------------------------------------------------------------
   여기 한 곳에만 URL/키를 둡니다. 나중에 키를 새로 발급받으면 이 파일만 고치면 돼요.
   이 키는 anon(공개) 키라 웹사이트에 넣어도 되는 종류입니다.
   (service_role / secret 키는 절대 여기 넣지 마세요.)
   ===================================================================== */
window.PACIFIC_CONFIG = {
  SUPABASE_URL: 'https://ypjnhhtfwyrwcjakjcgc.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwam5oaHRmd3lyd2NqYWtqY2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDMxOTAsImV4cCI6MjA4Nzc3OTE5MH0.ADl8rXCeu9Z0fLAYR0d1wxOOkvT30eo47ahpss9yJq8',
  IMAGE_BUCKET: 'product-images',

  /* ===== 체크아웃 (UPS 배송비 + Authorize.net 카드결제) ===== */
  // checkout-worker 배포 주소 (예: https://checkout.hjbae.workers.dev)
  CHECKOUT_WORKER: 'https://checkout.hjbae.workers.dev',
  // Authorize.net 공개 키 두 개 (Account → Settings → Security Settings)
  //  - API Login ID (공개되어도 되는 ID)
  //  - Manage Public Client Key 에서 발급한 Public Client Key
  ANET_API_LOGIN_ID: '',
  ANET_CLIENT_KEY: '',
  ANET_ENV: 'sandbox',          // 테스트 후 'production' 으로
  WEIGHT_PER_PC: 0.5            // 배송비 계산용 1장당 무게(lbs)
};

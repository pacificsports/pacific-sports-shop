PACIFIC SPORTS — 거래처 쇼핑몰 (디자인 시안)
================================================

[이게 뭐예요]
거래처(도매)용 쇼핑몰 화면 9개. 전부 작동하는 HTML 데모.
지금은 재고·가격·주문이 예시 데이터. 실제로 쓰려면 Supabase(IMS) 연결 필요.

[파일]
- index.html ............ 시작 페이지 (9개 화면 모아보는 데모 허브)
- epacific-timeless.html . 홈
- epacific-category.html . 제품 목록
- epacific-product.html .. 제품 상세 / 주문 그리드 (핵심: SC·CA 두 줄, 케이스 환산)
- epacific-cart.html ..... 장바구니 / 주문 확인
- epacific-orders.html ... 주문 내역 / 재주문 (수량·사이즈·스타일·창고 편집)
- epacific-shopbycolor.html  색상별 탐색
- epacific-login.html .... 로그인 / 도매 계정 가입
- epacific-account.html .. 내 계정
- epacific-invoice.html .. 주문 명세서 (프린트/PDF)

[배포 방법 — IMS 때와 동일]
1. GitHub에 새 레포 만들기 (예: pacific-sports-shop)
2. 이 폴더의 파일 전부 Add file → Upload files 로 올리고 Commit
3. Cloudflare → Compute → Workers & Pages → Create → Connect to Git → 이 레포 선택
   - Build command: (비움)
   - Build output directory: /
4. 배포되면 임시 주소(xxx.workers.dev)로 열림. index.html이 첫 화면.

[다음 단계 (나중에)]
2단계: IMS의 Supabase에서 재고 읽어와 주문 그리드에 표시
3단계: 거래처 로그인 (Supabase Auth)
4단계: 주문을 Supabase에 저장 (IMS에서 확인)
5단계: 결제 (Authorize.Net + CardPointe — 이미 보유)
6단계: 배송비 (UPS API)
최종: epacificsports.com 도메인을 이 사이트로 전환

[데이터 규칙 — IMS와 맞춰둠]
스타일번호(1368), 색상명(Navy), 창고코드(SC/CA), 사이즈(XS~3XL) — IMS와 동일하게 사용.
케이스: XS–2XL = 72 pcs, 3XL = 48 pcs. 낱장(PC) 주문도 허용 (MOQ 없음).

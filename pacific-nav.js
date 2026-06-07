/* =====================================================================
   PACIFIC SPORTS — 공용 네비게이션/장바구니 헬퍼 (pacific-nav.js)
   ---------------------------------------------------------------------
   모든 화면에서 동일하게 동작하도록 한 곳에 모음:
     • 헤더의 Cart 버튼 → 장바구니로 이동
     • Cart 뱃지(.cart-c) → localStorage 'pacific_cart' 의 실제 수량 표시
     • 비어있던 placeholder 링크(My Account/Order History/Logout 등) 연결
     • window.PacificCart.add(items) — 어느 화면에서나 장바구니에 담기
   장바구니 항목 형식: { style, styleName, color, wh, size, qty }
   ===================================================================== */
(function () {
  var CART_KEY = 'pacific_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function setCart(c) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {}
    refreshBadge();
  }
  function total() {
    return getCart().reduce(function (s, i) { return s + (parseInt(i.qty, 10) || 0); }, 0);
  }
  function refreshBadge() {
    var t = total();
    var els = document.querySelectorAll('.cart-c, #cartCount');
    for (var i = 0; i < els.length; i++) els[i].textContent = t;
  }
  function keyOf(i) { return [i.style, i.color, i.wh, i.size].join('|'); }

  function add(items) {
    if (!Array.isArray(items)) items = [items];
    var c = getCart();
    items.forEach(function (it) {
      if (!it || !(parseInt(it.qty, 10) > 0)) return;
      var ex = c.filter(function (x) { return keyOf(x) === keyOf(it); })[0];
      if (ex) ex.qty = (parseInt(ex.qty, 10) || 0) + (parseInt(it.qty, 10) || 0);
      else c.push({ style: it.style, styleName: it.styleName || '', color: it.color, wh: it.wh || 'SC', size: it.size, qty: parseInt(it.qty, 10) });
    });
    setCart(c);
    return total();
  }

  function logout() {
    try { localStorage.removeItem('pacific_user'); localStorage.removeItem('pacific_customer'); } catch (e) {}
    location.href = 'epacific-login.html';
  }

  // 비어있는 placeholder 링크(href="#")를 실제 페이지로 연결
  function wireLinks() {
    var map = {
      'my account': 'epacific-account.html',
      'order history': 'epacific-orders.html',
      'shop by color': 'epacific-shopbycolor.html',
      'home': 'epacific-timeless.html'
    };
    var as = document.querySelectorAll('a[href="#"]');
    for (var i = 0; i < as.length; i++) {
      var a = as[i], t = (a.textContent || '').trim().toLowerCase();
      if (map[t]) { a.setAttribute('href', map[t]); continue; }
      if (t === 'logout' || t === 'log out') {
        a.addEventListener('click', function (e) { e.preventDefault(); logout(); });
      }
    }
  }

  // 헤더의 Cart 버튼/링크 → 장바구니로 이동 (텍스트에 'cart' 포함)
  function wireCartButtons() {
    var els = document.querySelectorAll('button.primary, a.primary, [data-cart]');
    for (var i = 0; i < els.length; i++) {
      var b = els[i];
      if (b.getAttribute('data-cart-wired')) continue;
      if (/cart/i.test(b.textContent) || b.hasAttribute('data-cart')) {
        b.setAttribute('data-cart-wired', '1');
        b.style.cursor = 'pointer';
        b.addEventListener('click', function (e) { e.preventDefault(); location.href = 'epacific-cart.html'; });
      }
    }
  }

  window.PacificCart = { getCart: getCart, setCart: setCart, total: total, add: add, refresh: refreshBadge, logout: logout };

  // 로그인 상태면 헤더의 Login → Log out, Register → My Account 로 토글
  function getSession() {
    try { return JSON.parse(localStorage.getItem('pacific_user') || 'null'); } catch (e) { return null; }
  }
  function applyAuthState() {
    var s = getSession();
    var loggedIn = !!(s && s.token);
    if (!loggedIn) return;
    var as = document.querySelectorAll('a[href^="epacific-login.html"]');
    for (var i = 0; i < as.length; i++) {
      var a = as[i], href = a.getAttribute('href') || '';
      if (href.indexOf('pane=reg') > -1) {           // Register → My Account
        a.textContent = 'My Account';
        a.setAttribute('href', 'epacific-account.html');
      } else {                                        // Login → Log out
        a.textContent = 'Log out';
        a.setAttribute('href', '#');
        a.addEventListener('click', function (e) { e.preventDefault(); logout(); });
      }
    }
  }

  // ── 로그인 자동연장: 만료 10분 전부터 refresh_token으로 토큰 갱신 ──
  //    (epacific-login.html이 {token, refresh, expires_at, ...} 형태로 저장해 둠)
  var _refreshing = false;
  function refreshSession() {
    var s = getSession();
    if (!s || !s.token || !s.refresh || _refreshing) return;
    var cfg = window.PACIFIC_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    var exp = s.expires_at || 0;
    if (exp - Date.now() > 10 * 60 * 1000) return;   // 10분 이상 남았으면 그대로
    _refreshing = true;
    fetch(cfg.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      _refreshing = false;
      if (!d || !d.access_token) return;             // 갱신 실패 → 다음 기회에
      var cur = getSession() || s;
      cur.token = d.access_token;
      cur.refresh = d.refresh_token || cur.refresh;
      cur.expires_at = Date.now() + ((d.expires_in || 3600) * 1000);
      try { localStorage.setItem('pacific_user', JSON.stringify(cur)); } catch (e) {}
    }).catch(function () { _refreshing = false; });
  }

  function boot() { wireCartButtons(); wireLinks(); applyAuthState(); refreshBadge(); refreshSession(); setInterval(refreshSession, 5 * 60 * 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
/* v2026-06-06 price-system */

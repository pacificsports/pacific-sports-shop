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
      if (ex) { ex.qty = (parseInt(ex.qty, 10) || 0) + (parseInt(it.qty, 10) || 0); if (it.unit_price != null) ex.unit_price = Number(it.unit_price); }
      else c.push({ style: it.style, styleName: it.styleName || '', color: it.color, wh: it.wh || 'SC', size: it.size, qty: parseInt(it.qty, 10), unit_price: (it.unit_price != null ? Number(it.unit_price) : null) });
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
    var accs = document.querySelectorAll('a');
    for (var j = 0; j < accs.length; j++) {
      var la = accs[j];
      if ((la.textContent || '').trim().toLowerCase() !== 'my account') continue;
      var nxt = la.nextElementSibling;
      if (nxt && (nxt.textContent || '').trim().toLowerCase() === 'order history') continue;
      var oh = la.cloneNode(true);
      oh.textContent = 'Order History';
      oh.setAttribute('href', 'epacific-orders.html');
      if (la.parentNode) la.parentNode.insertBefore(oh, la.nextSibling);
    }
    // 직원(staff/owner)에게만 "Manage" 링크를 Log out 앞에 표시
    try {
      var _sess = JSON.parse(localStorage.getItem('pacific_user') || 'null');
      var _cfg = window.PACIFIC_CONFIG;
      if (_sess && _sess.token && _sess.userId && _cfg && !document.getElementById('nav-admin-link')) {
        fetch(_cfg.SUPABASE_URL + '/rest/v1/user_roles?select=role&user_id=eq.' + _sess.userId, {
          headers: { apikey: _cfg.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + _sess.token }
        }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
          if (!Array.isArray(rows) || !rows[0] || ['owner','accounting','sales','warehouse'].indexOf(rows[0].role) < 0) return;
          var logoutA = null, all = document.querySelectorAll('a');
          for (var k = 0; k < all.length; k++) {
            var tx = (all[k].textContent || '').trim().toLowerCase();
            if (tx === 'logout' || tx === 'log out') { logoutA = all[k]; break; }
          }
          if (!logoutA || document.getElementById('nav-admin-link')) return;
          var adm = document.createElement('a');
          adm.id = 'nav-admin-link';
          adm.href = 'admin-dashboard.html';
          adm.textContent = 'Settings';
          adm.className = logoutA.className;
          adm.style.cssText = logoutA.style.cssText;
          logoutA.parentNode.insertBefore(adm, logoutA);
        }).catch(function () {});
      }
    } catch (e) {}

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
      if (href.indexOf('pane=reg') > -1) { // Register → My Account
        a.textContent = 'My Account';
        a.setAttribute('href', 'epacific-account.html');
      } else { // Login → Log out
        a.textContent = 'Log out';
        a.setAttribute('href', '#');
        a.addEventListener('click', function (e) { e.preventDefault(); logout(); });
      }
    }
  }

  // ── 로그인 자동연장: 만료 10분 전부터 refresh_token으로 토큰 갱신 ──
  // (epacific-login.html이 {token, refresh, expires_at, ...} 형태로 저장해 둠)
  var _refreshing = false;
  function refreshSession() {
    var s = getSession();
    if (!s || !s.token || !s.refresh || _refreshing) return;
    var cfg = window.PACIFIC_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    var exp = s.expires_at || 0;
    if (exp - Date.now() > 10 * 60 * 1000) return; // 10분 이상 남았으면 그대로
    _refreshing = true;
    fetch(cfg.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      _refreshing = false;
      if (!d || !d.access_token) return; // 갱신 실패 → 다음 기회에
      var cur = getSession() || s;
      cur.token = d.access_token;
      cur.refresh = d.refresh_token || cur.refresh;
      cur.expires_at = Date.now() + ((d.expires_in || 3600) * 1000);
      try { localStorage.setItem('pacific_user', JSON.stringify(cur)); } catch (e) {}
    }).catch(function () { _refreshing = false; });
  }


  /* ═══ ★ My Styles — 거래처별 즐겨찾기 (2026-08-29) ═══════════════════
     거래처가 자주 쓰는 스타일을 저장해두고 헤더 바로 아래 줄에서 한 번에 간다.
     · 저장 단위는 스타일 하나 (색은 저장하지 않는다 — 칩이 금방 길어진다)
     · 저장 위치는 customer_favorites 테이블. RLS 로 본인 것만 보인다 →
       폰에서 저장해도 사무실 PC 에서 보이고, 다른 거래처 것은 절대 안 보인다
     · 테이블이 아직 없거나(=SQL 미실행) 로그인 전이면 바도 ★ 도 아예 안 뜬다 */
  var FAV_URL = null, _favCache = null, _favDead = false;
  function favCfg() {
    var c = window.PACIFIC_CONFIG || {};
    if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return null;
    if (!FAV_URL) FAV_URL = c.SUPABASE_URL + '/rest/v1/customer_favorites';
    return c;
  }
  function favH(extra) {
    var c = favCfg(), s = getSession();
    if (!c || !s || !s.token) return null;
    var h = { apikey: c.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + s.token };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function favList() {
    if (_favDead) return Promise.resolve([]);
    var h = favH();
    if (!h) return Promise.resolve([]);
    if (_favCache) return Promise.resolve(_favCache);
    return fetch(FAV_URL + '?select=style_number,sort_order&order=sort_order.asc,created_at.asc', { headers: h })
      .then(function (r) {
        if (r.status === 404 || r.status === 401 || r.status === 403) { _favDead = true; return []; }
        return r.ok ? r.json() : [];
      })
      .then(function (rows) { _favCache = Array.isArray(rows) ? rows : []; return _favCache; })
      .catch(function () { return []; });
  }
  function favHas(style) {
    return favList().then(function (rows) {
      return rows.some(function (r) { return String(r.style_number) === String(style); });
    });
  }
  function favAdd(style) {
    var h = favH({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' });
    if (!h) return Promise.resolve(false);
    return fetch(FAV_URL + '?on_conflict=user_id,style_number', {
      method: 'POST', headers: h,
      body: JSON.stringify([{ style_number: String(style), sort_order: Date.now() % 100000 }])
    }).then(function (r) { if (r.ok) { _favCache = null; renderFavBar(); } return r.ok; })
      .catch(function () { return false; });
  }
  function favRemove(style) {
    var h = favH({ Prefer: 'return=minimal' });
    if (!h) return Promise.resolve(false);
    return fetch(FAV_URL + '?style_number=eq.' + encodeURIComponent(style), { method: 'DELETE', headers: h })
      .then(function (r) { if (r.ok) { _favCache = null; renderFavBar(); } return r.ok; })
      .catch(function () { return false; });
  }
  function favToggle(style) {
    return favHas(style).then(function (on) { return (on ? favRemove(style) : favAdd(style)).then(function () { return !on; }); });
  }

  /* 드래그로 바꾼 순서를 저장한다. 화면은 이미 바뀌어 있으므로 실패해도 조용히 두고,
     다음에 페이지를 열면 서버 순서로 돌아온다 (틀린 순서가 남는 것보다 낫다) */
  function favSaveOrder(order) {
    var h = favH({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' });
    if (!h) return Promise.resolve(false);
    var rows = order.map(function (n, i) { return { style_number: String(n), sort_order: i }; });
    _favCache = rows.map(function (r) { return { style_number: r.style_number, sort_order: r.sort_order }; });
    return fetch(FAV_URL + '?on_conflict=user_id,style_number', {
      method: 'POST', headers: h, body: JSON.stringify(rows)
    }).then(function (r) { if (!r.ok) _favCache = null; return r.ok; })
      .catch(function () { _favCache = null; return false; });
  }

  /* 스타일 번호 → 아주 짧은 꼬리표.
     원래는 설명 전체를 붙였는데 ("16/1 100% Cotton Heavyweight Short Sleeve")
     10개만 저장해도 줄이 넘쳐서 잘렸다. 칩에서 사람을 구분하는 건 결국 번호이므로
     번호를 크게 두고 옷 종류만 한두 글자 붙인다. 전체 이름은 마우스 올리면 나온다. */
  function favShort(cat) {
    // 카테고리를 그대로 쓴다. 'Hoodie' 로만 줄였더니 후드 티인지 후드 집업인지
    // 헷갈린다고 해서, 'Hoodie L/S' 처럼 소매까지 붙인다.
    var c = String(cat || '').trim();
    if (/Performance/i.test(c)) c = c.replace(/Performance/i, 'Outdoor');
    // Adult 는 기본이라 뗀다. Youth·Kids·Juvy·Toddler 는 남겨야 구분이 된다.
    return c.replace(/^Adult\s+/i, '').trim();
  }
  function favNames(nos) {
    if (!window.PacificData || !PacificData.getStyles || !nos.length) return Promise.resolve({});
    return PacificData.getStyles().then(function (list) {
      var m = {};
      (list || []).forEach(function (s) {
        if (nos.indexOf(String(s.no)) < 0) return;
        m[String(s.no)] = { s: favShort(s.cat), full: String(s.desc || '') };
      });
      return m;
    }).catch(function () { return {}; });
  }

  function favBarCss() {
    if (document.getElementById('favbar-css')) return;
    var st = document.createElement('style');
    st.id = 'favbar-css';
    st.textContent =
      '#favbar{border-bottom:1px solid #e8e7e1;background:#fbfbf9}' +
      '#favbar .in{max-width:1240px;margin:0 auto;padding:6px 30px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}' +
      '#favbar .lbl{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#8e8e85;flex:none}' +
      '#favbar a.fc{flex:none;display:inline-flex;align-items:baseline;gap:6px;padding:4px 11px;border:1px solid #e3e2db;border-radius:99px;' +
        'background:#fff;text-decoration:none;color:#1c1c1a;font-size:12.5px;line-height:1.5;white-space:nowrap}' +
      '#favbar a.fc:hover{border-color:#3d5a40;color:#3d5a40}' +
      '#favbar a.fc .no{font-weight:700}' +
      '#favbar a.fc .nm{color:#8e8e85;font-size:11.5px}' +
      '#favbar a.fc:hover .nm{color:#3d5a40}' +
      '#favbar a.fc{cursor:grab;user-select:none}' +
      '#favbar a.fc.dragging{opacity:.4}' +
      '#favbar a.fc.ins-l{box-shadow:-3px 0 0 -1px #3d5a40}' +
      '#favbar a.fc.ins-r{box-shadow:3px 0 0 -1px #3d5a40}';
    document.head.appendChild(st);
  }

  /* 칩 드래그로 순서 바꾸기 (2026-08-29).
     거래처마다 자주 쓰는 순서가 다르다 — 제일 많이 시키는 걸 왼쪽에 두게 한다.
     드래그가 끝난 직후의 click 은 무시한다. 안 그러면 놓자마자 그 스타일로 넘어가버린다. */
  var _favDragNo = null, _favJustDragged = false;
  function favWireDrag(bar) {
    var chips = bar.querySelectorAll('a.fc');
    function order() {
      return Array.prototype.map.call(bar.querySelectorAll('a.fc'), function (c) { return c.getAttribute('data-no'); });
    }
    Array.prototype.forEach.call(chips, function (c) {
      c.addEventListener('dragstart', function (e) {
        _favDragNo = c.getAttribute('data-no');
        c.classList.add('dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', _favDragNo); } catch (_) {}
      });
      c.addEventListener('dragend', function () {
        c.classList.remove('dragging');
        Array.prototype.forEach.call(bar.querySelectorAll('a.fc'), function (x) { x.classList.remove('ins-l', 'ins-r'); });
        _favDragNo = null;
      });
      c.addEventListener('dragover', function (e) {
        if (!_favDragNo || _favDragNo === c.getAttribute('data-no')) return;
        e.preventDefault();
        var r = c.getBoundingClientRect();
        var after = (e.clientX - r.left) > r.width / 2;
        c._after = after;
        c.classList.toggle('ins-r', after);
        c.classList.toggle('ins-l', !after);
      });
      c.addEventListener('dragleave', function () { c.classList.remove('ins-l', 'ins-r'); });
      c.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation();
        var from = _favDragNo, to = c.getAttribute('data-no');
        c.classList.remove('ins-l', 'ins-r');
        if (!from || from === to) return;
        var arr = order();
        var fi = arr.indexOf(from);
        if (fi > -1) arr.splice(fi, 1);
        var ti = arr.indexOf(to);
        arr.splice(c._after ? ti + 1 : ti, 0, from);
        _favJustDragged = true;
        setTimeout(function () { _favJustDragged = false; }, 250);
        favSaveOrder(arr).then(function () { _favCache = null; renderFavBar(); });
      });
      c.addEventListener('click', function (e) { if (_favJustDragged) { e.preventDefault(); } });
    });
  }

  function renderFavBar() {
    var hd = document.querySelector('header');
    if (!hd) return;
    favList().then(function (rows) {
      var bar = document.getElementById('favbar');
      if (!rows.length) { if (bar) bar.remove(); return; }
      var nos = rows.map(function (r) { return String(r.style_number); });
      favNames(nos).then(function (nm) {
        favBarCss();
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'favbar';
          hd.parentNode.insertBefore(bar, hd.nextSibling);
        }
        bar.innerHTML = '<div class="in"><span class="lbl">★ My Styles</span>' +
          nos.map(function (n) {
            var e = nm[n] || {};
            var t = e.s ? '<span class="nm">' + String(e.s).replace(/</g, '&lt;') + '</span>' : '';
            var ti = e.full ? ' title="' + String(e.full).replace(/"/g, '&quot;') + '"' : '';
            return '<a class="fc" draggable="true" data-no="' + n + '" href="epacific-product.html?style=' + encodeURIComponent(n) + '"' + ti + '>' +
                   '<span class="no">#' + n + '</span>' + t + '</a>';
          }).join('') + '</div>';
        favWireDrag(bar);
      });
    });
  }

  window.PacificFav = { list: favList, has: favHas, add: favAdd, remove: favRemove, toggle: favToggle, render: renderFavBar,
                        available: function () { return !!favH() && !_favDead; } };

  function boot() { wireCartButtons(); wireLinks(); applyAuthState(); refreshBadge(); refreshSession(); renderFavBar(); setInterval(refreshSession, 5 * 60 * 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
/* v2026-06-06 price-system */

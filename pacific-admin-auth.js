/* =====================================================================
   PACIFIC SPORTS — 관리자 인증 (pacific-admin-auth.js) · PIN 방식
   ---------------------------------------------------------------------
   IMS와 같은 4자리 PIN(employees.pin)으로 로그인.
   PIN은 절대 클라이언트로 노출되지 않음 — Supabase 함수 verify_admin_pin()이
   "맞는지만" 확인해서 이름/역할만 돌려줌. active한 admin/supervisor만 통과.
   ===================================================================== */
window.PacificAuth = (function () {
  const CFG = window.PACIFIC_CONFIG || {};
  const URL = CFG.SUPABASE_URL, KEY = CFG.SUPABASE_ANON_KEY;
  const SS_KEY = 'pacific_admin_session';

  function _save(s){ try{ sessionStorage.setItem(SS_KEY, JSON.stringify(s)); }catch(e){} }
  function _get(){ try{ return JSON.parse(sessionStorage.getItem(SS_KEY)||'null'); }catch(e){ return null; } }
  function _clear(){ try{ sessionStorage.removeItem(SS_KEY); }catch(e){} }

  // PIN 로그인 — verify_admin_pin 함수 호출 (PIN은 서버에서만 비교)
  async function login(pin){
    pin = String(pin || '').trim();
    if(!/^\d{4}$/.test(pin)) throw new Error('PIN은 4자리 숫자예요.');
    const r = await fetch(URL + '/rest/v1/rpc/verify_admin_pin', {
      method:'POST',
      headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' },
      body: JSON.stringify({ input_pin: pin })
    });
    if(!r.ok) throw new Error('확인 실패: ' + r.status);
    const rows = await r.json();
    if(!rows || !rows.length) throw new Error('PIN이 맞지 않거나 권한이 없어요.');
    const session = { name: rows[0].name, role: rows[0].role, ts: Date.now() };
    _save(session);
    return session;
  }

  async function currentUser(){ return _get(); }

  async function requireAdmin(loginPage){
    const s = _get();
    if(!s){ location.href = (loginPage||'admin-login.html') + '?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; }
    return s;
  }

  function logout(){ _clear(); }
  function authHeaders(){ return { apikey:KEY, Authorization:'Bearer '+KEY }; }

  return { login, currentUser, requireAdmin, logout, authHeaders };
})();

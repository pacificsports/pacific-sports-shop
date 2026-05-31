/* =====================================================================
   PACIFIC SPORTS — 관리자 인증 (pacific-admin-auth.js)
   ---------------------------------------------------------------------
   IMS와 같은 Supabase Auth(이메일+비밀번호)로 로그인.
   권한은 user_roles.role 로 판단. 허용 role: owner / accounting / sales.
   (warehouse 제외)

   사용:
     await PacificAuth.login(email, password)   // 로그인
     await PacificAuth.currentUser()            // {user, role} 또는 null
     await PacificAuth.requireAdmin()           // 관리자 아니면 로그인페이지로
     PacificAuth.logout()
   ===================================================================== */
window.PacificAuth = (function () {
  const CFG = window.PACIFIC_CONFIG || {};
  const URL = CFG.SUPABASE_URL, KEY = CFG.SUPABASE_ANON_KEY;
  const ADMIN_ROLES = ['owner', 'accounting', 'sales'];   // 관리자 허용 직급
  const SS_KEY = 'pacific_admin_session';

  function _saveSession(s){ try{ sessionStorage.setItem(SS_KEY, JSON.stringify(s)); }catch(e){} }
  function _getSession(){ try{ return JSON.parse(sessionStorage.getItem(SS_KEY)||'null'); }catch(e){ return null; } }
  function _clear(){ try{ sessionStorage.removeItem(SS_KEY); }catch(e){} }

  // 로그인: Supabase Auth 로 토큰 받기
  async function login(email, password){
    const r = await fetch(URL + '/auth/v1/token?grant_type=password', {
      method:'POST',
      headers:{ apikey:KEY, 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error_description || data.msg || '로그인 실패');
    const token = data.access_token;
    const userId = data.user && data.user.id;
    const userEmail = data.user && data.user.email;

    // 이 사람의 권한(role) 확인 — 본인 토큰으로 user_roles 조회
    const role = await _fetchRole(token, userId);
    if(!role || !ADMIN_ROLES.includes(role)){
      _clear();
      throw new Error('이 계정은 쇼핑몰 관리자 권한이 없어요. (현재 권한: ' + (role||'없음') + ')');
    }
    const session = { token, userId, email:userEmail, role, ts:Date.now() };
    _saveSession(session);
    return session;
  }

  async function _fetchRole(token, userId){
    const r = await fetch(URL + '/rest/v1/user_roles?user_id=eq.' + userId + '&select=role',
      { headers:{ apikey:KEY, Authorization:'Bearer '+token } });
    if(!r.ok) return null;
    const rows = await r.json();
    return rows[0] && rows[0].role;
  }

  // 현재 로그인 상태 (세션 + 토큰 유효성 가볍게 확인)
  async function currentUser(){
    const s = _getSession();
    if(!s || !s.token) return null;
    return s;
  }

  // 관리자 전용 페이지 가드: 아니면 로그인 화면으로 보냄
  async function requireAdmin(loginPage){
    const s = await currentUser();
    if(!s){ location.href = (loginPage||'admin-login.html') + '?next=' + encodeURIComponent(location.pathname.split('/').pop()); return null; }
    return s;
  }

  function logout(){ _clear(); }

  // 로그인된 토큰으로 인증 헤더 만들기 (관리 작업에 사용)
  function authHeaders(){
    const s = _getSession();
    return s && s.token
      ? { apikey:KEY, Authorization:'Bearer '+s.token }
      : { apikey:KEY, Authorization:'Bearer '+KEY };
  }

  return { login, currentUser, requireAdmin, logout, authHeaders, ADMIN_ROLES };
})();

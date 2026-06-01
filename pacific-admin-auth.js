/* =====================================================================
   PACIFIC SPORTS — 직원 권한 (pacific-admin-auth.js) · 이메일 로그인 기반
   ---------------------------------------------------------------------
   로그인은 epacific-login.html에서 이메일+비밀번호(Supabase Auth)로 함.
   여기서는 "지금 로그인한 사람이 수정 권한 있는 직원인지"만 판단.
   허용 role(user_roles): owner / accounting / sales.

   세션은 sessionStorage 'pacific_user' 에 저장됨 (로그인 화면이 저장):
     { token, userId, email }
   여기에 role 을 확인해서 staff 여부를 알려줌.
   ===================================================================== */
window.PacificAuth = (function () {
  const CFG = window.PACIFIC_CONFIG || {};
  const URL = CFG.SUPABASE_URL, KEY = CFG.SUPABASE_ANON_KEY;
  const STAFF_ROLES = ['owner', 'accounting', 'sales'];
  const SS_KEY = 'pacific_user';

  function _session(){ try{ return JSON.parse(sessionStorage.getItem(SS_KEY)||'null'); }catch(e){ return null; } }
  function logout(){ try{ sessionStorage.removeItem(SS_KEY); }catch(e){} }

  // 로그인한 사용자의 role 조회 (본인 토큰으로 user_roles)
  async function _fetchRole(s){
    if(!s || !s.userId || !s.token) return null;
    try{
      const r = await fetch(URL + '/rest/v1/user_roles?user_id=eq.' + s.userId + '&select=role,full_name',
        { headers:{ apikey:KEY, Authorization:'Bearer '+s.token } });
      if(!r.ok) return null;
      const rows = await r.json();
      return rows[0] || null;
    }catch(e){ return null; }
  }

  // 현재 로그인 사용자 (로그인 안 했으면 null)
  async function currentUser(){
    const s = _session();
    if(!s) return null;
    return s;
  }

  // 수정 권한 있는 직원인지 확인 → {email, role, name} 또는 null
  async function currentStaff(){
    const s = _session();
    if(!s) return null;
    const roleRow = await _fetchRole(s);
    if(!roleRow || !STAFF_ROLES.includes(roleRow.role)) return null;
    return { email:s.email, role:roleRow.role, name:roleRow.full_name || s.email, token:s.token, userId:s.userId };
  }

  return { currentUser, currentStaff, logout, STAFF_ROLES };
})();

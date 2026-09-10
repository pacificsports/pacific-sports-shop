/* =====================================================================
   PACIFIC SPORTS — 직원 권한 (pacific-admin-auth.js) · 이메일 로그인 기반
   ---------------------------------------------------------------------
   로그인은 epacific-login.html에서 이메일+비밀번호(Supabase Auth)로 함.
   여기서는 "지금 로그인한 사람이 수정 권한 있는 직원인지"만 판단.
   허용 role(user_roles): owner / accounting / sales.

   세션은 localStorage 'pacific_user' 에 저장됨 (로그인 화면이 저장):
     { token, userId, email }
   여기에 role 을 확인해서 staff 여부를 알려줌.
   ===================================================================== */
window.PacificAuth = (function () {
  const CFG = window.PACIFIC_CONFIG || {};
  const URL = CFG.SUPABASE_URL, KEY = CFG.SUPABASE_ANON_KEY;
  const STAFF_ROLES = ['owner', 'accounting', 'sales', 'warehouse'];
  const SS_KEY = 'pacific_user';

  function _session(){ try{ return JSON.parse(localStorage.getItem(SS_KEY)||'null'); }catch(e){ return null; } }
  function logout(){ try{ localStorage.removeItem(SS_KEY); }catch(e){} }

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

/* =====================================================================
   ⚠ 예전에는 여기서 admin-*.html 모든 화면에 '← Dashboard' 링크를 자동으로 꽂았다.
   웹 대시보드는 이제 안 쓴다 — 매출 분석·웹주문·가입승인·웹가격·재고업로드는 전부
   psflowx 로 갔고, 웹사이트에 남는 건 **사진**과 **스타일 수정** 둘뿐이다.
   (게다가 Cloudflare Pages 가 주소에서 `.html` 을 떼기 때문에 `p === 'admin-dashboard.html'`
    제외 조건이 안 먹혀서, 대시보드가 **자기 자신을 가리키는** 링크까지 달고 있었다.)
   그래서 이 자동 삽입을 통째로 없앴다. 각 화면은 '← Back to site' 로 홈에 돌아가고,
   홈의 직원 바에서 다시 들어간다.
   ===================================================================== */

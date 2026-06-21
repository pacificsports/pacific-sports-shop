/* =====================================================================
   PACIFIC SPORTS — Staff Admin Worker  (staff-admin-worker.js)
   ---------------------------------------------------------------------
   웹사이트(쇼핑몰) 직원 계정 생성/관리 전용 워커.  IMS 와는 완전 별개입니다.

   ⚠️  이 워커는 Supabase SERVICE_ROLE 키(=DB 전권)를 사용합니다.
       그래서 결제 워커 등과 절대 섞지 말고 "이 워커에만" 둡니다.

   배포 방법 (Cloudflare):
     1) Workers & Pages → Create → 이 파일 내용을 붙여넣기 (워커 이름 예: staff-admin)
     2) Settings → Variables and Secrets 에서 아래 2개 추가
          SUPABASE_URL                = https://ypjnhhtfwyrwcjakjcgc.supabase.co   (일반 변수)
          SUPABASE_SERVICE_ROLE_KEY   = (Supabase → Project Settings → API →
                                         "service_role"  secret 키)   ← Secret 으로!
     3) 배포된 주소(예: https://staff-admin.hjbae.workers.dev)를
          pacific-config.js 의  STAFF_WORKER 에 넣기

   엔드포인트 (전부 POST, JSON):  호출자는 반드시 owner 여야 함
     /staff/list     → 직원 목록
     /staff/create   → { email, full_name, role }  → 계정+역할 생성, 임시비번 1회 반환
     /staff/role     → { user_id, role }            → 역할 변경
     /staff/remove   → { user_id }                  → 직원 권한 회수(역할 행 삭제)
   ===================================================================== */

const STAFF_ROLES = ['owner', 'accounting', 'sales', 'warehouse'];

// CORS: 쇼핑몰 출처만 허용
function corsHeaders(origin) {
  let ok = false;
  try {
    const h = new URL(origin).hostname;
    ok = /\.pages\.dev$/.test(h) || /peacepacificsports\.com$/.test(h) || /pacificsports/.test(h);
  } catch (e) {
    ok = false;
  }
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://pacific-sports-shop.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// 강한 임시 비밀번호 생성 (대/소문자+숫자+기호, 14자)
function tempPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '!@#$%*?'];
  const all = sets.join('');
  const rnd = (n) => {
    const a = new Uint32Array(n);
    crypto.getRandomValues(a);
    return a;
  };
  let out = [];
  const r0 = rnd(4);
  sets.forEach((s, i) => out.push(s[r0[i] % s.length])); // 종류별 최소 1개
  const r1 = rnd(10);
  for (let i = 0; i < 10; i++) out.push(all[r1[i] % all.length]);
  const r2 = rnd(out.length); // 셔플
  for (let i = out.length - 1; i > 0; i--) {
    const j = r2[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

async function sb(env, path, init) {
  return fetch(env.SUPABASE_URL + path, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
}

// 호출자 토큰 → 사용자 → owner 인지 확인. owner 면 caller 객체, 아니면 null
async function requireOwner(req, env) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const ur = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + token },
  });
  if (!ur.ok) return null;
  const user = await ur.json();
  if (!user || !user.id) return null;
  const rr = await sb(
    env,
    '/rest/v1/user_roles?select=role,full_name&user_id=eq.' + encodeURIComponent(user.id),
    { method: 'GET' }
  );
  if (!rr.ok) return null;
  const rows = await rr.json();
  if (!Array.isArray(rows) || !rows[0] || rows[0].role !== 'owner') return null;
  return { id: user.id, email: user.email, role: rows[0].role };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (req.method !== 'POST') return json({ error: 'method' }, 405, origin);
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
      return json({ error: 'worker not configured (SUPABASE_URL / SERVICE_ROLE_KEY)' }, 500, origin);

    const caller = await requireOwner(req, env);
    if (!caller) return json({ error: 'forbidden (owner only)' }, 403, origin);

    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    // ---- 목록 ----
    if (path.endsWith('/staff/list')) {
      const r = await sb(
        env,
        '/rest/v1/user_roles?select=id,user_id,email,role,full_name,created_at&order=created_at.asc',
        { method: 'GET' }
      );
      const rows = await r.json();
      return json({ ok: true, staff: rows }, 200, origin);
    }

    // ---- 생성 ----
    if (path.endsWith('/staff/create')) {
      const email = String(body.email || '').trim().toLowerCase();
      const full_name = String(body.full_name || '').trim();
      const role = String(body.role || '').trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json({ error: '올바른 이메일을 입력하세요.' }, 400, origin);
      if (!full_name) return json({ error: '이름을 입력하세요.' }, 400, origin);
      if (!STAFF_ROLES.includes(role)) return json({ error: '역할이 올바르지 않습니다.' }, 400, origin);

      const exist = await sb(
        env,
        '/rest/v1/user_roles?select=id&email=eq.' + encodeURIComponent(email),
        { method: 'GET' }
      );
      const exRows = await exist.json();
      if (Array.isArray(exRows) && exRows.length)
        return json({ error: '이미 직원으로 등록된 이메일입니다.' }, 409, origin);

      const password = tempPassword();
      const cr = await sb(env, '/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
      });
      const created = await cr.json();
      if (!cr.ok || !created || !created.id) {
        const msg =
          (created && (created.msg || created.message || created.error_description || created.error)) ||
          '계정 생성 실패';
        return json({ error: msg }, cr.status === 422 ? 409 : 500, origin);
      }
      const userId = created.id;

      const ir = await sb(env, '/rest/v1/user_roles', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ user_id: userId, email, role, full_name }),
      });
      if (!ir.ok) {
        await sb(env, '/auth/v1/admin/users/' + userId, { method: 'DELETE' }).catch(() => {});
        const t = await ir.text();
        return json({ error: '역할 부여 실패: ' + t.slice(0, 200) }, 500, origin);
      }

      return json(
        { ok: true, user_id: userId, email, role, full_name, temp_password: password },
        200,
        origin
      );
    }

    // ---- 역할 변경 ----
    if (path.endsWith('/staff/role')) {
      const user_id = String(body.user_id || '');
      const role = String(body.role || '');
      if (!user_id) return json({ error: 'user_id 필요' }, 400, origin);
      if (!STAFF_ROLES.includes(role)) return json({ error: '역할이 올바르지 않습니다.' }, 400, origin);
      if (user_id === caller.id && role !== 'owner')
        return json({ error: '본인의 owner 권한은 스스로 변경할 수 없습니다.' }, 400, origin);
      const r = await sb(env, '/rest/v1/user_roles?user_id=eq.' + encodeURIComponent(user_id), {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) return json({ error: '변경 실패' }, 500, origin);
      const rows = await r.json();
      return json({ ok: true, updated: rows }, 200, origin);
    }

    // ---- 권한 회수(직원 행 삭제) ----
    if (path.endsWith('/staff/remove')) {
      const user_id = String(body.user_id || '');
      if (!user_id) return json({ error: 'user_id 필요' }, 400, origin);
      if (user_id === caller.id)
        return json({ error: '본인 계정은 스스로 삭제할 수 없습니다.' }, 400, origin);
      const r = await sb(env, '/rest/v1/user_roles?user_id=eq.' + encodeURIComponent(user_id), {
        method: 'DELETE',
      });
      if (!r.ok) return json({ error: '삭제 실패' }, 500, origin);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: 'unknown endpoint' }, 404, origin);
  },
};

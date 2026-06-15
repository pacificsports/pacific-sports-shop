/* =====================================================================
   PACIFIC SPORTS — 체크아웃 워커 (checkout-worker.js)
   ---------------------------------------------------------------------
   Cloudflare Worker 하나로 두 가지를 처리합니다:
     POST /rates : UPS 실시간 배송비 (Ground / 3 Day Select / 2nd Day / Next Day)
                   SC·CA 두 창고에서 나눠 보내는 주문은 각각 계산해서 합산
     POST /pay   : Authorize.net 카드 결제 (Accept.js 토큰 → 실제 청구)

   ── Cloudflare 대시보드 → Worker → Settings → Variables 에 넣을 값 ──
   UPS_CLIENT_ID        UPS developer 앱 Client ID
   UPS_CLIENT_SECRET    UPS developer 앱 Client Secret        (Encrypt 권장)
   UPS_ACCOUNT          UPS 계정번호 (6자리, 협상요율 적용용)
   UPS_ENV              'test' 또는 'production'
   ANET_API_LOGIN_ID    Authorize.net API Login ID
   ANET_TRANSACTION_KEY Authorize.net Transaction Key          (Encrypt 권장)
   ANET_ENV             'sandbox' 또는 'production'
   ===================================================================== */

const ORIGINS = {
  SC: { name: 'Pacific Sports SC', addr: '1605 South Guignard Parkway', city: 'Sumter',   state: 'SC', zip: '29150' },
  CA: { name: 'Pacific Sports CA', addr: '14129 The Merge Street Unit B', city: 'Eastvale', state: 'CA', zip: '92880' }
};
// 보여줄 UPS 서비스 (코드는 UPS 표준)
const SERVICES = [
  { code: '03', name: 'UPS Ground' },
  { code: '12', name: 'UPS 3 Day Select' },
  { code: '02', name: 'UPS 2nd Day Air' },
  { code: '01', name: 'UPS Next Day Air' }
];
const MAX_BOX_LBS = 40;   // 한 박스 최대 무게 (이걸 넘으면 여러 박스로 나눠 계산)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return J({ error: 'POST only' }, 405);
    const url = new URL(req.url);
    try {
      if (url.pathname.endsWith('/rates')) return await rates(await req.json(), env);
      if (url.pathname.endsWith('/pay'))   return await pay(await req.json(), env);
      if (url.pathname.endsWith('/refund')) return await refund(await req.json(), env);
      return J({ error: 'unknown endpoint' }, 404);
    } catch (e) {
      return J({ error: String(e.message || e).slice(0, 300) }, 500);
    }
  }
};

/* ───────────────────────── UPS 배송비 ───────────────────────── */
let _upsTok = null, _upsTokExp = 0;
async function upsToken(env) {
  if (_upsTok && Date.now() < _upsTokExp - 60000) return _upsTok;
  const base = env.UPS_ENV === 'production' ? 'https://onlinetools.ups.com' : 'https://wwwcie.ups.com';
  const r = await fetch(base + '/security/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(env.UPS_CLIENT_ID + ':' + env.UPS_CLIENT_SECRET)
    },
    body: 'grant_type=client_credentials'
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('UPS 인증 실패: ' + JSON.stringify(d).slice(0, 200));
  _upsTok = d.access_token;
  _upsTokExp = Date.now() + (parseInt(d.expires_in || '3600', 10) * 1000);
  return _upsTok;
}

// 무게(lbs)를 MAX_BOX_LBS 단위 박스들로 분할
function boxes(lbs) {
  const out = [];
  let left = Math.max(1, Math.ceil(lbs));
  while (left > 0) { const w = Math.min(left, MAX_BOX_LBS); out.push(w); left -= w; }
  return out;
}

async function upsShop(env, origin, shipTo, lbs) {
  const base = env.UPS_ENV === 'production' ? 'https://onlinetools.ups.com' : 'https://wwwcie.ups.com';
  const tok = await upsToken(env);
  const body = {
    RateRequest: {
      Request: { TransactionReference: { CustomerContext: 'pacific-shop' } },
      Shipment: {
        Shipper: {
          Name: origin.name, ShipperNumber: env.UPS_ACCOUNT || undefined,
          Address: { AddressLine: [origin.addr], City: origin.city, StateProvinceCode: origin.state, PostalCode: origin.zip, CountryCode: 'US' }
        },
        ShipFrom: { Name: origin.name, Address: { AddressLine: [origin.addr], City: origin.city, StateProvinceCode: origin.state, PostalCode: origin.zip, CountryCode: 'US' } },
        ShipTo: {
          Name: (shipTo.name || 'Customer').slice(0, 35),
          Address: {
            AddressLine: [shipTo.addr1, shipTo.addr2].filter(Boolean),
            City: shipTo.city, StateProvinceCode: shipTo.state, PostalCode: shipTo.zip, CountryCode: 'US',
            ResidentialAddressIndicator: shipTo.residential ? '' : undefined
          }
        },
        ShipmentRatingOptions: env.UPS_ACCOUNT ? { NegotiatedRatesIndicator: '' } : undefined,
        Package: boxes(lbs).map(w => ({
          PackagingType: { Code: '02' },
          PackageWeight: { UnitOfMeasurement: { Code: 'LBS' }, Weight: String(w) }
        }))
      }
    }
  };
  const r = await fetch(base + '/api/rating/v2409/Shop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) {
    const msg = d?.response?.errors?.map(e => e.message).join('; ') || JSON.stringify(d).slice(0, 200);
    throw new Error('UPS 요율 실패(' + origin.state + '): ' + msg);
  }
  const rated = d?.RateResponse?.RatedShipment || [];
  const list = Array.isArray(rated) ? rated : [rated];
  const out = {};
  list.forEach(s => {
    const code = s?.Service?.Code;
    // 협상요율 있으면 그걸, 없으면 공시요율
    const v = s?.NegotiatedRateCharges?.TotalCharge?.MonetaryValue || s?.TotalCharges?.MonetaryValue;
    if (code && v != null) out[code] = parseFloat(v);
  });
  return out;
}

async function rates(body, env) {
  const { shipTo, scLbs, caLbs } = body || {};
  if (!shipTo || !shipTo.zip || !shipTo.state || !shipTo.city) return J({ error: '배송지 주소가 필요합니다' }, 400);
  if (!(scLbs > 0) && !(caLbs > 0)) return J({ error: '무게가 없습니다' }, 400);
  const parts = [];
  if (scLbs > 0) parts.push(upsShop(env, ORIGINS.SC, shipTo, scLbs));
  if (caLbs > 0) parts.push(upsShop(env, ORIGINS.CA, shipTo, caLbs));
  const results = await Promise.all(parts);
  // 두 창고에서 나가면 서비스별로 합산 (둘 다 그 서비스가 있어야 옵션 제공)
  const services = SERVICES.map(svc => {
    let total = 0, ok = true;
    results.forEach(rm => { if (rm[svc.code] == null) ok = false; else total += rm[svc.code]; });
    return ok ? { code: svc.code, name: svc.name, total: Math.round(total * 100) / 100 } : null;
  }).filter(Boolean);
  if (!services.length) return J({ error: '해당 주소로 UPS 요율을 받지 못했습니다' }, 502);
  return J({ services, splitShipment: parts.length > 1 });
}

/* ───────────────────────── Authorize.net 결제 ───────────────────────── */
async function pay(body, env) {
  const { opaqueData, amount, invoice, billTo, email } = body || {};
  if (!opaqueData || !opaqueData.dataValue) return J({ error: '카드 토큰이 없습니다' }, 400);
  if (!(amount > 0)) return J({ error: '금액이 없습니다' }, 400);
  const base = env.ANET_ENV === 'production'
    ? 'https://api.authorize.net/xml/v1/request.api'
    : 'https://apitest.authorize.net/xml/v1/request.api';
  const reqBody = {
    createTransactionRequest: {
      merchantAuthentication: { name: env.ANET_API_LOGIN_ID, transactionKey: env.ANET_TRANSACTION_KEY },
      refId: (invoice || '').slice(0, 20),
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: String(Math.round(amount * 100) / 100),
        payment: { opaqueData: { dataDescriptor: opaqueData.dataDescriptor, dataValue: opaqueData.dataValue } },
        order: { invoiceNumber: (invoice || '').slice(0, 20), description: 'Pacific Sports web order' },
        customer: email ? { email: String(email).slice(0, 255) } : undefined,
        billTo: billTo ? {
          firstName: (billTo.firstName || '').slice(0, 50), lastName: (billTo.lastName || '').slice(0, 50),
          company: (billTo.company || '').slice(0, 50),
          address: (billTo.addr1 || '').slice(0, 60), city: (billTo.city || '').slice(0, 40),
          state: (billTo.state || '').slice(0, 40), zip: (billTo.zip || '').slice(0, 20), country: 'US'
        } : undefined
      }
    }
  };
  const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) });
  const text = await r.text();
  const d = JSON.parse(text.replace(/^﻿/, ''));   // Authorize.net은 BOM을 붙여 보냄
  const tr = d.transactionResponse;
  const okCode = d.messages?.resultCode === 'Ok' && tr && tr.responseCode === '1';
  if (!okCode) {
    const msg = tr?.errors?.[0]?.errorText || d.messages?.message?.[0]?.text || '결제가 거절되었습니다';
    return J({ ok: false, error: msg }, 402);
  }
  return J({ ok: true, transId: tr.transId, authCode: tr.authCode, last4: (tr.accountNumber || '').slice(-4) });
}

/* Authorize.net refund (partial/full)
   POST /refund  body: { transId, amount }
   - settled  -> refundTransaction (partial ok)
   - unsettled-> full=void, partial=409 with guidance
   Card number is NOT stored; last4 is read from getTransactionDetails. */
async function refund(body, env) {
  const { transId, amount } = body || {};
  if (!transId) return J({ ok: false, error: '거래번호(transId)가 없습니다' }, 400);
  if (!(amount > 0)) return J({ ok: false, error: '환불 금액이 없습니다' }, 400);
  const base = env.ANET_ENV === 'production'
    ? 'https://api.authorize.net/xml/v1/request.api'
    : 'https://apitest.authorize.net/xml/v1/request.api';
  const auth = { name: env.ANET_API_LOGIN_ID, transactionKey: env.ANET_TRANSACTION_KEY };
  const anet = async (payload) => {
    const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await r.text();
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  };
  const amt = String(Math.round(amount * 100) / 100);
  const dd = await anet({ getTransactionDetailsRequest: { merchantAuthentication: auth, transId: String(transId) } });
  if (dd.messages && dd.messages.resultCode !== 'Ok') {
    const m = (dd.messages.message && dd.messages.message[0] && dd.messages.message[0].text) || '거래 조회 실패';
    return J({ ok: false, error: '거래 조회 실패: ' + m }, 502);
  }
  const tx = dd.transaction || {};
  const status = tx.transactionStatus;
  const cc = (tx.payment && tx.payment.creditCard) || {};
  const last4 = String(cc.cardNumber || '').replace(/[^0-9]/g, '').slice(-4);
  const expDate = cc.expirationDate || 'XXXX';
  const settleAmount = Number(tx.settleAmount || tx.authAmount || 0);
  if (status === 'capturedPendingSettlement' || status === 'authorizedPendingCapture') {
    if (settleAmount > 0 && Math.round(amount * 100) >= Math.round(settleAmount * 100)) {
      const vt = await anet({ createTransactionRequest: { merchantAuthentication: auth,
        transactionRequest: { transactionType: 'voidTransaction', refTransId: String(transId) } } });
      const vtr = vt.transactionResponse;
      if (vt.messages && vt.messages.resultCode === 'Ok' && vtr && vtr.responseCode === '1')
        return J({ ok: true, mode: 'void', refundTransId: vtr.transId, amount: settleAmount });
      const em = (vtr && vtr.errors && vtr.errors[0] && vtr.errors[0].errorText) || (vt.messages && vt.messages.message && vt.messages.message[0] && vt.messages.message[0].text) || '주문 취소 실패';
      return J({ ok: false, error: em, mode: 'void' }, 402);
    }
    return J({ ok: false, code: 'UNSETTLED_PARTIAL',
      error: '이 주문은 아직 카드사 정산 전이라 부분환불이 안 됩니다. 정산(보통 다음 영업일) 후 다시 시도하거나, 전액 취소만 가능합니다.' }, 409);
  }
  if (!last4) return J({ ok: false, error: '카드 정보를 확인할 수 없어 환불할 수 없습니다' }, 502);
  const rt = await anet({ createTransactionRequest: { merchantAuthentication: auth,
    transactionRequest: {
      transactionType: 'refundTransaction',
      amount: amt,
      payment: { creditCard: { cardNumber: last4, expirationDate: expDate || 'XXXX' } },
      refTransId: String(transId)
    } } });
  const rtr = rt.transactionResponse;
  if (rt.messages && rt.messages.resultCode === 'Ok' && rtr && rtr.responseCode === '1')
    return J({ ok: true, mode: 'refund', refundTransId: rtr.transId, amount: Math.round(amount * 100) / 100 });
  const em = (rtr && rtr.errors && rtr.errors[0] && rtr.errors[0].errorText) || (rt.messages && rt.messages.message && rt.messages.message[0] && rt.messages.message[0].text) || '환불 실패';
  return J({ ok: false, error: em, mode: 'refund' }, 402);
}

// Pacific Sports — Shop Email Worker (Resend) · v2 브랜드 디자인
// 업데이트: Worker → Edit code → 전체 교체 → Deploy
// 변수: RESEND_API_KEY (Secret), FROM_EMAIL, OWNER_EMAIL

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

    try {
      const { type, to, data } = await request.json();
      if (!type || !to) return json({ error: 'type and to required' }, 400, cors);
      const d = data || {};
      const SHOP = 'https://pacific-sports-shop.pages.dev';
      const LOGO = SHOP + '/logo-pacific-white.png';
      const FROM = env.FROM_EMAIL;

      // ── 사이트 분위기 그대로: 크림 종이 + 진초록 + 세리프 제목 ──
      const wrap = (inner, preheader) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f0eee8">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eee8;padding:34px 14px">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fdfdfb;border:1px solid #e7e4dc;border-radius:18px;overflow:hidden">
    <!-- 헤더: 진초록 배너 + 흰 로고 -->
    <tr><td style="background:#243425;padding:26px 36px">
      <table role="presentation" width="100%"><tr>
        <td><img src="${LOGO}" alt="Pacific Sports" height="36" style="display:block;border:0;height:36px"></td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.22em;color:#aebbaf;text-transform:uppercase">Wholesale</td>
      </tr></table>
    </td></tr>
    <!-- 본문 -->
    <tr><td style="padding:38px 38px 30px;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a">
      ${inner}
    </td></tr>
    <!-- 푸터 -->
    <tr><td style="padding:20px 38px 26px;border-top:1px solid #e7e4dc;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.8;color:#8b8880">
      <b style="color:#4c4a44">Pacific Sports</b> · Premium blanks since 1992<br>
      East Coast — Sumter, SC (803) 840-2405 &nbsp;·&nbsp; West Coast — Eastvale, CA (803) 447-0012<br>
      <a href="${SHOP}" style="color:#3d5a40;text-decoration:none">pacific-sports-shop.pages.dev</a>
    </td></tr>
  </table>
  <div style="font-family:Arial,sans-serif;font-size:11px;color:#b3afa5;padding-top:16px">You're receiving this because of your Pacific Sports wholesale account.</div>
</td></tr>
</table>
</body></html>`;

      const H = (t) => `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.25;color:#1c1c1a">${t}</h1>`;
      const P = (t) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#4c4a44">${t}</p>`;
      const BTN = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0"><tr>
        <td style="background:#3d5a40;border-radius:11px"><a href="${href}"
          style="display:inline-block;padding:14px 32px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${label}</a></td></tr></table>`;
      const PILL = (t) => `<span style="display:inline-block;background:#eef1ec;color:#3d5a40;border:1px solid #dce4da;border-radius:999px;padding:7px 18px;font-size:14px;font-weight:bold;letter-spacing:.03em">${t}</span>`;

      const itemsTable = (items) => {
        if (!Array.isArray(items) || !items.length) return '';
        const rows = items.map((i, n) =>
          `<tr style="background:${n % 2 ? '#faf9f5' : '#fdfdfb'}">
            <td style="padding:10px 12px;font-size:13.5px;border-bottom:1px solid #f0ede5"><b>${esc(i.style)}</b></td>
            <td style="padding:10px 12px;font-size:13.5px;border-bottom:1px solid #f0ede5">${esc(i.color)}</td>
            <td style="padding:10px 12px;font-size:12px;border-bottom:1px solid #f0ede5">
              <span style="background:${i.wh === 'SC' ? '#e7eef5' : '#fdf3e2'};color:${i.wh === 'SC' ? '#33414f' : '#9a6b1f'};border-radius:999px;padding:3px 11px;font-weight:bold">${esc(i.wh)}</span></td>
            <td style="padding:10px 12px;font-size:13.5px;border-bottom:1px solid #f0ede5">${esc(i.size)}</td>
            <td align="right" style="padding:10px 12px;font-size:13.5px;border-bottom:1px solid #f0ede5"><b>${i.qty || 0}</b></td>
          </tr>`).join('');
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border:1px solid #e7e4dc;border-radius:12px;border-collapse:separate;overflow:hidden;font-family:Arial,sans-serif">
          <tr style="background:#f3f1ea">
            <td style="padding:9px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b8880">Style</td>
            <td style="padding:9px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b8880">Color</td>
            <td style="padding:9px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b8880">WH</td>
            <td style="padding:9px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b8880">Size</td>
            <td align="right" style="padding:9px 12px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8b8880">Qty</td></tr>
          ${rows}</table>`;
      };
      const NOTE = (t) => `<div style="background:#eef1ec;border:1px solid #dce4da;border-radius:12px;padding:13px 17px;font-size:14px;color:#3d5a40;margin:16px 0">📝 &nbsp;${esc(t)}</div>`;

      let emails = [];

      if (type === 'approval') {
        emails.push({
          to, subject: "You're in — your Pacific Sports wholesale account is live 🎉",
          html: wrap(
            H(`Welcome aboard${d.contact_name ? ', ' + esc(d.contact_name) : ''} 👋`) +
            P(`Your wholesale account${d.company_name ? ' for <b>' + esc(d.company_name) + '</b>' : ''} just went live.
               Live stock across our <b>SC</b> and <b>CA</b> warehouses, wholesale pricing, and ordering — all unlocked.`) +
            BTN(SHOP + '/epacific-login.html', 'Log in & start ordering →') +
            P(`Questions? Just hit reply — a real person reads these.`),
            'Your wholesale account is approved — log in and start ordering.')
        });
      } else if (type === 'order') {
        emails.push({
          to, subject: 'Order ' + (d.order_number || '') + ' received',
          html: wrap(
            H('Order received') +
            `<div style="margin:0 0 18px">${PILL(esc(d.order_number || ''))} &nbsp;<span style="font-size:14px;color:#8b8880">${d.total_pcs || 0} pcs total</span></div>` +
            P(`Thanks${d.contact_name ? ', ' + esc(d.contact_name) : ''}! We've got your order and we're on it.
               We'll confirm availability and pricing shortly — you'll hear from us by email.`) +
            itemsTable(d.items) +
            (d.notes ? NOTE(d.notes) : ''),
            'We received your order ' + (d.order_number || '') + ' — confirmation coming soon.')
        });
        if (env.OWNER_EMAIL) {
          emails.push({
            to: env.OWNER_EMAIL,
            subject: '🛒 New web order ' + (d.order_number || '') + ' — ' + (d.company_name || to) + ' (' + (d.total_pcs || 0) + ' pcs)',
            html: wrap(
              H('New web order') +
              `<div style="margin:0 0 18px">${PILL(esc(d.order_number || ''))} &nbsp;<span style="font-size:14px;color:#8b8880">${d.total_pcs || 0} pcs</span></div>` +
              P(`<b>${esc(d.company_name || '')}</b> · ${esc(d.contact_name || '')} · ${esc(to)} ${d.phone ? '· ' + esc(d.phone) : ''}`) +
              staffDetail(d) +
              (d.notes ? NOTE(d.notes) : '') +
              BTN(SHOP + '/admin-web-orders.html', 'Open Web Orders →'),
              'New web order from ' + (d.company_name || to))
          });
        }
      } else if (type === 'shipped') {
        const carrier = String(d.carrier || '');
        const trackUrl = (n) => carrier.toUpperCase().includes('UPS') ? 'https://www.ups.com/track?tracknum=' + encodeURIComponent(n)
          : carrier.toUpperCase().includes('FEDEX') ? 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(n)
          : null;
        // 운송장 여러 개 (한 줄에 하나씩) → 각각 클릭 가능한 링크
        const trks = String(d.tracking_number || '').split('\n').map(s => s.trim()).filter(Boolean);
        const linkFor = (n) => { const u = trackUrl(n); return u
          ? '<a href="' + u + '" style="color:#3d5a40;font-weight:bold;text-decoration:underline">' + esc(n) + '</a>'
          : '<b>' + esc(n) + '</b>'; };
        const firstUrl = trks.length ? trackUrl(trks[0]) : null;
        const trkBlock = trks.length
          ? (firstUrl ? BTN(firstUrl, 'Track your shipment →') : '') +
            P('Tracking number' + (trks.length > 1 ? 's' : '') + ': ' + trks.map(linkFor).join(' &nbsp;·&nbsp; '))
          : '';
        // 인보이스 + 패킹리스트 PDF 첨부 (주문 데이터가 있을 때만)
        let attachments = [];
        try {
          if (Array.isArray(d.items) && d.items.length) {
            attachments = [
              { filename: 'Invoice-' + (d.order_number || 'order') + '.pdf', content: invoicePdf(d) },
              { filename: 'PackingList-' + (d.order_number || 'order') + '.pdf', content: packingPdf(d) }
            ];
          }
        } catch (e) { attachments = []; }
        emails.push({
          to, attachments,
          subject: '📦 On the way! Order ' + (d.order_number || '') + ' has shipped',
          html: wrap(
            H('Your order is on the way 📦') +
            `<div style="margin:0 0 18px">${PILL(esc(d.order_number || ''))}${carrier ? ' &nbsp;<span style="font-size:14px;color:#8b8880">via <b>' + esc(carrier) + '</b></span>' : ''}</div>` +
            P(`Your order just left our warehouse.`) +
            trkBlock +
            (attachments.length ? P(`📎 Your <b>invoice</b> and <b>packing list</b> are attached to this email.`) : '') +
            P(`Questions about your shipment? Just reply to this email.`),
            'Order ' + (d.order_number || '') + ' shipped' + (trks.length ? ' · tracking ' + trks.join(', ') : ''))
        });
      } else {
        return json({ error: 'unknown type' }, 400, cors);
      }

      const results = [];
      for (const m of emails) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Pacific Sports <' + FROM + '>', to: String(m.to).split(',').map(s => s.trim()).filter(Boolean), subject: m.subject, html: m.html, attachments: (m.attachments && m.attachments.length) ? m.attachments : undefined }),
        });
        const body = await r.json().catch(() => ({}));
        results.push({ to: m.to, ok: r.ok, id: body.id || null, error: r.ok ? null : (body.message || r.status) });
      }
      return json({ sent: results }, 200, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500, cors);
    }
  },
};

function esc(t) { return String(t == null ? '' : t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); }
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json' }, cors) });
}

/* ───────────── 순수 JS PDF 생성 (Helvetica, Latin-1) — 인보이스/패킹리스트 ─────────────
   외부 라이브러리 없이 워커 안에서 PDF를 만들고 base64로 반환(Resend 첨부용).
   주의: 비-Latin1(한글 등) 글자는 '?'로 치환됨(주소·이름은 영문 기준).            */
function staffDetail(d) {
  var items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) return "";
  var sub = 0, rows = "";
  for (var n = 0; n < items.length; n++) {
    var i = items[n];
    var up = (i.unit_price != null) ? Number(i.unit_price) : null;
    var amt = (Number(i.qty) || 0) * (up || 0);
    if (up != null) sub += amt;
    var bg = (n % 2) ? "#faf9f5" : "#fdfdfb";
    var whbg = (i.wh === 'SC') ? "#e7eef5" : "#fdf3e2";
    var whc = (i.wh === 'SC') ? "#33414f" : "#9a6b1f";
    rows += "<tr style='background:" + bg + "'>"
      + "<td style='padding:9px 12px;font-size:13px;border-bottom:1px solid #f0ede5'><b>" + esc(i.style) + "</b></td>"
      + "<td style='padding:9px 12px;font-size:13px;border-bottom:1px solid #f0ede5'>" + esc(i.color || '') + "</td>"
      + "<td style='padding:9px 12px;font-size:12px;border-bottom:1px solid #f0ede5'><span style='background:" + whbg + ";color:" + whc + ";border-radius:999px;padding:3px 10px;font-weight:bold'>" + esc(i.wh || '') + "</span></td>"
      + "<td style='padding:9px 12px;font-size:13px;border-bottom:1px solid #f0ede5'>" + esc(i.size || '') + "</td>"
      + "<td align='right' style='padding:9px 12px;font-size:13px;border-bottom:1px solid #f0ede5'>" + (i.qty || 0) + "</td>"
      + "<td align='right' style='padding:9px 12px;font-size:13px;border-bottom:1px solid #f0ede5'>" + (up != null ? _money(up) : '-') + "</td>"
      + "<td align='right' style='padding:9px 12px;font-size:13px;border-bottom:1px solid #f0ede5'><b>" + (up != null ? _money(amt) : '-') + "</b></td>"
      + "</tr>";
  }
  var ship = Number(d.shipping_cost || 0);
  var total = (d.total_amount != null) ? Number(d.total_amount) : (sub + ship);
  var th = "<td style='padding:9px 12px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8b8880'>";
  var thr = "<td align='right' style='padding:9px 12px;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#8b8880'>";
  var head = "<tr style='background:#f3f1ea'>" + th + "Style</td>" + th + "Color</td>" + th + "WH</td>" + th + "Size</td>" + thr + "Qty</td>" + thr + "Unit</td>" + thr + "Amount</td></tr>";
  var totals = "<tr><td colspan='5'></td><td align='right' style='padding:8px 12px;font-size:12.5px;color:#8b8880'>Subtotal</td><td align='right' style='padding:8px 12px;font-size:12.5px'>" + _money(sub) + "</td></tr>"
    + "<tr><td colspan='5'></td><td align='right' style='padding:4px 12px;font-size:12.5px;color:#8b8880'>Shipping</td><td align='right' style='padding:4px 12px;font-size:12.5px'>" + _money(ship) + "</td></tr>"
    + "<tr><td colspan='5'></td><td align='right' style='padding:8px 12px;font-size:14px;font-weight:bold'>Total</td><td align='right' style='padding:8px 12px;font-size:14px;font-weight:bold;color:#3d5a40'>" + _money(total) + "</td></tr>";
  var table = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin:18px 0;border:1px solid #e7e4dc;border-radius:12px;border-collapse:separate;overflow:hidden;font-family:Arial,sans-serif'>" + head + rows + totals + "</table>";
  var st = d.ship_to || {};
  var shipLine = [st.addr1, [st.city, st.state, st.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ');
  var addr = shipLine ? "<p style='margin:0 0 8px;font-size:13px;color:#8b8880'>Ship to: " + esc(shipLine) + "</p>" : "";
  return table + addr;
}

function _pdfEsc(s) { return String(s == null ? '' : s).replace(/[\\()]/g, m => '\\' + m); }
function _toLatin1(s) { return String(s == null ? '' : s).split('').map(ch => { const c = ch.charCodeAt(0); return (c >= 0x20 && c <= 0xFF) ? ch : '?'; }).join(''); }
function _T(x, y, size, font, str) { return 'BT /' + font + ' ' + size + ' Tf ' + x + ' ' + y + ' Td (' + _pdfEsc(_toLatin1(str)) + ') Tj ET\n'; }
function _HR(x1, y, x2) { return '0.5 w ' + x1 + ' ' + y + ' m ' + x2 + ' ' + y + ' l S\n'; }
function _money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function _makePdf(content) {
  const objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>';
  objs[4] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
  objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[6] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  let pdf = '%PDF-1.4\n'; const off = [];
  for (let i = 1; i <= 6; i++) { off[i] = pdf.length; pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const xref = pdf.length;
  pdf += 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) { pdf += String(off[i]).padStart(10, '0') + ' 00000 n \n'; }
  pdf += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return btoa(pdf);   // Cloudflare Workers: btoa로 base64 (모든 글자 ≤0xFF)
}
function _pdfHead(title) {
  return _T(40, 752, 20, 'F2', 'PACIFIC SPORTS')
    + _T(40, 738, 8.5, 'F1', 'Premium blanks since 1992  -  Sumter, SC  -  Eastvale, CA')
    + _T(612 - 40 - title.length * 13, 752, 22, 'F2', title)
    + _HR(40, 728, 572);
}
function _addrCol(title, lines, x, y) {
  let s = _T(x, y, 9, 'F2', title); y -= 14;
  for (const ln of lines) { if (ln) { s += _T(x, y, 9.5, 'F1', ln); y -= 12; } }
  return { s, y };
}
function _trkList(d) { return String(d.tracking_number || '').split('\n').map(s => s.trim()).filter(Boolean); }
function _date(s) { return String(s || '').slice(0, 10); }
function invoicePdf(d) {
  const items = Array.isArray(d.items) ? d.items : [];
  const st = d.ship_to || {};
  let c = _pdfHead('INVOICE');
  let y = 712;
  c += _T(40, y, 9.5, 'F1', 'Order:  ' + (d.order_number || '')) + _T(330, y, 9.5, 'F1', 'Order date:  ' + _date(d.paid_at)); y -= 14;
  c += _T(40, y, 9.5, 'F1', 'Carrier:  ' + (d.carrier || '-')) + _T(330, y, 9.5, 'F1', 'Ship date:  ' + _date(d.shipped_at)); y -= 14;
  const trks = _trkList(d);
  c += _T(40, y, 9.5, 'F1', 'Tracking:  ' + (trks.length ? trks.join(',  ') : '-')) + (d.paid_at ? _T(330, y, 10, 'F2', 'PAID') : ''); y -= 24;
  const billLines = [d.company_name, d.contact_name, d.email, d.phone].filter(Boolean);
  const shipLines = [d.company_name, (d.contact_name || st.name), st.addr1, st.addr2, [st.city, st.state, st.zip].filter(Boolean).join(', ')].filter(Boolean);
  const bt = _addrCol('BILL TO', billLines, 40, y);
  const sh = _addrCol('SHIP TO', shipLines, 330, y);
  c += bt.s + sh.s; y = Math.min(bt.y, sh.y) - 8;
  c += _T(40, y, 8, 'F2', 'STYLE') + _T(140, y, 8, 'F2', 'COLOR') + _T(250, y, 8, 'F2', 'WH') + _T(290, y, 8, 'F2', 'SIZE') + _T(360, y, 8, 'F2', 'QTY') + _T(430, y, 8, 'F2', 'UNIT') + _T(510, y, 8, 'F2', 'AMOUNT');
  y -= 4; c += _HR(40, y, 572); y -= 14;
  let sub = 0;
  for (const i of items) {
    const amt = (Number(i.qty) || 0) * (i.unit_price != null ? Number(i.unit_price) : 0);
    if (i.unit_price != null) sub += amt;
    c += _T(40, y, 9, 'F1', i.style) + _T(140, y, 9, 'F1', i.color || '') + _T(250, y, 9, 'F1', i.wh || '') + _T(290, y, 9, 'F1', i.size || '') + _T(365, y, 9, 'F1', String(i.qty || 0)) + _T(430, y, 9, 'F1', i.unit_price != null ? _money(i.unit_price) : '-') + _T(505, y, 9, 'F1', i.unit_price != null ? _money(amt) : '-');
    y -= 14; if (y < 120) break;
  }
  y -= 2; c += _HR(360, y, 572); y -= 16;
  const ship = Number(d.shipping_cost || 0);
  const total = (d.total_amount != null) ? Number(d.total_amount) : (sub + ship);
  c += _T(360, y, 9.5, 'F1', 'Subtotal:') + _T(505, y, 9.5, 'F1', _money(sub)); y -= 14;
  c += _T(360, y, 9.5, 'F1', 'Shipping:') + _T(505, y, 9.5, 'F1', _money(ship)); y -= 16;
  c += _T(360, y, 11, 'F2', 'TOTAL:') + _T(505, y, 11, 'F2', _money(total));
  c += _T(40, 90, 8.5, 'F1', 'Thank you for your business. Questions? Reply to your shipment email.');
  return _makePdf(c);
}
function packingPdf(d) {
  const items = Array.isArray(d.items) ? d.items : [];
  const st = d.ship_to || {};
  let c = _pdfHead('PACKING LIST');
  let y = 712;
  c += _T(40, y, 9.5, 'F1', 'Order:  ' + (d.order_number || '')) + _T(330, y, 9.5, 'F1', 'Ship date:  ' + _date(d.shipped_at)); y -= 14;
  const trks = _trkList(d);
  c += _T(40, y, 9.5, 'F1', 'Carrier:  ' + (d.carrier || '-')) + _T(330, y, 9.5, 'F1', 'Tracking:  ' + (trks.length ? trks.join(',  ') : '-')); y -= 24;
  const fromLines = ['Pacific Sports', 'East - Sumter, SC  (803) 840-2405', 'West - Eastvale, CA  (803) 447-0012'];
  const shipLines = [d.company_name, (d.contact_name || st.name), st.addr1, st.addr2, [st.city, st.state, st.zip].filter(Boolean).join(', '), d.phone].filter(Boolean);
  const fr = _addrCol('SHIP FROM', fromLines, 40, y);
  const sh = _addrCol('SHIP TO', shipLines, 330, y);
  c += fr.s + sh.s; y = Math.min(fr.y, sh.y) - 8;
  c += _T(40, y, 8, 'F2', 'STYLE') + _T(160, y, 8, 'F2', 'COLOR') + _T(300, y, 8, 'F2', 'WH') + _T(360, y, 8, 'F2', 'SIZE') + _T(470, y, 8, 'F2', 'QTY');
  y -= 4; c += _HR(40, y, 572); y -= 14;
  let tot = 0;
  for (const i of items) {
    tot += Number(i.qty) || 0;
    c += _T(40, y, 9, 'F1', i.style) + _T(160, y, 9, 'F1', i.color || '') + _T(300, y, 9, 'F1', i.wh || '') + _T(360, y, 9, 'F1', i.size || '') + _T(475, y, 9, 'F1', String(i.qty || 0));
    y -= 14; if (y < 120) break;
  }
  y -= 2; c += _HR(40, y, 572); y -= 16;
  c += _T(360, y, 11, 'F2', 'TOTAL PCS:') + _T(475, y, 11, 'F2', String(tot));
  c += _T(40, 90, 8.5, 'F1', 'Please verify contents against this packing list upon receipt.');
  return _makePdf(c);
}

/* Pacific Sports - Box Label  :  이 주소는 문을 닫았다 (2026-10-07)
   ──────────────────────────────────────────────────────────────────────
   도구는 https://pacific-box-label.hjbae.workers.dev/ 로 옮겼다.
   ⚠ 예전 service worker 는 「저장된 사본 먼저」라서, 한 번이라도 여기를 연
     컴퓨터는 새 안내문조차 못 보고 옛 도구를 계속 띄운다.
     그래서 이 파일이 그 자리를 넘겨받아 **스스로 지우고 물러난다.**
   ────────────────────────────────────────────────────────────────────── */
self.addEventListener('install', function(){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    var names = await caches.keys();
    await Promise.all(names.map(function(n){ return caches.delete(n); }));
    await self.registration.unregister();
    var cs = await self.clients.matchAll({ type:'window' });
    cs.forEach(function(c){ try{ c.navigate(c.url); }catch(err){} });
  })());
});
/* fetch 를 안 가로챈다 - 모든 요청이 그냥 네트워크로 간다 */

// Paths are resolved against the worker scope, so the same file works at / (Cloudflare) and /Lamsa/ (GitHub Pages).
function scoped(p){const base=self.registration.scope;const clean=String(p||'').replace(/^\/+/,'');try{const u=new URL(clean,base);return u.origin===self.location.origin?u.href:base}catch{return base}}
self.addEventListener('push',event=>{
  let d={};try{d=event.data?event.data.json():{}}catch{d={title:'LAMSA',body:event.data?.text()||'لديك إشعار جديد'}}
  const title=d.title||'LAMSA';
  const options={body:d.body||'لديك إشعار جديد',icon:scoped('assets/img/icon-192.png'),badge:scoped('assets/img/icon-192.png'),tag:d.tag||'lamsa-notification',renotify:true,data:{url:scoped(d.url||'admin/dashboard.html'),notificationId:d.notificationId||null},dir:'rtl',lang:'ar'};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=event.notification.data?.url||scoped('admin/dashboard.html');
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if(c.url===url&&'focus'in c)return c.focus()}return clients.openWindow?clients.openWindow(url):null}));
});

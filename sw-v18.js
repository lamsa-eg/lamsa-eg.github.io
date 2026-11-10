self.addEventListener('push',event=>{
  let d={};try{d=event.data?event.data.json():{}}catch{d={title:'LAMSA',body:event.data?.text()||'لديك إشعار جديد'}}
  const title=d.title||'LAMSA';
  const options={body:d.body||'لديك إشعار جديد',icon:'/assets/img/monogram.svg',badge:'/assets/img/monogram.svg',tag:d.tag||'lamsa-notification',renotify:true,data:{url:d.url||'/admin/dashboard.html',notificationId:d.notificationId||null},dir:'rtl',lang:'ar'};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=new URL(event.notification.data?.url||'/admin/dashboard.html',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if(c.url===url&&'focus'in c)return c.focus()}return clients.openWindow?clients.openWindow(url):null}));
});

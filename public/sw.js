// public/sw.js

self.addEventListener('install', event => {
    console.log('Service Worker installing.');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', event => {
    console.log('Service Worker activating.');
  });
  
  self.addEventListener('push', event => {
    const data = event.data.json();
    const title = data.title || 'New Message';
    const body = data.body || 'You have a new notification.';
    const options = {
      body: body,
      icon: '/icons/icon-192x192.png'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  });
  
  self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
      clients.openWindow('/')
    );
  });
  
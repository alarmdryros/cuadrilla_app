/*
* Service Worker para Cuadrilla App (PWA) v2.4.2
* Maneja las notificaciones push en segundo plano.
*/

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    let data = { title: 'Nuevo Anuncio', body: 'Tienes un nuevo aviso en el tablón.' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Nuevo Anuncio', body: event.data.text() };
        }
    }

    const title = data.title;
    const options = {
        body: data.body,
        icon: '/icon-192.png', // Ajustar según tus assets
        badge: '/icon-192.png',
        data: data.url || '/',
        vibrate: [200, 100, 200]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data)
    );
});

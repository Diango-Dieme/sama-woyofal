// Nom du cache
const CACHE_NAME = 'sama-woyofal-cache-v1';

// Fichiers à mettre en cache
const urlsToCache = [
  '.', // Alias pour index.html
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 1. Installation du Service Worker (Mise en cache)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Récupération des fichiers (Servir depuis le cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si le fichier est dans le cache, on le sert
        if (response) {
          return response;
        }
        // Sinon, on essaie de le récupérer sur le réseau
        return fetch(event.request);
      }
    )
  );
});

// 3. Activation (Nettoyage des anciens caches)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 4. Gérer le clic sur la notification (NOUVEAU BLOC)
self.addEventListener('notificationclick', event => {
  event.notification.close(); // Ferme la notification

  // Ouvre l'application (ou ramène l'onglet au premier plan)
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Si l'app est déjà ouverte, on la focus
      for (const client of clientList) {
        // Vérifie si le client est l'app (l'URL peut être '/' ou '/index.html')
        if ((client.url === self.location.origin + '/' || client.url === self.location.origin + '/index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, on l'ouvre
      if (clients.openWindow) {
        return clients.openWindow('.'); // Ouvre la page index.html
      }
    })
  );
});
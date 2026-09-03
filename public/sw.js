const CACHE_VERSION = 'central-sonhar-pwa-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('central-sonhar-pwa-') &&
                key !== CACHE_VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Intencionalmente sem cache de fetch.
// A Central trabalha com inscrições, checklists e dados administrativos
// que devem continuar vindo da rede/servidor em tempo real.

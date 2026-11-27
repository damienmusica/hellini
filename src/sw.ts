/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] };

/**
 * 서비스 워커: 앱 파일 프리캐시(오프라인) + 폰트 조각 런타임 캐시 + 알림 클릭 시 앱 열기.
 * 휴식 끝 알림은 페이지가 살아 있을 때 페이지가 띄운다. 서비스 워커 혼자 타이머를 돌리지는 않는다.
 */
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

// 한글 폰트 조각(woff2)은 미리 받지 않고, 쓰는 글자만 받아서 오프라인용으로 보관한다
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clients[0];
      if (client) {
        await client.focus();
        return;
      }
      await self.clients.openWindow(self.registration.scope);
    })(),
  );
});

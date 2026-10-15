import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages처럼 하위 경로(/hellini/)에 올릴 때는 BASE_PATH로 지정한다. 기본은 도메인 루트
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // 화면 버전만으로는 빌드를 구별하기 어려워서 커밋 식별자도 같이 보여준다 (Actions는 GITHUB_SHA를 준다)
    __BUILD_ID__: JSON.stringify((process.env.GITHUB_SHA ?? process.env.BUILD_ID ?? 'dev').slice(0, 7)),
  },
  plugins: [
    react(),
    VitePWA({
      // 커스텀 서비스 워커(src/sw.ts): 프리캐시 + 폰트 런타임 캐시 + 알림 클릭 시 앱 열기
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
      manifest: {
        name: '헬린이',
        short_name: '헬린이',
        description: '헬린이를 위한 운동 기록·루틴·휴식 타이머',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b0c',
        theme_color: '#0b0b0c',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});

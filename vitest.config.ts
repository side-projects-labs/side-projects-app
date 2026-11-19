import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 순수 로직(계약·URL 정책·카탈로그·이력) 단위 테스트용 설정. React Native 런타임은 쓰지 않는다.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

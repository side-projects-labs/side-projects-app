import CookieManager from '@preeternal/react-native-cookie-manager';

import type { ProjectEntry } from './catalog';
import { cookieResetUrls } from './login-reset';

export type ResetResult = { cleared: number; failed: number };

/**
 * 프로젝트의 로그인 쿠키를 지운다. 호스트마다 쿠키 이름을 읽어 하나씩 지우며, 일부가 실패해도 나머지는 계속한다.
 * 쿠키 저장소는 모든 프로젝트가 공유하므로 대상 호스트(서비스·allowedHosts)에 속한 쿠키만 건드린다.
 */
export async function resetLogin(project: ProjectEntry): Promise<ResetResult> {
  let cleared = 0;
  let failed = 0;
  for (const url of cookieResetUrls(project)) {
    try {
      const cookies = await CookieManager.getAsArray(url);
      for (const name of new Set(cookies.map((c) => c.name))) {
        try {
          if (await CookieManager.clearByName(url, name)) cleared += 1;
        } catch {
          failed += 1;
        }
      }
    } catch {
      failed += 1;
    }
  }
  return { cleared, failed };
}

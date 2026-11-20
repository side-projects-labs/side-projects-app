export type HealthStatus = 'checking' | 'up' | 'down';

const TIMEOUT_MS = 5000;

/** 5xx가 아니면 서비스가 응답하는 것으로 본다. 로그인 필요(401)나 리다이렉트도 살아 있다는 뜻이다. */
export function isHealthyStatus(status: number): boolean {
  return status < 500;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** 서비스 URL에 GET 요청을 보내 상태를 판정한다. 실패·시간 초과는 모두 down. fetch는 테스트용으로 주입한다. */
export async function checkHealth(
  url: string,
  fetcher: Fetcher = fetch,
  timeoutMs = TIMEOUT_MS,
): Promise<'up' | 'down'> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher(url, { method: 'GET', signal: controller.signal });
    return isHealthyStatus(res.status) ? 'up' : 'down';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

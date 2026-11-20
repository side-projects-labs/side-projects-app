import { describe, expect, it } from 'vitest';

import { checkHealth, isHealthyStatus } from './health';

const res = (status: number) => ({ status }) as Response;

describe('isHealthyStatus', () => {
  it('5xx가 아니면 서비스가 응답하는 것으로 본다', () => {
    expect(isHealthyStatus(200)).toBe(true);
    expect(isHealthyStatus(302)).toBe(true);
    expect(isHealthyStatus(401)).toBe(true); // 로그인 필요도 살아 있다는 뜻
    expect(isHealthyStatus(404)).toBe(true);
  });
  it('5xx는 장애로 본다', () => {
    expect(isHealthyStatus(500)).toBe(false);
    expect(isHealthyStatus(503)).toBe(false);
  });
});

describe('checkHealth', () => {
  it('정상 응답이면 up', async () => {
    expect(await checkHealth('https://a.example', async () => res(200))).toBe('up');
  });
  it('5xx면 down', async () => {
    expect(await checkHealth('https://a.example', async () => res(502))).toBe('down');
  });
  it('네트워크 오류면 down', async () => {
    const f = async () => {
      throw new Error('network');
    };
    expect(await checkHealth('https://a.example', f)).toBe('down');
  });
  it('제한 시간을 넘기면 down', async () => {
    const hang = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    expect(await checkHealth('https://a.example', hang, 10)).toBe('down');
  });
});

import { describe, expect, it } from 'vitest';

import { parseDeploymentEvent } from './contract';

const valid = { version: 1, eventId: 'o/r-1-1-succeeded', projectId: 'portfolio-admin', status: 'succeeded' };

describe('parseDeploymentEvent', () => {
  it('유효한 version=1 이벤트를 그대로 돌려준다', () => {
    expect(parseDeploymentEvent(valid)).toEqual(valid);
  });

  it.each(['started', 'succeeded', 'failed'])('status %s 를 허용한다', (status) => {
    expect(parseDeploymentEvent({ ...valid, status })?.status).toBe(status);
  });

  it('계약 밖 필드는 결과에 포함하지 않는다', () => {
    const parsed = parseDeploymentEvent({ ...valid, extra: 'x', url: 'https://evil.example.com' });
    expect(parsed).toEqual(valid);
    expect(parsed).not.toHaveProperty('extra');
    expect(parsed).not.toHaveProperty('url');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['문자열', 'text'],
    ['숫자', 1],
    ['빈 객체', {}],
    ['version 불일치', { ...valid, version: 2 }],
    ['version 문자열', { ...valid, version: '1' }],
    ['eventId 누락', { ...valid, eventId: undefined }],
    ['projectId 숫자', { ...valid, projectId: 1 }],
    ['알 수 없는 status', { ...valid, status: 'cancelled' }],
    ['status 대소문자', { ...valid, status: 'Succeeded' }],
  ])('%s 는 null', (_name, input) => {
    expect(parseDeploymentEvent(input)).toBeNull();
  });
});

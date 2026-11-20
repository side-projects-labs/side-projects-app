import { describe, expect, it } from 'vitest';

import type { ProjectEntry } from './catalog';
import { cookieResetUrls } from './login-reset';

const project: ProjectEntry = {
  id: 'portfolio-admin',
  name: 'Portfolio Admin',
  description: 'd',
  icon: 'i',
  url: 'https://admin.ycseng.com/dashboard?x=1',
  allowedHosts: ['api.ycseng.com', 'GitHub.com', 'admin.ycseng.com'],
};

describe('cookieResetUrls', () => {
  it('서비스 호스트와 allowedHosts의 루트 주소를 중복 없이 돌려준다', () => {
    expect(cookieResetUrls(project)).toEqual([
      'https://admin.ycseng.com/',
      'https://api.ycseng.com/',
      'https://github.com/',
    ]);
  });
  it('allowedHosts가 없으면 서비스 호스트만', () => {
    expect(cookieResetUrls({ ...project, allowedHosts: undefined })).toEqual(['https://admin.ycseng.com/']);
  });
  it('서비스 주소가 잘못되면 빈 목록(아무것도 지우지 않는다)', () => {
    expect(cookieResetUrls({ ...project, url: 'not a url' })).toEqual([]);
  });
  it('서비스 주소가 https가 아니면 빈 목록', () => {
    expect(cookieResetUrls({ ...project, url: 'http://admin.ycseng.com' })).toEqual([]);
  });
});

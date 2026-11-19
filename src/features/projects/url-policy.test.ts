import { describe, expect, it } from 'vitest';

import type { ProjectEntry } from './catalog';
import { isExternalOpenable, isInternalUrl } from './url-policy';

const project: ProjectEntry = {
  id: 'portfolio-admin',
  name: 'Portfolio Admin',
  description: 'd',
  icon: 'i',
  url: 'https://admin.ycseng.com',
  allowedHosts: ['api.ycseng.com', 'github.com', 'accounts.google.com'],
};
const plain: ProjectEntry = { ...project, allowedHosts: undefined };

describe('isInternalUrl', () => {
  it('서비스 호스트는 허용한다', () => {
    expect(isInternalUrl(project, 'https://admin.ycseng.com/login?x=1')).toBe(true);
  });

  it('allowedHosts 의 호스트는 허용한다(소셜 로그인)', () => {
    expect(isInternalUrl(project, 'https://api.ycseng.com/auth/oauth/github/authorize')).toBe(true);
    expect(isInternalUrl(project, 'https://github.com/login/oauth/authorize')).toBe(true);
    expect(isInternalUrl(project, 'https://ACCOUNTS.google.com/o/oauth2/v2/auth')).toBe(true);
  });

  it('allowedHosts 가 없으면 서비스 호스트만 허용한다', () => {
    expect(isInternalUrl(plain, 'https://github.com/login')).toBe(false);
  });

  it('목록에 없는 호스트는 거부한다', () => {
    expect(isInternalUrl(project, 'https://evil.example.com/')).toBe(false);
  });

  it('서브도메인은 와일드카드로 허용하지 않는다', () => {
    expect(isInternalUrl(project, 'https://sub.github.com/')).toBe(false);
    expect(isInternalUrl(project, 'https://github.com.evil.example.com/')).toBe(false);
  });

  it('HTTP 는 서비스 호스트여도 거부한다', () => {
    expect(isInternalUrl(project, 'http://admin.ycseng.com/')).toBe(false);
    expect(isInternalUrl(project, 'http://github.com/')).toBe(false);
  });

  it('allowedHosts 호스트라도 포트가 있으면 거부한다', () => {
    expect(isInternalUrl(project, 'https://github.com:8443/')).toBe(false);
  });

  it('서비스 호스트는 포트까지 같아야 한다', () => {
    expect(isInternalUrl(project, 'https://admin.ycseng.com:8443/')).toBe(false);
  });

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'not a url', ''])('%s 는 거부한다', (url) => {
    expect(isInternalUrl(project, url)).toBe(false);
  });
});

describe('isExternalOpenable', () => {
  it.each(['https://example.com', 'mailto:a@b.c', 'tel:+8210'])('%s 는 열 수 있다', (url) => {
    expect(isExternalOpenable(url)).toBe(true);
  });

  it.each(['http://example.com', 'javascript:alert(1)', 'file:///x', 'intent://x', 'not a url'])('%s 는 거부한다', (url) => {
    expect(isExternalOpenable(url)).toBe(false);
  });
});

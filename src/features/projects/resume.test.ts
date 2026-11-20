import { describe, expect, it } from 'vitest';

import type { ProjectEntry } from './catalog';
import {
  describeVisit,
  isRememberableUrl,
  parseLastVisit,
  resolveResume,
  resolveShareUrl,
} from './resume';

const project: ProjectEntry = {
  id: 'portfolio-admin',
  name: 'Portfolio Admin',
  description: 'd',
  icon: 'i',
  url: 'https://admin.ycseng.com',
  allowedHosts: ['api.ycseng.com', 'github.com'],
};

describe('isRememberableUrl', () => {
  it('서비스 호스트의 페이지는 쿼리와 해시까지 저장 대상이다', () => {
    expect(isRememberableUrl(project, 'https://admin.ycseng.com/jobs?page=2&q=react#top')).toBe(true);
  });
  it('allowedHosts(로그인용 외부 호스트)는 저장하지 않는다', () => {
    expect(isRememberableUrl(project, 'https://github.com/login/oauth/authorize')).toBe(false);
    expect(isRememberableUrl(project, 'https://api.ycseng.com/auth/callback')).toBe(false);
  });
  it('다른 호스트·http·javascript:는 저장하지 않는다', () => {
    expect(isRememberableUrl(project, 'https://evil.example/x')).toBe(false);
    expect(isRememberableUrl(project, 'http://admin.ycseng.com/x')).toBe(false);
    expect(isRememberableUrl(project, 'javascript:alert(1)')).toBe(false);
    expect(isRememberableUrl(project, 'not a url')).toBe(false);
  });
  it('자격증명이 든 주소는 저장하지 않는다', () => {
    expect(isRememberableUrl(project, 'https://u:p@admin.ycseng.com/x')).toBe(false);
  });
  it('로그인·콜백 경로는 저장하지 않는다', () => {
    for (const path of ['/login', '/auth/callback', '/oauth/github', '/signin', '/logout']) {
      expect(isRememberableUrl(project, `https://admin.ycseng.com${path}`)).toBe(false);
    }
    // 이름이 비슷할 뿐인 경로는 허용한다
    expect(isRememberableUrl(project, 'https://admin.ycseng.com/authors')).toBe(true);
  });
  it('토큰·코드 같은 민감 쿼리나 해시가 있으면 저장하지 않는다', () => {
    expect(isRememberableUrl(project, 'https://admin.ycseng.com/x?code=abc&state=1')).toBe(false);
    expect(isRememberableUrl(project, 'https://admin.ycseng.com/x?Access_Token=abc')).toBe(false);
    expect(isRememberableUrl(project, 'https://admin.ycseng.com/x#access_token=abc')).toBe(false);
    expect(isRememberableUrl(project, 'https://admin.ycseng.com/x?token=abc')).toBe(false);
  });
  it('너무 긴 주소는 저장하지 않는다', () => {
    expect(isRememberableUrl(project, `https://admin.ycseng.com/x?q=${'a'.repeat(2100)}`)).toBe(false);
  });
});

describe('parseLastVisit', () => {
  it('올바른 JSON을 파싱한다', () => {
    const raw = JSON.stringify({ projectId: 'a', url: 'https://a.example/x' });
    expect(parseLastVisit(raw)).toEqual({ projectId: 'a', url: 'https://a.example/x' });
  });
  it('손상되거나 형식이 틀리면 null', () => {
    expect(parseLastVisit(null)).toBeNull();
    expect(parseLastVisit('{oops')).toBeNull();
    expect(parseLastVisit(JSON.stringify({ projectId: 1, url: 'x' }))).toBeNull();
    expect(parseLastVisit(JSON.stringify({ projectId: 'a' }))).toBeNull();
    expect(parseLastVisit(JSON.stringify([]))).toBeNull();
  });
});

describe('resolveResume', () => {
  it('저장된 페이지가 유효하면 그 주소로 연다', () => {
    const r = resolveResume([project], { projectId: project.id, url: 'https://admin.ycseng.com/jobs?page=2' });
    expect(r?.project.id).toBe(project.id);
    expect(r?.url).toBe('https://admin.ycseng.com/jobs?page=2');
  });
  it('주소가 검증에 실패하면 서비스 첫 주소로 대체한다', () => {
    const r = resolveResume([project], { projectId: project.id, url: 'https://evil.example/x' });
    expect(r?.url).toBe(project.url);
  });
  it('카탈로그에서 사라진 프로젝트거나 저장값이 없으면 undefined', () => {
    expect(resolveResume([project], { projectId: 'gone', url: 'https://admin.ycseng.com/x' })).toBeUndefined();
    expect(resolveResume([project], null)).toBeUndefined();
  });
});

describe('describeVisit', () => {
  it('경로와 쿼리를 짧게 보여 준다', () => {
    expect(describeVisit('https://admin.ycseng.com/jobs?page=2')).toBe('/jobs?page=2');
  });
  it('루트는 /로, 긴 값은 줄인다', () => {
    expect(describeVisit('https://admin.ycseng.com')).toBe('/');
    expect(describeVisit(`https://admin.ycseng.com/${'a'.repeat(100)}`).length).toBeLessThanOrEqual(40);
  });
});

describe('resolveShareUrl', () => {
  it('저장 가능한 현재 페이지는 그대로 공유한다', () => {
    expect(resolveShareUrl(project, 'https://admin.ycseng.com/jobs?page=2')).toBe(
      'https://admin.ycseng.com/jobs?page=2',
    );
  });
  it('로그인·콜백 경로나 인증 쿼리가 든 주소는 서비스 첫 주소로 대체한다', () => {
    expect(resolveShareUrl(project, 'https://admin.ycseng.com/login')).toBe(project.url);
    expect(resolveShareUrl(project, 'https://admin.ycseng.com/x?token=abc')).toBe(project.url);
  });
  it('다른 호스트거나 주소가 없으면 서비스 첫 주소를 공유한다', () => {
    expect(resolveShareUrl(project, 'https://github.com/login')).toBe(project.url);
    expect(resolveShareUrl(project, undefined)).toBe(project.url);
  });
});

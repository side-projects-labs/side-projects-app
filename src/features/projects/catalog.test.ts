import { describe, expect, it } from 'vitest';

import { BUNDLED_PROJECTS, findProject, parseCatalog } from './catalog';

const item = (over: Record<string, unknown> = {}) => ({
  id: 'a',
  name: 'A',
  description: 'desc',
  icon: '📦',
  url: 'https://a.example.com',
  ...over,
});
const catalog = (projects: unknown[], version: unknown = 1) => ({ version, projects });

describe('parseCatalog', () => {
  it('유효한 카탈로그를 파싱한다', () => {
    const result = parseCatalog(catalog([item({ repo: 'o/a' })]));
    expect(result).toEqual([
      { id: 'a', name: 'A', description: 'desc', icon: '📦', url: 'https://a.example.com', repo: 'o/a', allowedHosts: undefined },
    ]);
  });

  it.each([
    ['null', null],
    ['문자열', 'x'],
    ['version 불일치', catalog([item()], 2)],
    ['projects 가 배열이 아님', { version: 1, projects: {} }],
    ['빈 목록', catalog([])],
  ])('%s 는 null', (_n, input) => {
    expect(parseCatalog(input)).toBeNull();
  });

  it('잘못된 항목만 버리고 나머지는 유지한다', () => {
    const result = parseCatalog(
      catalog([item({ id: 'ok' }), item({ id: '' }), item({ id: 'b', url: 'http://b.example.com' }), 'junk', null]),
    );
    expect(result?.map((p) => p.id)).toEqual(['ok']);
  });

  it('모든 항목이 무효면 null', () => {
    expect(parseCatalog(catalog([item({ url: 'ftp://x' }), item({ name: ' ' })]))).toBeNull();
  });

  it('중복 id 는 첫 항목만 남긴다', () => {
    const result = parseCatalog(catalog([item({ name: 'first' }), item({ name: 'second' })]));
    expect(result).toHaveLength(1);
    expect(result?.[0].name).toBe('first');
  });

  it.each(['http://a.example.com', 'javascript:alert(1)', 'https://user:pw@a.example.com', 'not a url'])(
    'url %s 는 거부한다',
    (url) => {
      expect(parseCatalog(catalog([item({ url })]))).toBeNull();
    },
  );

  it('최대 50개까지만 읽는다', () => {
    const many = Array.from({ length: 60 }, (_, i) => item({ id: `p${i}` }));
    expect(parseCatalog(catalog(many))).toHaveLength(50);
  });

  describe('allowedHosts', () => {
    it('호스트 이름을 소문자로 정규화하고 중복을 제거한다', () => {
      const result = parseCatalog(catalog([item({ allowedHosts: ['GitHub.com', 'github.com', ' api.example.com '] })]));
      expect(result?.[0].allowedHosts).toEqual(['github.com', 'api.example.com']);
    });

    it.each(['*.google.com', 'evil.com/path', 'a b.com', 'localhost', '1.2.3.4', 'https://github.com', 'github.com:443', ''])(
      '형식이 틀린 호스트 %s 는 버린다',
      (host) => {
        expect(parseCatalog(catalog([item({ allowedHosts: [host] })]))?.[0].allowedHosts).toBeUndefined();
      },
    );

    it('문자열이 아닌 값과 배열이 아닌 값은 무시한다', () => {
      expect(parseCatalog(catalog([item({ allowedHosts: [1, null, 'github.com'] })]))?.[0].allowedHosts).toEqual(['github.com']);
      expect(parseCatalog(catalog([item({ allowedHosts: 'github.com' })]))?.[0].allowedHosts).toBeUndefined();
    });

    it('최대 10개까지만 유지한다', () => {
      const hosts = Array.from({ length: 15 }, (_, i) => `h${i}.example.com`);
      expect(parseCatalog(catalog([item({ allowedHosts: hosts })]))?.[0].allowedHosts).toHaveLength(10);
    });
  });
});

describe('번들 카탈로그', () => {
  it('유효한 프로젝트를 포함한다', () => {
    expect(BUNDLED_PROJECTS.length).toBeGreaterThan(0);
  });

  it('id 가 중복되지 않는다', () => {
    const ids = BUNDLED_PROJECTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('portfolio-admin 은 소셜 로그인 호스트를 허용한다', () => {
    const admin = findProject(BUNDLED_PROJECTS, 'portfolio-admin');
    expect(admin?.allowedHosts).toEqual(expect.arrayContaining(['api.ycseng.com', 'github.com']));
  });
});

describe('findProject', () => {
  it('id 로 찾고 없으면 undefined', () => {
    const list = parseCatalog(catalog([item({ id: 'x' })])) ?? [];
    expect(findProject(list, 'x')?.id).toBe('x');
    expect(findProject(list, 'nope')).toBeUndefined();
    expect(findProject(list, undefined)).toBeUndefined();
  });
});

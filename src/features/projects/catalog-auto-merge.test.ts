import { describe, expect, it } from 'vitest';

import {
  buildReviewBody,
  evaluateAutoMerge,
  hostAllowed,
  isHttpsServiceUrl,
  parsePolicy,
  type AutoMergePolicy,
} from './catalog-auto-merge';
import { diffCatalog, isValidServiceUrl, type SyncEntry } from './catalog-sync';

const POLICY: AutoMergePolicy = { allowedUrlHosts: ['ycseng.com', '*.ycseng.com', 'portfolio-chat-pi.vercel.app'] };
const FILES = ['catalog/projects.json'];

const entry = (over: Partial<SyncEntry> = {}): SyncEntry => ({
  id: 'a',
  name: 'A',
  description: '설명 A',
  icon: '📦',
  url: 'https://a.ycseng.com',
  repo: 'side-projects-labs/a',
  ...over,
});

const run = (base: SyncEntry[], head: SyncEntry[], over: { changedFiles?: string[]; policy?: AutoMergePolicy } = {}) =>
  evaluateAutoMerge({ base, head, changedFiles: over.changedFiles ?? FILES, policy: over.policy ?? POLICY });

describe('hostAllowed', () => {
  it('정확히 같은 호스트와 와일드카드 하위 도메인을 허용한다', () => {
    expect(hostAllowed('ycseng.com', POLICY.allowedUrlHosts)).toBe(true);
    expect(hostAllowed('admin.ycseng.com', POLICY.allowedUrlHosts)).toBe(true);
    expect(hostAllowed('a.b.ycseng.com', POLICY.allowedUrlHosts)).toBe(true);
    expect(hostAllowed('portfolio-chat-pi.vercel.app', POLICY.allowedUrlHosts)).toBe(true);
  });

  it('비슷한 이름의 다른 호스트와 상위 도메인은 허용하지 않는다', () => {
    for (const host of ['evilycseng.com', 'ycseng.com.evil.com', 'xycseng.com', 'vercel.app', 'other.vercel.app', 'com']) {
      expect(hostAllowed(host, POLICY.allowedUrlHosts)).toBe(false);
    }
  });

  it('대소문자를 구분하지 않는다', () => {
    expect(hostAllowed('ADMIN.YCSENG.COM', POLICY.allowedUrlHosts)).toBe(true);
  });
});

describe('parsePolicy', () => {
  it('올바른 정책을 정규화해 돌려준다', () => {
    expect(parsePolicy({ allowedUrlHosts: ['YCSENG.com', '*.ycseng.com', 'ycseng.com'] })).toEqual({
      allowedUrlHosts: ['ycseng.com', '*.ycseng.com'],
    });
  });

  it('형식이 틀리거나 너무 넓은 패턴이 있으면 null이다', () => {
    for (const raw of [
      null,
      {},
      { allowedUrlHosts: 'x' },
      { allowedUrlHosts: [] },
      { allowedUrlHosts: ['*'] },
      { allowedUrlHosts: ['*.com'] },
      { allowedUrlHosts: ['https://ycseng.com'] },
      { allowedUrlHosts: ['ycseng.com/path'] },
      { allowedUrlHosts: ['ycseng.com:8080'] },
      { allowedUrlHosts: [1] },
    ]) {
      expect(parsePolicy(raw)).toBeNull();
    }
  });
});

describe('evaluateAutoMerge', () => {
  it('허용 호스트의 새 프로젝트 추가는 자동 병합 대상이다', () => {
    const d = run([entry()], [entry(), entry({ id: 'b', name: 'B', url: 'https://b.ycseng.com', repo: 'side-projects-labs/b' })]);
    expect(d.eligible).toBe(true);
    expect(d.reasons).toEqual([]);
    expect(d.summary).toEqual({ added: ['b'], changed: [], removed: [] });
  });

  it('이름·설명·아이콘만 바뀐 기존 항목은 자동 병합 대상이다', () => {
    const d = run([entry()], [entry({ name: '새 이름', description: '새 설명', icon: '🚀' })]);
    expect(d.eligible).toBe(true);
    expect(d.summary.changed).toEqual(['a']);
  });

  it('호스트 허용 목록에 있는 정확한 vercel 주소의 새 프로젝트는 대상이다', () => {
    const d = run([entry()], [entry(), entry({ id: 'portfolio-chat', url: 'https://portfolio-chat-pi.vercel.app/', repo: 'side-projects-labs/portfolio-chat' })]);
    expect(d.eligible).toBe(true);
  });

  it('차이가 없으면 대상이 아니다', () => {
    const d = run([entry()], [entry()]);
    expect(d.eligible).toBe(false);
    expect(d.reasons.join(' ')).toContain('변경이 없');
  });

  it('catalog/projects.json 외의 파일이 바뀌었거나 변경 파일이 비어 있으면 사람이 확인한다', () => {
    const head = [entry(), entry({ id: 'b', url: 'https://b.ycseng.com', repo: 'side-projects-labs/b' })];
    expect(run([entry()], head, { changedFiles: [...FILES, 'src/app/index.tsx'] }).eligible).toBe(false);
    expect(run([entry()], head, { changedFiles: ['catalog/overrides.json'] }).eligible).toBe(false);
    expect(run([entry()], head, { changedFiles: [] }).eligible).toBe(false);
  });

  it('프로젝트 삭제는 사람이 확인한다', () => {
    const d = run([entry(), entry({ id: 'b', url: 'https://b.ycseng.com', repo: 'side-projects-labs/b' })], [entry()]);
    expect(d.eligible).toBe(false);
    expect(d.summary.removed).toEqual(['b']);
  });

  it('기존 항목의 url·repo·allowedHosts 변경은 사람이 확인한다', () => {
    expect(run([entry()], [entry({ url: 'https://other.ycseng.com' })]).eligible).toBe(false);
    expect(run([entry()], [entry({ repo: 'side-projects-labs/z' })]).eligible).toBe(false);
    expect(run([entry()], [entry({ allowedHosts: ['github.com'] })]).eligible).toBe(false);
    expect(run([entry({ allowedHosts: ['github.com'] })], [entry({ allowedHosts: ['evil.example.com'] })]).eligible).toBe(false);
  });

  it('새 항목이 허용 호스트 밖이면 사람이 확인한다', () => {
    const d = run([entry()], [entry(), entry({ id: 'b', url: 'https://b.vercel.app', repo: 'side-projects-labs/b' })]);
    expect(d.eligible).toBe(false);
    expect(d.reasons.join(' ')).toContain('b');
  });

  it('새 항목이 HTTPS가 아니거나 자격증명이 있거나 주소 형식이 틀리면 사람이 확인한다', () => {
    const base = [entry()];
    for (const url of ['http://b.ycseng.com', 'https://user:pw@b.ycseng.com', 'ftp://b.ycseng.com', 'not a url']) {
      const d = run(base, [entry(), entry({ id: 'b', url, repo: 'side-projects-labs/b' })]);
      expect(d.eligible).toBe(false);
    }
  });

  it('새 항목에 allowedHosts가 있으면 사람이 확인한다', () => {
    const d = run([entry()], [entry(), entry({ id: 'b', url: 'https://b.ycseng.com', repo: 'side-projects-labs/b', allowedHosts: ['github.com'] })]);
    expect(d.eligible).toBe(false);
  });

  it('새 항목의 repo가 같은 조직의 같은 이름이 아니면 사람이 확인한다', () => {
    for (const repo of ['other-org/b', 'side-projects-labs/c', undefined]) {
      const d = run([entry()], [entry(), entry({ id: 'b', url: 'https://b.ycseng.com', repo })]);
      expect(d.eligible).toBe(false);
    }
  });

  it('id 형식이 이상하면 사람이 확인한다', () => {
    for (const id of ['b\nc', 'b c', '', 'b/c', 'a'.repeat(101)]) {
      const d = run([entry()], [entry(), entry({ id, url: 'https://b.ycseng.com', repo: `side-projects-labs/${id}` })]);
      expect(d.eligible).toBe(false);
    }
  });

  it('이름·설명에 줄바꿈이나 제어 문자가 있거나 너무 길면 사람이 확인한다', () => {
    expect(run([entry()], [entry({ description: '줄\n바꿈' })]).eligible).toBe(false);
    expect(run([entry()], [entry({ name: '탭\t이름' })]).eligible).toBe(false);
    expect(run([entry()], [entry({ name: 'n'.repeat(61) })]).eligible).toBe(false);
    expect(run([entry()], [entry({ description: 'd'.repeat(201) })]).eligible).toBe(false);
  });

  it('항목이 50개를 넘으면 사람이 확인한다', () => {
    const many = Array.from({ length: 51 }, (_, i) => entry({ id: `p${i}`, url: `https://p${i}.ycseng.com`, repo: `side-projects-labs/p${i}` }));
    expect(run(many.slice(0, 50), many).eligible).toBe(false);
  });

  it('여러 사유가 있으면 모두 알려 준다', () => {
    const d = run(
      [entry(), entry({ id: 'b', url: 'https://b.ycseng.com', repo: 'side-projects-labs/b' })],
      [entry({ url: 'https://other.ycseng.com' })],
      { changedFiles: [...FILES, 'README.md'] },
    );
    expect(d.eligible).toBe(false);
    expect(d.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe('buildReviewBody', () => {
  const ok = { eligible: true, reasons: [], summary: { added: ['b'], changed: ['a'], removed: [] } };

  it('게이트가 읽는 마커와 승인 판정을 담고 치명·중요 지적 줄은 없다', () => {
    const body = buildReviewBody(ok);
    expect(body).toContain('<!-- code-review -->');
    expect(body).toMatch(/^판정: 승인$/m);
    expect(body).not.toMatch(/^\s*-\s*\[(치명|중요)\]/m);
    expect(body).not.toContain('수정 필요');
  });

  it('자동 검증 리뷰이며 사람이 검토하지 않았다는 점과 추가·변경 id를 적는다', () => {
    const body = buildReviewBody(ok);
    expect(body).toContain('자동');
    expect(body).toContain('사람이 검토하지 않');
    expect(body).toContain('b');
    expect(body).toContain('a');
  });

  it('대상이 아닌 결정으로는 승인 리뷰를 만들지 않는다', () => {
    expect(() => buildReviewBody({ eligible: false, reasons: ['x'], summary: { added: [], changed: [], removed: [] } })).toThrow();
  });
});

describe('catalog-sync.ts와의 동등성', () => {
  it('서비스 URL 검증이 catalog-sync의 isValidServiceUrl과 같은 결과를 낸다', () => {
    for (const url of [
      'https://a.ycseng.com',
      'https://a.ycseng.com/path?q=1',
      'http://a.ycseng.com',
      'https://user:pw@a.ycseng.com',
      'https://user@a.ycseng.com',
      'ftp://a.ycseng.com',
      'javascript:alert(1)',
      'not a url',
      '',
    ]) {
      expect(isHttpsServiceUrl(url), url).toBe(isValidServiceUrl(url));
    }
  });

  it('차이 계산이 catalog-sync의 diffCatalog와 같은 결과를 낸다', () => {
    const base = [entry(), entry({ id: 'b', url: 'https://b.ycseng.com', repo: 'side-projects-labs/b' }), entry({ id: 'c', url: 'https://c.ycseng.com', repo: 'side-projects-labs/c' })];
    const head = [entry({ description: '바뀜' }), entry({ id: 'c', url: 'https://c.ycseng.com', repo: 'side-projects-labs/c' }), entry({ id: 'd', url: 'https://d.ycseng.com', repo: 'side-projects-labs/d' })];
    expect(run(base, head).summary).toEqual(diffCatalog(base, head));
  });
});

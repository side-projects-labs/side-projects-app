import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const CLI = fileURLToPath(new URL('../../../scripts/catalog-auto-merge.mjs', import.meta.url));
const NODE_FLAGS = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];

type P = { id: string; name: string; description: string; icon: string; url: string; repo?: string; allowedHosts?: string[] };
const project = (id: string, over: Partial<P> = {}): P => ({
  id,
  name: id.toUpperCase(),
  description: `설명 ${id}`,
  icon: '📦',
  url: `https://${id}.ycseng.com`,
  repo: `side-projects-labs/${id}`,
  ...over,
});
const catalog = (projects: P[]) => JSON.stringify({ version: 1, projects }, null, 2) + '\n';
const POLICY = JSON.stringify({ allowedUrlHosts: ['ycseng.com', '*.ycseng.com'] }) + '\n';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });

/** master에 base를 커밋하고, 브랜치에서 head를 커밋한 임시 저장소를 만든다. */
function setup(opts: { base: P[]; head: P[]; policy?: string | null; extraFile?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), 'catalog-auto-merge-'));
  dirs.push(dir);
  git(dir, 'init', '-q', '-b', 'master');
  mkdirSync(join(dir, 'catalog'));
  writeFileSync(join(dir, 'catalog/projects.json'), catalog(opts.base));
  if (opts.policy !== null) writeFileSync(join(dir, 'catalog/auto-merge-policy.json'), opts.policy ?? POLICY);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'checkout', '-q', '-b', 'ci/1-catalog-sync');
  writeFileSync(join(dir, 'catalog/projects.json'), catalog(opts.head));
  if (opts.extraFile) writeFileSync(join(dir, 'README.md'), 'x');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'head');
  return dir;
}

function run(dir: string) {
  const review = join(dir, '.review.md');
  const comment = join(dir, '.comment.md');
  const r = spawnSync(process.execPath, [...NODE_FLAGS, CLI, '--base-ref', 'master', '--review-out', review, '--comment-out', comment], {
    cwd: dir,
    encoding: 'utf8',
  });
  return {
    code: r.status,
    stdout: r.stdout,
    review: existsSync(review) ? readFileSync(review, 'utf8') : null,
    comment: existsSync(comment) ? readFileSync(comment, 'utf8') : null,
  };
}

describe('scripts/catalog-auto-merge.mjs', () => {
  it('허용 조건의 새 프로젝트 추가면 0으로 끝나고 승인 리뷰 본문을 만든다', () => {
    const dir = setup({ base: [project('a')], head: [project('a'), project('b')] });
    const r = run(dir);
    expect(r.code).toBe(0);
    expect(r.review).toContain('<!-- code-review -->');
    expect(r.review).toMatch(/^판정: 승인$/m);
    expect(r.review).toContain('b');
    expect(r.comment).toBeNull();
    expect(JSON.parse(r.stdout)).toMatchObject({ eligible: true, summary: { added: ['b'] } });
  });

  it('삭제가 있으면 3으로 끝나고 승인 리뷰 없이 사유 코멘트를 만든다', () => {
    const dir = setup({ base: [project('a'), project('b')], head: [project('a')] });
    const r = run(dir);
    expect(r.code).toBe(3);
    expect(r.review).toBeNull();
    expect(r.comment).toContain('b');
    expect(r.comment).toContain('사람이 확인');
  });

  it('프로젝트 파일 말고 다른 파일도 바뀌었으면 3이다', () => {
    const dir = setup({ base: [project('a')], head: [project('a'), project('b')], extraFile: true });
    expect(run(dir).code).toBe(3);
  });

  it('master에 정책 파일이 없으면 자동 병합하지 않고 3이다', () => {
    const dir = setup({ base: [project('a')], head: [project('a'), project('b')], policy: null });
    const r = run(dir);
    expect(r.code).toBe(3);
    expect(r.comment).toContain('정책');
  });

  it('정책 파일이 올바르지 않으면 3이다', () => {
    const dir = setup({ base: [project('a')], head: [project('a'), project('b')], policy: '{"allowedUrlHosts":["*"]}' });
    expect(run(dir).code).toBe(3);
  });

  it('PR이 정책 파일을 바꿔 자기 주소를 허용시키려 해도 사람이 확인한다', () => {
    const dir = setup({ base: [project('a')], head: [project('a'), project('b', { url: 'https://b.evil.example.com' })] });
    writeFileSync(join(dir, 'catalog/auto-merge-policy.json'), JSON.stringify({ allowedUrlHosts: ['*.evil.example.com'] }));
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'policy change');
    // 변경 파일이 둘이라 막힌다. 정책을 master에서 읽는 것은 이 규칙과 겹치는 방어(둘 중 하나가 약해져도 막히게)이며,
    // 결과만으로는 구분되지 않으므로 이 테스트는 "정책을 PR에서 바꿔 우회할 수 없다"는 결과를 보장한다.
    const r = run(dir);
    expect(r.code).toBe(3);
    expect(r.review).toBeNull();
  });

  it('카탈로그 JSON이 깨졌으면 오류(1)로 끝난다', () => {
    const dir = setup({ base: [project('a')], head: [project('a', { description: '바뀐 설명' })] });
    writeFileSync(join(dir, 'catalog/projects.json'), '{not json');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'broken');
    expect(run(dir).code).toBe(1);
  });
});

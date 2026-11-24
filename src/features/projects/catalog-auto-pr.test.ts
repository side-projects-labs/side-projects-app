import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = join(ROOT, '.github/scripts/catalog-auto-pr.sh');
const CLI = join(ROOT, 'scripts/catalog-auto-merge.mjs');
const BRANCH = 'ci/12-catalog-sync';

type P = { id: string; name: string; description: string; icon: string; url: string; repo?: string };
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

/** 원격(bare)과 작업 복제본을 만들고, master에 base 카탈로그와 정책을 올린다. */
function setup(base: P[]) {
  const root = mkdtempSync(join(tmpdir(), 'catalog-auto-pr-'));
  dirs.push(root);
  const remote = join(root, 'remote.git');
  const work = join(root, 'work');
  const bin = join(root, 'bin');
  mkdirSync(bin);
  git(root, 'init', '-q', '--bare', '-b', 'master', remote);
  git(root, 'clone', '-q', remote, work);
  git(work, 'checkout', '-q', '-b', 'master');
  mkdirSync(join(work, 'catalog'));
  writeFileSync(join(work, 'catalog/projects.json'), catalog(base));
  writeFileSync(join(work, 'catalog/auto-merge-policy.json'), POLICY);
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'base');
  git(work, 'push', '-q', '-u', 'origin', 'master');

  const log = join(root, 'calls.log');
  writeFileSync(log, '');
  // gh 스텁: 호출을 기록하고, 환경변수로 동작을 바꾼다.
  const gh = join(bin, 'gh');
  writeFileSync(
    gh,
    `#!/usr/bin/env bash
echo "gh $*" >> "$STUB_LOG"
prev=""
for a in "$@"; do
  if [ "$prev" = "--body-file" ]; then cp "$a" "$STUB_LOG.body"; fi
  prev="$a"
done
case "$1 $2" in
  "pr list") printf '%s' "\${STUB_PR_NUMBER:-}" ;;
  "pr create") echo "https://example.test/pull/7" ;;
  "pr view") case "$*" in *autoMergeRequest*) echo "\${STUB_AUTO_MERGE:-false}" ;; *) echo 7 ;; esac ;;
  "pr merge") [ -n "\${STUB_MERGE_FAIL:-}" ] && { echo "auto merge is not allowed" >&2; exit 1; } ;;
esac
exit 0
`,
  );
  chmod(gh);
  const post = join(bin, 'post-review.sh');
  writeFileSync(post, `#!/usr/bin/env bash\necho "post-review $1" >> "$STUB_LOG"\ncp "$2" "$STUB_LOG.review"\n`);
  chmod(post);

  const edit = (projects: P[]) => writeFileSync(join(work, 'catalog/projects.json'), catalog(projects));
  const calls = () => readFileSync(log, 'utf8');
  const run = (env: Record<string, string> = {}) => {
    const r = spawnSync('bash', [SCRIPT], {
      cwd: work,
      encoding: 'utf8',
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: root,
        ISSUE_NUMBER: '12',
        GH_TOKEN: 'fake-token-value',
        STUB_LOG: log,
        CATALOG_AUTO_MERGE_CLI: CLI,
        POST_REVIEW_SCRIPT: post,
        ...env,
      } as unknown as NodeJS.ProcessEnv,
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const remoteBranch = () => {
    try {
      return git(remote, 'rev-parse', '--verify', `refs/heads/${BRANCH}`).trim();
    } catch {
      return null;
    }
  };
  const body = () => (existsSync(`${log}.body`) ? readFileSync(`${log}.body`, 'utf8') : null);
  return { work, remote, edit, calls, run, remoteBranch, body, review: () => (existsSync(`${log}.review`) ? readFileSync(`${log}.review`, 'utf8') : null) };
}

function chmod(path: string) {
  chmodSync(path, 0o755);
}

describe('.github/scripts/catalog-auto-pr.sh', () => {
  it('카탈로그에 차이가 없으면 아무것도 하지 않는다', () => {
    const t = setup([project('a')]);
    const r = t.run();
    expect(r.code).toBe(0);
    expect(t.remoteBranch()).toBeNull();
    expect(t.calls()).toBe('');
  });

  it('허용 조건의 추가면 브랜치를 푸시하고 PR을 만든 뒤 승인 리뷰를 남기고 자동 병합을 예약한다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    const r = t.run();
    expect(r.code).toBe(0);
    expect(t.remoteBranch()).not.toBeNull();
    expect(git(t.remote, 'show', `${BRANCH}:catalog/projects.json`)).toContain('"id": "b"');
    expect(git(t.remote, 'log', '-1', '--format=%B', BRANCH)).toContain('Refs #12');
    const calls = t.calls();
    expect(calls).toContain('gh pr create');
    expect(calls).toContain('--head ci/12-catalog-sync');
    expect(calls).toContain('post-review 7');
    expect(calls).toMatch(/gh pr merge 7 --auto --merge/);
    expect(calls).not.toContain('gh pr comment');
    expect(t.review()).toContain('<!-- code-review -->');
    expect(r.out).not.toContain('fake-token-value');
  });

  it('PR 본문은 템플릿의 모든 절을 채우고 이슈를 Refs로만 가리킨다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    t.run();
    const body = t.body() ?? '';
    for (const heading of ['## 설명', '## 관련 이슈', '## 변경사항', '## 체크리스트', '## 검증 결과', '## 한계와 확인하지 못한 것']) {
      expect(body).toContain(heading);
    }
    expect(body).toContain('Refs #12');
    expect(body).not.toMatch(/\b(Fixes|Closes|Resolves)\b/i);
    expect(body).toContain('b');
  });

  it('허용되지 않는 변경(삭제)이면 PR만 만들고 사유 코멘트를 남기며 리뷰와 병합은 하지 않는다', () => {
    const t = setup([project('a'), project('b')]);
    t.edit([project('a')]);
    const r = t.run();
    expect(r.code).toBe(0);
    const calls = t.calls();
    expect(calls).toContain('gh pr create');
    expect(calls).toContain('gh pr comment 7');
    expect(calls).not.toContain('post-review');
    expect(calls).not.toContain('gh pr merge');
    expect(t.review()).toBeNull();
  });

  it('자동 병합 예약이 실패하면 오류로 끝나고 allow_auto_merge 설정을 안내한다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    const r = t.run({ STUB_MERGE_FAIL: '1' });
    expect(r.code).toBe(1);
    expect(r.out).toContain('allow_auto_merge');
  });

  it('같은 내용의 갱신 브랜치와 열린 PR이 이미 있으면 다시 푸시하거나 리뷰하지 않는다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    expect(t.run().code).toBe(0);
    const first = t.remoteBranch();

    git(t.work, 'checkout', '-q', 'master');
    t.edit([project('a'), project('b')]);
    const before = t.calls();
    const r = t.run({ STUB_PR_NUMBER: '7', STUB_AUTO_MERGE: 'true' });
    expect(r.code).toBe(0);
    expect(first).not.toBeNull();
    expect(t.remoteBranch()).toBe(first);
    const added = t.calls().slice(before.length);
    expect(added).not.toContain('gh pr create');
    expect(added).not.toContain('post-review');
    expect(added).not.toContain('gh pr merge');
    expect(added).not.toContain('gh pr comment');
  });

  it('같은 내용이고 PR이 있어도 자동 병합이 예약되지 않았다면(설정을 고친 다음 날 등) 다시 예약한다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    expect(t.run({ STUB_MERGE_FAIL: '1' }).code).toBe(1);
    const first = t.remoteBranch();

    git(t.work, 'checkout', '-q', 'master');
    t.edit([project('a'), project('b')]);
    const before = t.calls();
    const r = t.run({ STUB_PR_NUMBER: '7', STUB_AUTO_MERGE: 'false' });
    expect(r.code).toBe(0);
    expect(t.remoteBranch()).toBe(first);
    const added = t.calls().slice(before.length);
    expect(added).not.toContain('gh pr create');
    expect(added).toContain('post-review 7');
    expect(added).toMatch(/gh pr merge 7 --auto --merge/);
  });

  it('PR이 이미 있고 내용이 바뀌었으면 브랜치를 갱신하고 PR을 새로 만들지 않는다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    expect(t.run().code).toBe(0);
    const first = t.remoteBranch();

    git(t.work, 'checkout', '-q', 'master');
    t.edit([project('a'), project('b'), project('c')]);
    const before = t.calls();
    const r = t.run({ STUB_PR_NUMBER: '7' });
    expect(r.code).toBe(0);
    expect(t.remoteBranch()).not.toBe(first);
    const added = t.calls().slice(before.length);
    expect(added).not.toContain('gh pr create');
    expect(added).toContain('gh pr edit 7');
    expect(added).toContain('post-review 7');
  });

  it('ISSUE_NUMBER가 없으면 오류로 끝난다', () => {
    const t = setup([project('a')]);
    t.edit([project('a'), project('b')]);
    const r = t.run({ ISSUE_NUMBER: '' });
    expect(r.code).toBe(1);
    expect(t.remoteBranch()).toBeNull();
  });
});

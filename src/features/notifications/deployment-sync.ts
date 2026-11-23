import type { HistoryItem } from './history';

/**
 * 배포 이력을 알림 수신과 무관하게 채우기 위한 동기화(순수 로직).
 * 앱이 꺼져 있는 동안 도착해 알림 센터에서 지워진 알림은 이력에 남지 않으므로, GitHub Deployments의 공개 기록을
 * 앱이 열릴 때 읽어 보충한다. 비밀 값을 앱에 두지 않으려고 토큰 없이 읽을 수 있는 공개 저장소만 대상으로 한다.
 * 저장소 이름은 원격 카탈로그에서 오는 신뢰할 수 없는 값이라 요청 전에 형식을 검증한다.
 */

export type SyncState = 'success' | 'failure' | 'error';
export type SyncStatus = { state: SyncState; at: number };
/** 이미 확정된 배포의 최종 상태 캐시. 요청 한도를 아끼려고 확정된 상태는 다시 조회하지 않는다. */
export type SyncCache = { final: Record<string, SyncStatus> };
export type SyncDeployment = { id: number; ref: string; createdAt: number };
export type SyncProject = { id: string; repo?: string };

const API = 'https://api.github.com';
const HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
/** 목록에서 Production만 남기므로 Preview가 섞여도 최근 Production을 놓치지 않게 넉넉히 받는다. */
const LIST_PER_PAGE = 30;
/** 저장소마다 최근 Production 배포 몇 건까지 이력으로 만든다. */
const MAX_DEPLOYMENTS = 5;
const MAX_PROJECTS = 20;
/** 배포의 상태 이력에서 최종 상태를 찾을 만큼만 받는다(pending → in_progress → success → inactive 순으로 쌓인다). */
const STATUS_PER_PAGE = 10;
/** 비인증 요청은 시간당 60회라 동기화 간격을 둔다. */
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;
/** 알림으로 이미 받은 같은 배포를 합치는 시간 범위. 알림과 GitHub 기록의 시각이 몇 분 어긋날 수 있다. */
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CACHE = 200;
const TIMEOUT_MS = 8000;

const REPO_SEGMENT = /^[A-Za-z0-9_.-]+$/;
const FINAL_STATES: readonly string[] = ['success', 'failure', 'error'];

/** `소유자/이름` 형식만 허용한다. `..`처럼 경로를 바꾸는 값, 슬래시가 더 있는 값은 거절한다. */
export function isValidRepo(repo: unknown): repo is string {
  if (typeof repo !== 'string') return false;
  const parts = repo.split('/');
  return parts.length === 2 && parts.every((s) => REPO_SEGMENT.test(s) && !/^\.+$/.test(s));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 배포 목록 응답에서 최근 Production 배포만 검증해 남긴다. */
export function parseDeployments(data: unknown): SyncDeployment[] {
  if (!Array.isArray(data)) return [];
  const result: SyncDeployment[] = [];
  for (const raw of data) {
    if (!isObject(raw)) continue;
    const { id, ref, environment, created_at: createdAt } = raw;
    if (!Number.isInteger(id) || typeof ref !== 'string' || ref.length === 0) continue;
    if (typeof environment !== 'string' || !environment.startsWith('Production')) continue;
    const at = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
    if (!Number.isFinite(at)) continue;
    result.push({ id: id as number, ref, createdAt: at });
    if (result.length >= MAX_DEPLOYMENTS) break;
  }
  return result;
}

/**
 * 상태 목록(최신순)에서 가장 최근의 확정 상태(성공·실패·오류)를 돌려준다. 확정 상태가 없으면(진행 중) null.
 * 새 배포가 성공하면 이전 배포에 `inactive`가 덧붙을 수 있어 첫 항목만 보면 끝난 배포를 놓치고 매번 다시 조회하게 된다.
 */
export function parseLatestStatus(data: unknown): SyncStatus | null {
  if (!Array.isArray(data)) return null;
  for (const raw of data) {
    if (!isObject(raw)) continue;
    const { state, created_at: createdAt } = raw;
    if (typeof state !== 'string' || !FINAL_STATES.includes(state)) continue;
    const at = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
    if (!Number.isFinite(at)) continue;
    return { state: state as SyncState, at };
  }
  return null;
}

/**
 * 푸시 알림(`notify-deployment.yml`)과 같은 규칙으로 이력 항목을 만든다. eventId는 `<레포>-deployment-<id>-<상태>`이고
 * 해시처럼 보이는 ref는 7자로 줄인다. 알림으로 받은 같은 배포와 eventId가 같아 한 건으로 합쳐진다.
 */
export function toSyncedItem(
  repo: string,
  projectId: string,
  d: Pick<SyncDeployment, 'id' | 'ref'>,
  status: SyncStatus,
): HistoryItem {
  const ok = status.state === 'success';
  const detail = /^[0-9a-f]{40}$/.test(d.ref) ? d.ref.slice(0, 7) : d.ref.slice(0, 40);
  return {
    eventId: `${repo}-deployment-${d.id}-${status.state}`,
    projectId,
    status: ok ? 'succeeded' : 'failed',
    title: ok ? '✅ 배포 완료' : '❌ 배포 실패',
    body: `${projectId} · ${detail}`,
    receivedAt: status.at,
  };
}

/** GitHub 배포 기록과 같은 eventId 규칙(`<레포>-deployment-<id>-<상태>`)이면 eventId만으로 정확히 합쳐진다. */
const hasDeploymentEventId = (item: HistoryItem): boolean => item.eventId.includes('-deployment-');

/**
 * 이미 이력에 있는 같은 배포를 건너뛴다. 알림의 eventId 규칙이 GitHub 기록과 다른 저장소(Actions 실행 기준)는
 * eventId로 합쳐지지 않으므로, 같은 프로젝트·상태가 가까운 시각에 있으면 같은 배포로 본다.
 * eventId로 정확히 합쳐지는 항목은 대상에서 뺀다. 그렇지 않으면 15분 안의 연속 배포가 누락된다.
 */
export function dedupeAgainst(existing: readonly HistoryItem[], synced: readonly HistoryItem[]): HistoryItem[] {
  const candidates = existing.filter((e) => !hasDeploymentEventId(e));
  return synced.filter(
    (s) =>
      !candidates.some(
        (e) => e.projectId === s.projectId && e.status === s.status && Math.abs(e.receivedAt - s.receivedAt) <= DEDUPE_WINDOW_MS,
      ),
  );
}

/** 마지막 동기화 뒤 간격이 지났으면 true. 기록된 시각이 미래면(기기 시계 변경) 멈추지 않고 true. */
export function shouldSync(lastSyncAt: number | undefined, now: number): boolean {
  if (lastSyncAt === undefined || lastSyncAt > now) return true;
  return now - lastSyncAt >= SYNC_INTERVAL_MS;
}

type Fetched = { kind: 'ok'; data: unknown } | { kind: 'skip' } | { kind: 'abort' };

async function getJson(url: string, fetchImpl: typeof fetch): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: HEADERS, signal: controller.signal });
    // 요청 한도에 걸렸으면 이어서 보내봐야 같은 응답이라 전체를 멈춘다.
    if (res.status === 403 || res.status === 429) return { kind: 'abort' };
    if (!res.ok) return { kind: 'skip' };
    return { kind: 'ok', data: await res.json() };
  } catch {
    // 오프라인·시간 초과·잘못된 JSON. 기능 저하로만 처리하고 앱이 죽지 않게 한다.
    return { kind: 'abort' };
  } finally {
    clearTimeout(timer);
  }
}

function trim(cache: SyncCache['final']): SyncCache['final'] {
  const keys = Object.keys(cache);
  if (keys.length <= MAX_CACHE) return cache;
  return Object.fromEntries(keys.slice(keys.length - MAX_CACHE).map((k) => [k, cache[k]]));
}

/**
 * 카탈로그의 저장소들에서 최근 Production 배포의 최종 상태를 읽어 이력 항목으로 만든다.
 * 요청이 한도·네트워크 오류로 막히면 거기서 멈추고 그때까지의 결과를 돌려준다.
 */
export async function collectDeploymentItems(
  projects: readonly SyncProject[],
  cache: SyncCache,
  fetchImpl: typeof fetch,
): Promise<{ items: HistoryItem[]; cache: SyncCache }> {
  const final = { ...cache.final };
  const items: HistoryItem[] = [];

  outer: for (const p of projects.slice(0, MAX_PROJECTS)) {
    if (!isValidRepo(p.repo)) continue;
    const repo = p.repo;
    const path = repo.split('/').map(encodeURIComponent).join('/');

    const listed = await getJson(`${API}/repos/${path}/deployments?per_page=${LIST_PER_PAGE}`, fetchImpl);
    if (listed.kind === 'abort') break;
    if (listed.kind === 'skip') continue;

    for (const d of parseDeployments(listed.data)) {
      const key = `${repo}#${d.id}`;
      let status = final[key];
      if (!status) {
        const res = await getJson(`${API}/repos/${path}/deployments/${d.id}/statuses?per_page=${STATUS_PER_PAGE}`, fetchImpl);
        if (res.kind === 'abort') break outer;
        if (res.kind === 'skip') continue;
        const parsed = parseLatestStatus(res.data);
        if (!parsed) continue;
        final[key] = parsed;
        status = parsed;
      }
      items.push(toSyncedItem(repo, p.id, d, status));
    }
  }

  return { items, cache: { final: trim(final) } };
}

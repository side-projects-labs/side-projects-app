export type LoginResetSteps = {
  /** 대기 중인 마지막 페이지 저장을 버린다. */
  cancelPendingSave: () => void;
  /** 열려 있는 WebView의 메모리 캐시를 지운다. */
  clearWebViewCache: () => void;
  /** 로그인 쿠키를 지운다. 일부 실패해도 던지지 않고 실패 개수를 돌려주는 계약이다. */
  resetCookies: () => Promise<{ failed: number }>;
  /** 저장된 마지막 방문 페이지를 지운다. */
  clearLastVisit: () => Promise<void>;
  /** 처음 주소로 WebView를 새로 만든다. */
  restartWebView: () => void;
  /** 일부 항목을 지우지 못했음을 사용자에게 알린다. */
  warnPartialFailure: () => void;
};

/**
 * 프로젝트의 로그인 초기화 순서. 순서가 어긋나면 초기화한 뒤에 옛 주소가 다시 저장되거나(이어서 보기가 옛 주소로 열림)
 * 아직 지워지는 중인 쿠키로 WebView가 다시 열리므로, 화면에서 떼어 호출 순서를 테스트할 수 있게 한다.
 *
 * 1. 대기 중인 저장을 버린다. 2. 캐시를 지운다. 3. 쿠키를 지운다. 4. 마지막 방문을 지운다.
 * 5. 쿠키·방문을 지우는 동안 이전 WebView의 이동으로 새로 예약된 저장을 한 번 더 버린다.
 * 6. WebView를 다시 시작하고, 지우지 못한 항목이 있으면 그 뒤에 알린다.
 */
export async function runLoginReset(steps: LoginResetSteps): Promise<{ failed: number }> {
  steps.cancelPendingSave();
  steps.clearWebViewCache();
  const result = await steps.resetCookies();
  await steps.clearLastVisit();
  steps.cancelPendingSave();
  steps.restartWebView();
  if (result.failed > 0) steps.warnPartialFailure();
  return { failed: result.failed };
}

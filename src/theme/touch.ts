/**
 * 터치 요소의 최소 영역(dp). iOS 가이드라인 44pt를 따른다. Android 권장은 48dp라 필요하면 `min`으로 바꿀 수 있다.
 */
export const MIN_TOUCH_TARGET = 44;

function assertSize(size: number): void {
  if (!Number.isFinite(size) || size <= 0) throw new Error(`요소 크기가 올바르지 않습니다: ${size}`);
}

/**
 * 크기가 `size`인 요소의 터치 영역이 `min` 이상이 되도록 한쪽 가장자리에 더할 `hitSlop` 값.
 * 홀수 부족분은 올림해서 항상 최소 영역을 채운다. 이미 충분히 크면 0이다.
 */
export function hitSlopFor(size: number, min: number = MIN_TOUCH_TARGET): number {
  assertSize(size);
  return Math.max(0, Math.ceil((min - size) / 2));
}

/**
 * 크기가 `size`인 요소들이 나란히 놓일 때, 확장된 터치 영역이 서로 겹치지 않는 최소 간격.
 * 겹치면 두 버튼 사이를 누를 때 어느 쪽이 반응할지 알 수 없다.
 */
export function minGapFor(size: number, min: number = MIN_TOUCH_TARGET): number {
  return 2 * hitSlopFor(size, min);
}

/**
 * 높이가 `height`인 글자 버튼·칩의 위아래에 더할 `hitSlop`. 가로는 이미 충분히 넓은 요소에 쓰며 모양은 바꾸지 않는다.
 * 줄 바꿈으로 위아래에 다른 요소가 오면 그 간격을 `minGapFor(height)` 이상으로 둔다.
 */
export function verticalHitSlop(height: number, min: number = MIN_TOUCH_TARGET): { top: number; bottom: number } {
  const slop = hitSlopFor(height, min);
  return { top: slop, bottom: slop };
}

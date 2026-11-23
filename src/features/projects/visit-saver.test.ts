import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVisitSaver } from './visit-saver';

const DELAY = 800;
const visit = (url: string, projectId = 'p') => ({ projectId, url });

describe('createVisitSaver', () => {
  const save = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    save.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('주소를 기억해 두고 지연 시간이 지나면 한 번 저장한다', () => {
    const saver = createVisitSaver(save, DELAY);

    saver.schedule(visit('https://a.example.com/1'));
    vi.advanceTimersByTime(DELAY - 1);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(visit('https://a.example.com/1'));
  });

  it('지연 시간 안에 주소가 계속 바뀌면 마지막 주소만 저장한다', () => {
    const saver = createVisitSaver(save, DELAY);

    saver.schedule(visit('https://a.example.com/1'));
    vi.advanceTimersByTime(500);
    saver.schedule(visit('https://a.example.com/2'));
    vi.advanceTimersByTime(500);
    saver.schedule(visit('https://a.example.com/3'));
    vi.advanceTimersByTime(DELAY);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(visit('https://a.example.com/3'));
  });

  it('바로 전에 기억한 주소와 같은 주소는 무시하고 타이머를 다시 시작하지 않는다', () => {
    const saver = createVisitSaver(save, DELAY);

    saver.schedule(visit('https://a.example.com/1'));
    vi.advanceTimersByTime(500);
    saver.schedule(visit('https://a.example.com/1'));
    vi.advanceTimersByTime(300);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('이미 저장한 주소를 다시 알려도 또 저장하지 않는다', () => {
    const saver = createVisitSaver(save, DELAY);
    saver.schedule(visit('https://a.example.com/1'));
    vi.advanceTimersByTime(DELAY);

    saver.schedule(visit('https://a.example.com/1'));
    vi.advanceTimersByTime(DELAY);

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('다른 주소로 갔다가 돌아오면(A→B→A) 마지막인 A를 한 번 저장한다', () => {
    const saver = createVisitSaver(save, DELAY);

    saver.schedule(visit('https://a.example.com/A'));
    saver.schedule(visit('https://a.example.com/B'));
    saver.schedule(visit('https://a.example.com/A'));
    vi.advanceTimersByTime(DELAY);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(visit('https://a.example.com/A'));
  });

  describe('flush', () => {
    it('대기 중인 값을 기다리지 않고 바로 저장하고 타이머를 정리한다', () => {
      const saver = createVisitSaver(save, DELAY);
      saver.schedule(visit('https://a.example.com/1'));

      saver.flush();

      expect(save).toHaveBeenCalledWith(visit('https://a.example.com/1'));
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(DELAY * 2);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('대기 중인 값이 없으면 아무것도 하지 않는다', () => {
      const saver = createVisitSaver(save, DELAY);

      saver.flush();

      expect(save).not.toHaveBeenCalled();
    });

    it('두 번 불러도 한 번만 저장한다', () => {
      const saver = createVisitSaver(save, DELAY);
      saver.schedule(visit('https://a.example.com/1'));

      saver.flush();
      saver.flush();

      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('forget', () => {
    it('대기 중인 값을 저장하지 않고 버린다(로그인 초기화 직후 옛 주소가 다시 저장되지 않게)', () => {
      const saver = createVisitSaver(save, DELAY);
      saver.schedule(visit('https://a.example.com/1'));

      saver.forget();
      vi.advanceTimersByTime(DELAY * 2);

      expect(save).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('이미 저장한 주소도 잊어서 같은 주소를 다시 저장할 수 있다', () => {
      const saver = createVisitSaver(save, DELAY);
      saver.schedule(visit('https://a.example.com/1'));
      vi.advanceTimersByTime(DELAY);

      saver.forget();
      saver.schedule(visit('https://a.example.com/1'));
      vi.advanceTimersByTime(DELAY);

      expect(save).toHaveBeenCalledTimes(2);
    });

    it('버린 뒤에 flush해도 저장하지 않는다', () => {
      const saver = createVisitSaver(save, DELAY);
      saver.schedule(visit('https://a.example.com/1'));

      saver.forget();
      saver.flush();

      expect(save).not.toHaveBeenCalled();
    });
  });

  it('저장 함수가 예외를 던져도 타이머가 쌓이지 않고 다음 저장이 동작한다', () => {
    save.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const saver = createVisitSaver(save, DELAY);
    saver.schedule(visit('https://a.example.com/1'));

    expect(() => vi.advanceTimersByTime(DELAY)).not.toThrow();
    saver.schedule(visit('https://a.example.com/2'));
    vi.advanceTimersByTime(DELAY);

    expect(save).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

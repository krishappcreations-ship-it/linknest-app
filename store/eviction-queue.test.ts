import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evictionQueue } from "./eviction-queue";
import { asBookmarkId } from "@/types";

describe("evictionQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    evictionQueue.clear();
  });
  afterEach(() => {
    evictionQueue.clear();
    vi.useRealTimers();
  });

  it("schedule fires callback after delayMs", async () => {
    const cb = vi.fn();
    evictionQueue.schedule(asBookmarkId("a"), 5000, cb);
    expect(cb).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4999);
    expect(cb).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("cancel before fire prevents callback", async () => {
    const cb = vi.fn();
    evictionQueue.schedule(asBookmarkId("a"), 5000, cb);
    expect(evictionQueue.cancel(asBookmarkId("a"))).toBe(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(cb).not.toHaveBeenCalled();
  });

  it("cancel returns false for unknown id", () => {
    expect(evictionQueue.cancel(asBookmarkId("ghost"))).toBe(false);
  });

  it("schedule replaces prior timer for same id", async () => {
    const first = vi.fn();
    const second = vi.fn();
    evictionQueue.schedule(asBookmarkId("a"), 5000, first);
    evictionQueue.schedule(asBookmarkId("a"), 5000, second);
    await vi.advanceTimersByTimeAsync(5000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("flush cancels timer without firing", async () => {
    const cb = vi.fn();
    evictionQueue.schedule(asBookmarkId("a"), 5000, cb);
    await evictionQueue.flush(asBookmarkId("a"));
    await vi.advanceTimersByTimeAsync(10000);
    expect(cb).not.toHaveBeenCalled();
    expect(evictionQueue.has(asBookmarkId("a"))).toBe(false);
  });

  it("has reflects pending state", async () => {
    expect(evictionQueue.has(asBookmarkId("a"))).toBe(false);
    evictionQueue.schedule(asBookmarkId("a"), 5000, () => {});
    expect(evictionQueue.has(asBookmarkId("a"))).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(evictionQueue.has(asBookmarkId("a"))).toBe(false);
  });

  it("size tracks pending count, clear empties", () => {
    evictionQueue.schedule(asBookmarkId("a"), 5000, () => {});
    evictionQueue.schedule(asBookmarkId("b"), 5000, () => {});
    expect(evictionQueue.size()).toBe(2);
    evictionQueue.clear();
    expect(evictionQueue.size()).toBe(0);
  });
});

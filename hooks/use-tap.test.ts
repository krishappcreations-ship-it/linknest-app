import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTap } from "./use-tap";
import type React from "react";

function pointer(x: number, y: number) {
  return { clientX: x, clientY: y } as React.PointerEvent;
}
function click() {
  return {} as React.MouseEvent;
}

describe("useTap", () => {
  it("fires onTap for a click with no pointer movement", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTap(onTap));
    result.current.onPointerDown(pointer(100, 100));
    result.current.onPointerMove(pointer(103, 102)); // < threshold
    result.current.onClick(click());
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("swallows the click when the pointer moved past the threshold (a scroll)", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTap(onTap));
    result.current.onPointerDown(pointer(100, 100));
    result.current.onPointerMove(pointer(100, 140)); // 40px vertical scroll
    result.current.onClick(click());
    expect(onTap).not.toHaveBeenCalled();
  });

  it("resets between gestures so a later real tap fires", () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTap(onTap));
    // first gesture: scroll → swallowed
    result.current.onPointerDown(pointer(0, 0));
    result.current.onPointerMove(pointer(0, 50));
    result.current.onClick(click());
    // second gesture: clean tap → fires
    result.current.onPointerDown(pointer(0, 0));
    result.current.onClick(click());
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

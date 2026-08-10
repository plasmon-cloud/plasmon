import { expect, test } from "bun:test";
import { subscribeForegroundRefresh } from "./lifecycle.ts";

class FakeTarget {
  visibilityState = "visible";
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
  }
}

test("foreground lifecycle refreshes on focus/pageshow/visible document only", () => {
  const windowTarget = new FakeTarget();
  const documentTarget = new FakeTarget();
  let calls = 0;
  const unsubscribe = subscribeForegroundRefresh(
    () => { calls += 1; },
    { windowTarget, documentTarget },
  );

  windowTarget.dispatch("focus");
  windowTarget.dispatch("pageshow");
  documentTarget.visibilityState = "hidden";
  documentTarget.dispatch("visibilitychange");
  documentTarget.visibilityState = "visible";
  documentTarget.dispatch("visibilitychange");
  expect(calls).toBe(3);

  unsubscribe();
  windowTarget.dispatch("focus");
  documentTarget.dispatch("visibilitychange");
  expect(calls).toBe(3);
});

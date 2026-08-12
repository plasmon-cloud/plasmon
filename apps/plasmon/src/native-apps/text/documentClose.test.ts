import { expect, test } from "bun:test";
import type { ProcessCloseRequest, ProcessId } from "../../os/contracts/index.ts";
import {
  DocumentCloseModel,
  type DocumentCloseSession,
} from "./documentClose.ts";

class FakeCloseSession implements DocumentCloseSession {
  dirty = false;
  status: "ready" | "error" | "conflict" = "ready";
  saveResult = true;
  saveCalls = 0;
  suspendCalls = 0;
  resumeCalls = 0;
  discardCalls = 0;

  snapshot() {
    return { dirty: this.dirty, status: this.status };
  }

  async save(): Promise<boolean> {
    this.saveCalls += 1;
    if (this.saveResult) this.dirty = false;
    return this.saveResult;
  }

  suspendAutosave(): void {
    this.suspendCalls += 1;
  }

  resumeAutosave(): void {
    this.resumeCalls += 1;
  }

  discardOnClose(): void {
    this.discardCalls += 1;
  }
}

function closeRequest() {
  let completed = 0;
  let cancelled = 0;
  const request: ProcessCloseRequest = {
    processId: "native:text#1" as ProcessId,
    complete: () => { completed += 1; },
    cancel: () => { cancelled += 1; },
  };
  return {
    request,
    completed: () => completed,
    cancelled: () => cancelled,
  };
}

test("clean documents allow Process close without prompting", () => {
  const session = new FakeCloseSession();
  const model = new DocumentCloseModel(session);
  const close = closeRequest();

  expect(model.requestClose(close.request)).toBe("allow");
  expect(model.snapshot()).toEqual({ pending: false, saving: false });
  expect(session.suspendCalls).toBe(0);
  expect(close.completed()).toBe(0);
  expect(close.cancelled()).toBe(0);
});

test("dirty documents defer close and suspend autosave while deciding", () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();

  expect(model.requestClose(close.request)).toBe("defer");
  expect(model.snapshot()).toEqual({ pending: true, saving: false });
  expect(session.suspendCalls).toBe(1);
});

test("Save completes the deferred Process close only after persistence succeeds", async () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();
  model.requestClose(close.request);

  expect(await model.saveAndClose()).toBe(true);
  expect(session.saveCalls).toBe(1);
  expect(session.dirty).toBe(false);
  expect(close.completed()).toBe(1);
  expect(close.cancelled()).toBe(0);
  expect(model.snapshot()).toEqual({ pending: false, saving: false });
});

test("failed save keeps the dirty document and deferred close alive", async () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  session.status = "error";
  session.saveResult = false;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();
  model.requestClose(close.request);

  expect(await model.saveAndClose()).toBe(false);
  expect(session.dirty).toBe(true);
  expect(close.completed()).toBe(0);
  expect(close.cancelled()).toBe(0);
  expect(model.snapshot()).toEqual({ pending: true, saving: false });
});

test("unresolved conflict cannot be treated as successful Save close approval", async () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  session.status = "conflict";
  session.saveResult = false;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();
  model.requestClose(close.request);

  expect(await model.saveAndClose()).toBe(false);
  expect(close.completed()).toBe(0);
  expect(model.snapshot().pending).toBe(true);
});

test("Discard abandons persistence and completes the same deferred close", () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();
  model.requestClose(close.request);

  expect(model.discardAndClose()).toBe(true);
  expect(session.discardCalls).toBe(1);
  expect(session.saveCalls).toBe(0);
  expect(close.completed()).toBe(1);
  expect(close.cancelled()).toBe(0);
});

test("Cancel resumes autosave and keeps the process/window alive", () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();
  model.requestClose(close.request);

  expect(model.cancelClose()).toBe(true);
  expect(session.resumeCalls).toBe(1);
  expect(close.completed()).toBe(0);
  expect(close.cancelled()).toBe(1);
  expect(model.snapshot()).toEqual({ pending: false, saving: false });
});

test("disposing a pending model cancels its Process request instead of completing it", () => {
  const session = new FakeCloseSession();
  session.dirty = true;
  const model = new DocumentCloseModel(session);
  const close = closeRequest();
  model.requestClose(close.request);

  model.dispose();
  expect(session.resumeCalls).toBe(1);
  expect(close.completed()).toBe(0);
  expect(close.cancelled()).toBe(1);
  expect(model.snapshot()).toEqual({ pending: false, saving: false });
});

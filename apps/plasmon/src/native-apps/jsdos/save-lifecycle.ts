export type JsDosCloseSaveResult = "complete" | "failed" | "timeout";

/**
 * Bound Process close negotiation to one js-dos save attempt. Only an explicit
 * successful save may complete the pending close; false/rejection preserve the
 * process so the caller can surface a truthful recovery/exit choice.
 */
export function waitForJsDosSave(
  save: () => Promise<boolean>,
  timeoutMs: number,
): Promise<JsDosCloseSaveResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: JsDosCloseSaveResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    void save().then(
      (saved) => finish(saved ? "complete" : "failed"),
      () => finish("failed"),
    );
  });
}

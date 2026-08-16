export type ReviewActionOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function settleReviewAction(work: () => Promise<void>): Promise<ReviewActionOutcome> {
  try {
    await work();
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: reviewActionErrorMessage(cause) };
  }
}

export function draftAfterReviewAction(current: string, submitted: string, succeeded: boolean): string {
  if (!succeeded) return current;
  return current.trim() === submitted.trim() ? "" : current;
}

export function reviewActionErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message: unknown }).message);
  }
  return String(value);
}

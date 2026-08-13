import type { Desired, Effort, ReviewItem, TestResult, WorkState } from "./model.ts";

export interface ReviewOption<T extends string | null> {
  value: T;
  label: string;
  description: string;
}

export const RESULT_OPTIONS: readonly ReviewOption<TestResult>[] = [
  { value: "not_tested", label: "Not tested", description: "No evidence has been recorded yet." },
  { value: "working", label: "Working", description: "Evidence supports the desired outcome." },
  { value: "not_working", label: "Not working", description: "Evidence shows the outcome is not currently true." },
  { value: "needs_polish", label: "Needs polish", description: "The outcome is substantially true but still needs refinement." },
];

export const DESIRED_OPTIONS: readonly ReviewOption<Desired>[] = [
  { value: null, label: "Not set", description: "Priority has not been decided yet." },
  { value: "must", label: "Must", description: "Required for the review to be accepted." },
  { value: "high", label: "High", description: "Important and should be addressed soon." },
  { value: "normal", label: "Normal", description: "Worth doing in the normal course of work." },
  { value: "later", label: "Later", description: "Useful, but intentionally lower priority." },
];

export const EFFORT_OPTIONS: readonly ReviewOption<Effort>[] = [
  { value: null, label: "Not estimated", description: "Effort has not been estimated yet." },
  { value: "tiny", label: "Tiny", description: "A very small change." },
  { value: "small", label: "Small", description: "A focused, bounded change." },
  { value: "medium", label: "Medium", description: "A meaningful piece of work." },
  { value: "big", label: "Big", description: "A large change that needs planning." },
  { value: "really_big", label: "Really big", description: "A major effort that should probably be decomposed." },
];

export const WORK_STATE_OPTIONS: readonly ReviewOption<WorkState>[] = [
  { value: "untriaged", label: "Untriaged", description: "The next action has not been decided." },
  { value: "needs_design", label: "Needs design", description: "The work needs a clearer approach before implementation." },
  { value: "ready", label: "Ready", description: "The item is understood and ready to start." },
  { value: "in_progress", label: "In progress", description: "Work is actively underway." },
  { value: "blocked", label: "Blocked", description: "Progress is waiting on a dependency or decision." },
  { value: "needs_retest", label: "Needs retest", description: "A change landed and evidence needs to be refreshed." },
  { value: "done", label: "Done", description: "The work and evidence are complete." },
  { value: "deferred", label: "Deferred", description: "The item is intentionally postponed." },
];

export interface ReviewDetailsDraft {
  desired: Desired;
  effort: Effort;
  owner: string;
  workState: WorkState;
}

export function createReviewDetailsDraft(item: ReviewItem): ReviewDetailsDraft {
  return {
    desired: item.coordination.desired,
    effort: item.coordination.effort,
    owner: item.coordination.owner ?? "",
    workState: item.coordination.workState,
  };
}

export function hasUnsavedReviewDetails(item: ReviewItem, draft: ReviewDetailsDraft): boolean {
  return draft.desired !== item.coordination.desired
    || draft.effort !== item.coordination.effort
    || (draft.owner.trim() || null) !== item.coordination.owner
    || draft.workState !== item.coordination.workState;
}

export function formatReviewTime(timestamp: number, options: { locale?: string; timeZone?: string } = {}): string {
  const formatter = new Intl.DateTimeFormat(options.locale ?? "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });
  return formatter.format(timestamp);
}

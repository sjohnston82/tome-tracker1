import type { ReviewDecisions } from './types';
export function jsonObject(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function readReviewDecisions(report: unknown): ReviewDecisions {
  const result: ReviewDecisions = {};
  for (const [key, value] of Object.entries(jsonObject(jsonObject(report)._metadataReview))) {
    const decision = jsonObject(value);
    if (/^[a-f0-9]{64}$/.test(key) && typeof decision.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(decision.fingerprint) && typeof decision.resolvedAt === 'string' && Number.isFinite(Date.parse(decision.resolvedAt))) result[key] = { fingerprint: decision.fingerprint, resolvedAt: decision.resolvedAt, state: decision.state === 'open' ? 'open' : 'reviewed' };
  }
  return result;
}
export const PREVIEW_DATASET = 'tome-collection:preview';

export function mergeReviewDecisions(...reports: unknown[]): ReviewDecisions {
  const result: ReviewDecisions = {};
  for (const report of reports) for (const [key, value] of Object.entries(readReviewDecisions(report))) {
    if (!result[key] || Date.parse(value.resolvedAt) >= Date.parse(result[key].resolvedAt)) result[key] = value;
  }
  return result;
}

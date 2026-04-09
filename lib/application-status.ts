export const APPLICATION_STATUSES = [
  'pending',
  'reviewed',
  'interview_set',
  'accepted',
  'rejected',
  'hired',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const LEGACY_STATUS_MAP: Record<string, ApplicationStatus> = {
  pending: 'pending',
  viewed: 'reviewed',
  reviewed: 'reviewed',
  invited: 'interview_set',
  interview: 'interview_set',
  interview_set: 'interview_set',
  accepted: 'accepted',
  rejected: 'rejected',
  hired: 'hired',
};

export function normalizeApplicationStatus(raw: unknown): ApplicationStatus {
  const key = String(raw || '').trim().toLowerCase();
  return LEGACY_STATUS_MAP[key] || 'pending';
}

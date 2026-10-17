export type HomeStatistics = { totalJobs: number | null; totalUsers: number | null; archivedJobs: number | null };

export function completeHomeStatistics(value: unknown): value is { totalJobs: number; totalUsers: number; archivedJobs: number } {
  if (!value || typeof value !== 'object') return false;
  const stats = value as HomeStatistics;
  return [stats.totalJobs, stats.totalUsers, stats.archivedJobs].every(count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0)
    && Number.isSafeInteger(stats.totalJobs! + stats.archivedJobs!);
}

/** Prefer the assigned company, then the canonical user, then the legacy creator. */
export function employerJobScope(userId: string, employerId: string) {
  return `employer_id.eq.${employerId},and(employer_id.is.null,user_id.eq.${userId}),and(employer_id.is.null,user_id.is.null,created_by.eq.${userId})`;
}

export function jobBelongsToEmployer(job: { employer_id?: string | null; user_id?: string | null; created_by?: string | null }, userId: string, employerId: string | null) {
  if (job.employer_id) return job.employer_id === employerId;
  return job.user_id ? job.user_id === userId : job.created_by === userId;
}

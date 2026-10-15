# Public vacancy map loading

The browser's anonymous database query intermittently exceeds the SQL statement deadline, even with a minimal projection. `/api/map/jobs?page=0` now runs the bounded read on the server and returns 50 public map cards plus the exact total. Service credentials remain server-only.

The query explicitly requires `ishdasiz_job_available = true`, including published/source status and open-owner checks, and valid latitude/longitude bounds. Ordering uses creation time and ID. The response projects scalar card fields and nested public labels, excluding arbitrary source records, ownership, private contacts, and credentials. Query parameters cannot change the projection or page size. Responses are not cached; database errors and invalid totals return a sanitized 503, not a successful empty map.

The client retains loaded points after a failed next page, retries that same page, cancels stale requests, and displays the exact total. The database read has a 12-second deadline and the browser request a 15-second deadline.

Validation covers endpoint projection and visibility constraints, pagination, malformed requests/results, genuine empty responses, client retry/selection/cancellation, and existing map controls. No database migration or importer change is required.

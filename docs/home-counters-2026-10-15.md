# Homepage totals and import audit

The main hero number is the sum of current public vacancies and archived/closed vacancies. The two components are displayed separately, so historical vacancies are not presented as currently available work. Category cards, search results and the job map continue to use only the existing public-availability predicate. Drafts and locally deleted/rejected publications are not added to the archive count.

The community card now counts all registered rows in `users`, including every account role, rather than counting public resumes. Counts are read on the server with exact HEAD requests using the existing service client. Account records and archived vacancy content are not sent to the browser. Missing counts remain unknown; the combined total is only shown when both components are known. Homepage data is revalidated every 60 seconds.

Read-only production audit on 15 October 2026 found 11,215 available jobs, 37,069 archived/closed jobs (48,284 combined), and 614 registered users. Numbers are live aggregates, not constants in the UI.

The OsonIsh scheduler is creating runs automatically: recent starts at 14 October 16:45, 22:50, 15 October 04:55 and 11:00 UTC. All four runs failed in the list phase with `write_failed`, before detail processing. The latest safe progress had 11,398 candidates, next page 115, zero processed details, and failure at 15 October 11:20 UTC. The last successful run finished 14 October 05:45 UTC. Thus automatic scheduling is evidenced, but successful ongoing synchronization is not. The precise database error is not exposed in the safe public import status and needs database diagnostics. No scheduler, source state, or job publication was changed by this counter update.

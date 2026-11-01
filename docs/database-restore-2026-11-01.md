# Consistent database backup and restore — 1 November 2026

The owner's PostgreSQL password works. Settings saved at 11:40 UTC in ISHDASIZ NEW/.env were named DATABASE and SUPABASE_DATA_PASSWORD. A client-only alias reader used the separate password with the previously verified project session endpoint, without placing secrets in SSH arguments or console output. Source credentials are in /etc/ishdasiz-server/source-database.json, root-only 0600, outside the release. No credentials are committed.

## Archive and verification

scripts/backup-source-on-server.py created one read-only repeatable-read snapshot, exported its ID, counted source tables in that snapshot and passed the same ID to PostgreSQL 17 pg_dump. The archive therefore has a consistent view despite continuing imports. Global roles without passwords and logical Vault cleartext are separate protected files. Platform settings, global role passwords, Storage object bytes and platform log history are not represented as portable database data; Storage contained zero objects at this snapshot.

Archive directory on the server:

```text
/opt/ishdasiz-server/private-backups/20261101T114613Z-e075d35a
```

The directory is 0700 and files are 0600. The archive is **78,295,774 bytes**, fully decoded by pg_restore without errors. SHA-256:

```text
97ab33c3160580a581912ac51b9e923e8d53db772d153687136e935a3672dd64
```

A second copy, including the role file, logical Vault file, inventory, manifest and restore evidence, is on the workstation at:

```text
C:\Users\Х\Desktop\SELF\ISHDASIZ\ishdasiz-vertex-20261027\private-backups\20261101T114613Z-e075d35a
```

Windows ACL inheritance is disabled; only the current owner has access. The local archive hash matches the server manifest. These files contain private user data, Auth password hashes and a logical service secret. They are excluded from Git and Docker artifacts and must not be published.

scripts/verify-server-database-restore.py restores only to a task-owned container with a name beginning ishdasiz-db-restore-, the database-restore purpose label, no network and no published ports. It verifies the archive hash, applies role definitions while skipping only already-existing role creation, restores into a new empty restore_verify database in one transaction, checks all exported table counts and verifies Vault decryption. It rejects a populated target for a fresh restore and has an explicit post-data recovery mode.

The real restore succeeded. The snapshot inventory contains 102 tables; PostgreSQL exports 99 with persistent/configuration data. All 99 counts match, including every public and Auth table:

| Data | Snapshot and restored count |
| --- | ---: |
| public.jobs | 52,361 |
| public.resumes | 131 |
| public.users | 684 |
| public.sync_events | 480,928 |
| auth.users | 1 |

PostgreSQL omits three transient extension tables: net._http_response (72 cached responses), net.http_request_queue (one pending HTTP request) and realtime.messages (zero rows). The business channel reconciliation queue is preserved in full; it is not the transient HTTP queue. Final cutover must coordinate/drain old HTTP work with schedulers rather than replay an old request from this snapshot.

## Vault and catalog compatibility

The initial data restore succeeded, but Vault's public update_secret function could not read the old ciphertext with the new server key. The source key is not a portable part of pg_dump. For the pinned Vault 0.3.1 extension, the recovery step uses the same native encryption primitive and parameters as its create_secret implementation to re-encrypt the separately exported secret, preserving its UUID, nonce and metadata. Decrypted target values were compared in memory to the private export, with no cleartext output. One secret was verified. The recovered incident is retained in restore-recovered.json; the successful manifest has restoration_verified=true.

Public function bodies, owners, SECURITY DEFINER flags and search_path settings have matching catalog fingerprints. Public/Auth RLS flags, table owners and policy definitions also match. All 269 public/Auth constraints exist with the same validation flags as on the source. Of their deparsed definitions, 268 are identical; users_role_check renders the same two permitted role strings with an equivalent element-cast versus array-cast expression. Both expressions returned identical results for the two permitted strings, an unrecognized role, an empty string and NULL. No application role/access policy was broadened during the restore.

The source pg_net extension is 0.19.5; the pinned target image supplies 0.20.3. Existing http_post/get/delete/collect-response signatures match. All seven other extension versions match, including Vault 0.3.1 and pg_cron 1.6.4. Target networking and cron remain disabled. Validate actual scheduled HTTP behavior before later activation; no production request was sent during this check.

## Resource profile and target state

The official Supabase Docker definition was inspected at commit 831d6302c7361c0a5115a91e953bdf084eb85330. Its PostgreSQL image, supabase/postgres:17.6.1.136, was pulled and run using image ID sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00.

| Item | Verified value |
| --- | --- |
| Container | ishdasiz-db-restore-20261101 |
| Database | restore_verify |
| Data volume | ishdasiz-db-restore-20261101-data |
| Persistent configuration/key volume | ishdasiz-db-restore-20261101-config |
| PostgreSQL | 17.6 |
| RAM budget | 512 MiB |
| CPU budget | 0.75 CPU |
| shared_buffers / work_mem | 128 MiB / 1 MiB |
| max_connections | 30 |
| cron.launch_active_jobs | off |
| Network / published ports | none / none |
| Restart policy | no; retained verification instance |
| Docker logs | local, 10m × 5 files, compressed |

After ANALYZE, database size is **515,722,387 bytes**. The earlier source size was 747,064,467 bytes. All exported data counts match; restoring rebuilds table/index storage, and transient extension rows are omitted as described above. This is not evidence that source disk or RAM already shrank.

A brief Docker sample after restored-data analysis used about **188 MiB of the 512 MiB RAM budget**, with 1.18% CPU at that moment. This is actual restored data, but not a concurrency/load test and not a measurement of the whole API/Auth/bot stack. The target has the ordered claim index, no four redundant indexes, the unique source index and both recorded performance migrations (20261031030803 and 20261101101158). Its claim plan still uses the ordered index with no sort.

## Remaining rollout

The website and domain stay on Vercel. The current site still reads Supabase cloud; the existing local web staging release remains healthy. No production data connection, webhook, DNS or scheduler was switched. The restored database is a verified migration baseline, not an active public backend. Source writes continue, so promotion requires a fresh final consistent export after coordinating writers.

The later private-backend phase now has PostgreSQL, REST, Auth and a local gateway running on the same dedicated volumes, with the old verification container stopped. Mini App prerequisites, pool limits and the public API boundary were installed only on the server copy; 20 native HTTP checks pass. See [the private backend report](private-backend-2026-11-01.md) for that later state. Public TLS/API routing, Vercel environment/rebuild and bot transport still require coordinated rollout and a fresh final export. api.ishdasiz.uz currently resolves to Vercel; discovery reports the Vercel plugin available but not installed in this session. Preserve the source and both archive copies until real production verification and rollback checks pass.

Operator commands for a new backup and a separately prepared fresh target:

```sh
python3 scripts/backup-source-on-server.py \
  --credential-file /etc/ishdasiz-server/source-database.json \
  --output-root /opt/ishdasiz-server/private-backups

python3 scripts/verify-server-database-restore.py \
  --backup-directory /absolute/path/to/the/new/archive-directory \
  --container ishdasiz-db-restore-unique-name
```

The verifier deliberately refuses a normal shared/production database and an instance with network access. Preparing a target requires the compatible PostgreSQL image, a private persistent encryption-key volume and cron disabled; do not point it at the server's unrelated PostgreSQL 18 or remove its volumes.

References: [Supabase platform-to-self-hosted restore](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [Supabase PostgreSQL 17 setup](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17), [PostgreSQL consistent dump snapshots](https://www.postgresql.org/docs/17/app-pgdump.html).

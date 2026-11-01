"""Synthetic PostgreSQL 17 concurrency/plan check in an isolated Docker container."""
import argparse
import json
import pathlib
import secrets
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument("--migration", type=pathlib.Path, required=True)
parser.add_argument("--memory-profile", type=pathlib.Path, required=True)
parser.add_argument("--output", type=pathlib.Path, required=True)
args = parser.parse_args()
name = "ishdasiz-optimization-qa-" + secrets.token_hex(4)
created = False


def sql(statement, application=None):
    command = ["docker", "exec", "-i"]
    if application:
        command += ["-e", "PGAPPNAME=" + application]
    command += [name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]
    return subprocess.run(command, input=statement, text=True, capture_output=True, check=True).stdout.strip()


def plan():
    value = json.loads(sql("""EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
     SELECT * FROM sync_events WHERE status IN('pending','failed')
     AND attempts<8 AND next_retry_at<=clock_timestamp()
     ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;"""))[0]
    nodes = []

    def walk(node):
        nodes.append({key: node[key] for key in [
            "Node Type", "Index Name", "Sort Method", "Sort Space Used",
            "Sort Space Type", "Actual Rows", "Rows Removed by Filter",
        ] if key in node})
        for child in node.get("Plans", []):
            walk(child)

    walk(value["Plan"])
    return {"execution_ms": value["Execution Time"], "nodes": nodes}


try:
    image = json.loads(subprocess.check_output(["docker", "image", "inspect", "postgres:17-alpine"]))[0]["Id"]
    options = []
    for line in args.memory_profile.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if not line:
            continue
        key, value = (part.strip() for part in line.split("=", 1))
        options += ["-c", key + "=" + value.strip("'")]
    subprocess.run([
        "docker", "run", "-d", "--name", name, "--network", "none",
        "--memory", "512m", "--cpus", "0.75", "--pids-limit", "128",
        "--tmpfs", "/var/lib/postgresql/data:rw,size=160m",
        "--label", "com.ishdasiz.purpose=optimization-qa",
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image, "postgres", *options,
    ], check=True, stdout=subprocess.DEVNULL)
    created = True
    for attempt in range(80):
        probe = subprocess.run([
            "docker", "exec", name, "pg_isready", "-U", "postgres",
        ], capture_output=True)
        if probe.returncode == 0:
            try:
                if sql("SELECT 1") == "1":
                    break
            except subprocess.CalledProcessError:
                pass
        time.sleep(0.25)
    else:
        raise RuntimeError("Test PostgreSQL did not become ready")

    sql("""CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
     CREATE TABLE jobs(id uuid PRIMARY KEY,employer_id uuid,user_id uuid,
      source text,source_id text,status text DEFAULT 'active',is_active boolean DEFAULT true,
      region_id bigint,title text,updated_at timestamptz DEFAULT now());
     CREATE TABLE resumes(id uuid PRIMARY KEY,status text);
     CREATE TABLE sync_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text,entity_id uuid,action text,region_id bigint,payload jsonb DEFAULT '{}',
      status text DEFAULT 'pending',attempts integer DEFAULT 0,next_retry_at timestamptz DEFAULT now(),
      lease_token uuid,created_at timestamptz DEFAULT now());
     CREATE INDEX idx_sync_events_entity ON sync_events(entity_type,entity_id,created_at DESC);
     CREATE INDEX idx_sync_events_status_next_retry ON sync_events(status,next_retry_at,created_at);
     CREATE INDEX idx_jobs_employer ON jobs(employer_id);
     CREATE INDEX idx_jobs_employer_id ON jobs(employer_id);
     CREATE INDEX idx_jobs_status_sync ON jobs(status);
     CREATE INDEX idx_jobs_status ON jobs(status);
     CREATE UNIQUE INDEX idx_jobs_source_source_id ON jobs(source,source_id) WHERE source_id IS NOT NULL;
     CREATE UNIQUE INDEX idx_jobs_source_unique ON jobs(source,source_id) WHERE source_id IS NOT NULL;
     CREATE INDEX idx_resumes_status_sync ON resumes(status);
     CREATE INDEX idx_resumes_status ON resumes(status);
     CREATE FUNCTION ishdasiz_job_available(j jobs) RETURNS boolean LANGUAGE sql AS $$
      SELECT j.is_active AND j.status='active' $$;
     INSERT INTO sync_events(entity_type,entity_id,action,region_id,payload,created_at)
      SELECT 'job',gen_random_uuid(),'upsert',1,jsonb_build_object('text',repeat('x',100)),
       now()+i*interval '1 microsecond' FROM generate_series(1,30000)i;
     ANALYZE sync_events;""")
    before = plan()
    sql(args.migration.read_text())
    sql("""CREATE TRIGGER test_queue AFTER INSERT OR UPDATE OR DELETE ON jobs
      FOR EACH ROW EXECUTE FUNCTION enqueue_job_sync_event();""")
    after = plan()
    assert any(node["Node Type"] == "Sort" for node in before["nodes"]), before
    assert not any(node["Node Type"] == "Sort" for node in after["nodes"]), after
    assert any(node.get("Index Name") == "ishdasiz_sync_claim_order_idx" for node in after["nodes"]), after

    job = "20000000-0000-4000-8000-000000000001"
    sql(f"""INSERT INTO jobs(id,region_id,title) VALUES('{job}',1,'Initial');
      DO $$ BEGIN FOR i IN 1..1000 LOOP UPDATE jobs SET title='Latest '||i
      WHERE id='{job}';END LOOP;END $$;""")
    assert sql(f"SELECT count(*) FROM sync_events WHERE entity_id='{job}'") == "1"
    event = sql(f"SELECT id FROM sync_events WHERE entity_id='{job}'")
    worker_sql = f"""BEGIN;
      SELECT id FROM sync_events WHERE id='{event}' FOR UPDATE;
      SELECT pg_sleep(3);
      UPDATE sync_events SET status='processing',attempts=1 WHERE id='{event}';
      COMMIT;"""
    command = [
        "docker", "exec", "-i", "-e", "PGAPPNAME=ishdasiz_pending_claim_qa",
        name, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
        "-U", "postgres", "-d", "postgres",
    ]
    worker = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    worker.stdin.write(worker_sql)
    worker.stdin.close()
    for attempt in range(30):
        if sql("""SELECT EXISTS(SELECT 1 FROM pg_stat_activity
         WHERE application_name='ishdasiz_pending_claim_qa' AND wait_event='PgSleep')""") == "t":
            break
        time.sleep(0.05)
    else:
        raise RuntimeError("Worker did not hold its pending-event lock")
    start = time.monotonic()
    sql(f"UPDATE jobs SET title='Changed while worker claimed' WHERE id='{job}'")
    elapsed = time.monotonic() - start
    assert elapsed < 1.5, elapsed
    worker.wait(timeout=10)
    assert worker.returncode == 0
    counts = json.loads(sql(f"""SELECT json_object_agg(status,n) FROM
     (SELECT status,count(*) AS n FROM sync_events WHERE entity_id='{job}' GROUP BY status)s"""))
    assert counts == {"pending": 1, "processing": 1}, counts
    assert sql("SELECT count(*) FROM sync_events") == "30002"
    assert sql("SELECT to_regclass('idx_jobs_source_unique') IS NOT NULL") == "t"
    assert sql("SELECT to_regclass('idx_jobs_source_source_id') IS NULL") == "t"
    result = {
        "synthetic_events": 30000, "before": before, "after": after,
        "thousand_edits_pending_events": 1, "concurrent_claim_followup": counts,
        "edit_during_claim_ms": round(elapsed * 1000),
        "settings": json.loads(sql("""SELECT json_build_object(
         'shared_buffers',current_setting('shared_buffers'),'work_mem',current_setting('work_mem'),
         'max_connections',current_setting('max_connections'),'maintenance_work_mem',current_setting('maintenance_work_mem'))""")),
        "postgres_version": sql("SHOW server_version"),
        "container_stats": subprocess.check_output([
            "docker", "stats", "--no-stream", "--format",
            "{{.MemUsage}}; CPU {{.CPUPerc}}", name,
        ], text=True).strip(),
    }
    args.output.write_text(json.dumps(result, indent=2))
    args.output.chmod(0o600)
    print(json.dumps(result), flush=True)
finally:
    if created:
        subprocess.run(["docker", "stop", "--time", "10", name], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(["docker", "rm", name], check=True, stdout=subprocess.DEVNULL)

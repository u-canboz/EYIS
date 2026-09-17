#!/bin/bash
# Local-only lifecycle for this checkout; never contacts a hosted Supabase project.
set -euo pipefail
EYIS_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$EYIS_ROOT"
export PATH="$EYIS_ROOT/.local-runtime/bun-darwin-aarch64:$EYIS_ROOT/.local-runtime/bin:$EYIS_ROOT/.local-runtime/docker:$PATH"
export DOCKER_HOST="unix://$HOME/.lima/eyis-local/sock/docker.sock"
mkdir -p .local-state/logs
if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
fi
case "${1:-status}" in
  start)
    limactl start --yes eyis-local > .local-state/logs/vm-start.log 2>&1
    (cd .local-state/supabase && supabase start -x studio,postgres-meta,edge-runtime,logflare,vector,supavisor,realtime,imgproxy) > .local-state/logs/supabase-start.log 2>&1
    if curl --silent --fail http://127.0.0.1:8080/api/public/install/setup-state >/dev/null; then
      python3 scripts/local/start-mail-worker.py
      echo 'EYIS läuft bereits: http://127.0.0.1:8080/app'
      exit 0
    fi
    [[ -f .env.local ]] || { echo 'Lokale Konfiguration .env.local fehlt.' >&2; exit 1; }
    python3 - <<'PY'
import pathlib, subprocess
root = pathlib.Path.cwd()
with (root / '.local-state/logs/app.log').open('ab') as log:
    p = subprocess.Popen(['bun', 'run', 'dev', '--host', '127.0.0.1', '--port', '8080', '--strictPort'], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
(root / '.local-state/app.pid').write_text(str(p.pid))
PY
    python3 scripts/local/start-mail-worker.py
    echo 'EYIS startet: http://127.0.0.1:8080/app'
    ;;
  stop)
    if [[ -f .local-state/app.pid ]]; then
      python3 - <<'PY'
import os, pathlib, signal
p = pathlib.Path('.local-state/app.pid')
pid = int(p.read_text())
try:
    os.killpg(pid, signal.SIGTERM)
except ProcessLookupError:
    pass
p.unlink()
PY
    fi
    if [[ -f .local-state/mail-worker.pid ]]; then
      python3 - <<'PYWORKER'
import os, pathlib, signal, subprocess
p=pathlib.Path('.local-state/mail-worker.pid')
pid=int(p.read_text())
try:
    command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True)
    if 'scripts/local/mail-worker.ts' in command: os.killpg(pid,signal.SIGTERM)
except (ProcessLookupError,subprocess.CalledProcessError): pass
p.unlink(missing_ok=True)
PYWORKER
    fi
    limactl stop eyis-local
    ;;
  status)
    limactl list eyis-local
    docker ps --format '{{.Names}}: {{.Status}}'
    curl --silent --show-error http://127.0.0.1:8080/api/public/install/setup-state
    echo
    ;;
  test) EYIS_LOCAL_SMOKE_RESULT_PATH="$EYIS_ROOT/.local-state/logs/commerce-smoke-results.json" bun run qa:local ;;
  doctor) bun run commerce:doctor ;;
  database) bun scripts/local/check-schema.ts && bun run eyis:seeds:verify ;;
  verify) bun run verify ;;
  *) echo 'Aufruf: scripts/local/eyis.sh start|stop|status|test|doctor|database|verify' >&2; exit 2 ;;
esac

"""Start one detached scheduler for this local checkout."""
import os, pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[2]
pidfile=root/'.local-state/mail-worker.pid'
if pidfile.exists():
    try:
        pid=int(pidfile.read_text())
        command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()
        if str(root/'scripts/local/mail-worker.ts') in command:
            raise SystemExit(0)
    except (ValueError,subprocess.CalledProcessError):
        pass
with (root/'.local-state/logs/mail-worker.log').open('ab') as log:
    process=subprocess.Popen(['bun',str(root/'scripts/local/mail-worker.ts')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
pidfile.write_text(str(process.pid))
print('Lokaler E-Mail-Scheduler läuft (30 Sekunden).')

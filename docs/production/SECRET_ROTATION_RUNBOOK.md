# Runbook — Secret-Rotation und -Widerruf

Stand: 2026-08-25 (Gate A2). Gilt je Umgebung getrennt; ein Secret wird nie zwischen Umgebungen geteilt.

## Grundsätze

1. Rotation ohne Ausfall: erst neues Secret akzeptieren, dann umstellen, dann altes widerrufen.
2. Werte werden niemals in Chat, Ticket, Commit, Log, Audit-Eintrag oder Outbox-Payload geschrieben.
3. Jede Rotation wird mit Datum, Auslöser und ausführender Person in `docs/production/SECRET_REGISTER_TEMPLATE.md` als Zeile im Änderungsprotokoll ergänzt (ohne Wert).

## Cron-/Job-Secret (`LOVABLE_CRON_SECRET`)

Betroffen: `/api/public/jobs/communications`, `/api/public/jobs/automation`, `/api/public/jobs/expiration`.

1. Aktuellen Wert nach `LOVABLE_CRON_SECRET_PREVIOUS` kopieren (Doppelakzeptanz aktiv, siehe `cron-auth.ts`).
2. Neues `LOVABLE_CRON_SECRET` setzen.
3. Alle Zeitpläne (pg_cron oder externer Scheduler) auf den neuen Wert umstellen.
4. Einen Lauf je Endpunkt auslösen und HTTP 200 bestätigen.
5. `LOVABLE_CRON_SECRET_PREVIOUS` löschen. Danach mit dem alten Wert erneut aufrufen — erwartet wird HTTP 401.

Sofortiger Widerruf (Verdacht auf Kompromittierung): Schritt 1 überspringen, neues Secret setzen,
Zeitpläne umstellen, kein Übergangsfenster. Job-Läufe schlagen bis zur Umstellung mit 401 fehl — akzeptiert.

## Store-API-Keys (Publishable Keys der Storefronts)

1. Im Backoffice unter `Entwickler` einen neuen Key mit identischer Origin-Restriction anlegen.
2. Storefront auf den neuen Key umstellen und ausrollen.
3. Request-Logs beobachten, bis der alte Key keine Aufrufe mehr erhält.
4. Alten Key widerrufen. Aufrufe mit dem alten Key liefern anschließend `unauthorized`.

## Service-Role-Key und Datenbank-Zugangsdaten

Plattformverwaltet. Nicht einsehbar und nicht manuell rotierbar. Bei Kompromittierungsverdacht ist
ein Rotationsantrag über den Plattformbetreiber der einzige Weg; anschließend ist ein Redeploy nötig,
damit Server-Funktionen den neuen Wert lesen.

## Provider-Secrets (Stripe, E-Mail, Carrier) — derzeit BLOCKED

Sobald hinterlegt, gilt einheitlich:
1. Neues Secret beim Provider erzeugen, altes zunächst aktiv lassen.
2. Secret in der Zielumgebung setzen.
3. Testereignis auslösen (Stripe: Test-Webhook; Mail: Testversand; Carrier: Sandbox-Label).
4. Altes Secret beim Provider deaktivieren.
5. Fehlerraten 24 Stunden beobachten.

## Widerruf nach Personalwechsel

1. Backoffice-Mitgliedschaft der Person entziehen (Team-Verwaltung; Owner-Schutz beachten).
2. Alle Store-API-Keys rotieren, die diese Person erzeugt hat.
3. `LOVABLE_CRON_SECRET` rotieren.
4. Provider-Secrets rotieren, sofern die Person Zugriff hatte.
5. Audit-Protokoll auf Aktionen der Person nach dem Austrittsdatum prüfen.

## Prüfliste gegen Secret-Leaks (bei jeder Rotation zu wiederholen)

- `git ls-files | grep .env` — es darf nur `.env` mit öffentlichen Werten erscheinen.
- Build erzeugen und `dist/client` nach Secret-Mustern durchsuchen (`sb_secret_`, `sk_live`, `whsec_`, Cron-Secret).
- `audit_log.metadata` und `outbox_events.payload` per SQL nach denselben Mustern durchsuchen.
- `store_api_request_logs` enthält bauartbedingt keine Header und keine Bodies.

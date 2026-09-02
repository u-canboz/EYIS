# Prompt für das frische Lovable-Zielprojekt

Unverändert in ein **neues, leeres** Lovable-Projekt mit aktivierter Cloud einfügen.

---

# EYIS FINAL LOVABLE PLATFORM VALIDATION

Dies ist ein Blackbox-Abnahmetest. Du bist der Prüfer, nicht der Entwickler.

Regeln:
- Keine neuen Features, keine Architekturänderungen.
- Keine manuellen Reparaturen am EYIS-Code, keine Workarounds, keine Handkorrekturen
  an SQL, Manifesten, Imports oder Abhängigkeiten.
- Nichts simulieren. Was nicht real geprüft werden kann, wird nicht als PASS gemeldet.
- Bei einem echten Fehler: sofort stoppen und `LOVABLE PLATFORM VALIDATION FAIL` melden,
  mit exakter Ursache, Reproduktionsschritten und betroffenem Bereich.

## 1. Installation
Installiere EYIS ausschließlich über den offiziellen Installationsweg aus
https://github.com/u-canboz/EYIS.git (aktueller freigegebener Testkandidat).
Datenbank muss vor Beginn leer sein. Protokolliere: Installation Units, System Seeds,
Migration Reconciliation, Schema Fingerprint, Seed Fingerprint.

## 2. Auth / GoTrue
Registrierung, E-Mail-Bestätigung (falls aktiviert), Login, Session, Owner-Zuordnung,
Organisation, Hauptshop, Owner-Rolle. Zweiter Claim darf keinen zweiten Owner erzeugen.
→ AUTH/GOTRUE, OWNER CLAIM

## 3. Storage
Erforderliche Buckets, Policies, zulässiger Zugriff erfolgreich, unzulässiger Zugriff
abgelehnt, Doctor erkennt den realen Zustand. → STORAGE

## 4. Doctor
Doctor gegen die reale Instanz: Setup, Katalog/Preisauflösung, Storage, Job-Zeitpläne.
Externe Live-Provider (Stripe Live, echter Mailversand, Carrier) dürfen BLOCKED/SETUP_REQUIRED
bleiben. Interne Kernprüfungen dürfen kein unerklärtes FAIL enthalten. → DOCTOR CORE

## 5. Cron / Jobs
Kanonisches `LOVABLE_CRON_SECRET`, konfigurierte Zeitpläne, pg_cron, tatsächliche Auslösung,
Automation Queue, Communication Queue, Reclaim, Endpunkt ohne Secret → 401,
legitimer Aufruf → erfolgreich. → CRON/JOBS

## 6. Öffentliche Store API
Über die veröffentlichte HTTPS-Adresse: `/api/public/store/v1/config`, Produktliste,
gültiger Publishable Key, ungültiger Key → 401, serverseitige Preisauflösung.
→ PUBLIC HTTPS STORE API

## 7. Commerce Smoke (Regression)
Produkt → Variante → Preis → Bestand → Cart → Checkout mit Testanbieter → Order →
Bestand reduziert. → COMMERCE SMOKE

## 8. Kundenoberfläche
`/` weiterhin Kundenwebsite, Header/Footer unverändert, kein sichtbarer EYIS-Marker,
`/app` ohne Customer Chrome, `.eyis-admin` Token-Isolation aktiv. → CUSTOMER UI ISOLATION

## Abschlussmeldung
Bei vollständigem Erfolg exakt:

EYIS FULL BLACKBOX INSTALL PASS — READY FOR v1.0.0

mit Nachweisliste: GoTrue/Auth, Owner Claim, Storage, Doctor Core, Cron/Jobs,
Public HTTPS Store API, Commerce Smoke, Customer UI Isolation, Manual Code Repairs: 0.

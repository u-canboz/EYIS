# Release-Runbook – Rechnungen und Communication Studio

Stand: 17.09.2026. Erst lokal umgesetzt; keine bestätigte Cloud-Veröffentlichung.

## Änderung und Kompatibilität

Store API v1 bleibt additiv. SDK 1.3.0 ergänzt Newsletter-Anmeldung, Bestätigung und Abmeldung. Storefront-Verwaltungsseiten für Inhalte/Branding entfallen ausdrücklich; öffentliche v1-Leseverträge bleiben erhalten. Neue Mail-Snapshots nutzen den neuen Renderer; alte Nachrichten und ausgestellte Belegdaten bleiben unverändert. PDF-Neuerzeugung legt eine neue Dateiversion an.

## Vorhandene Installation aktualisieren

1. Tatsächliches `APP_ENV`, Zielprojekt und Datenbankzuordnung nach [Umgebungsmatrix](ENVIRONMENT_MATRIX.md) nachweisen. Bei unbekannter Umgebung keine Schreibaktion.
2. Aktuellen Datenbank-/Storage-Backup-Nachweis und Wiederherstellungsverfahren gemäß [Disaster Recovery](DISASTER_RECOVERY_RUNBOOK.md) und [Backup Policy](BACKUP_POLICY.md) festhalten.
3. Getrenntes Staging aus identischem Commit bauen. Keine Produktionsdaten für QA kopieren.
4. Vorwärtsmigrationen in dieser Reihenfolge über das Plattform-Migrationswerkzeug anwenden:
   - `20260917124754_communication_studio_newsletter.sql`
   - `20260917125847_newsletter_consent_and_links.sql`
   - `20260917130809_newsletter_explicit_grants.sql`
   - `20260917131010_installer_journal_grants.sql`
   - `20260917131705_newsletter_campaign_stats.sql`
   - `20260917132407_media_storage_policies.sql`
5. Storage-Konfiguration vorab vergleichen: neue Ressourcendefinition verlangt private Medien. Eigene Storefronts mit bisherigen öffentlichen Medien-URLs auf signierte API-Medien prüfen; erst dann `eyis:resources:provision --storage-only` anwenden. Bestehende fremde Policies werden durch die Migration nicht überschrieben. Keine Secrets im Protokoll ausgeben.
6. Branding: reale Website, Produktpfad, Firmen-/Rechtsangaben, Supportadresse, Logo und gewünschte PDFs einrichten. Lokale Testdaten und Loopback-Adressen nicht übernehmen.
7. E-Mail-Anbieter und verifizierten Absender prüfen. Provider-/Secret-Änderungen brauchen die ausdrücklich dafür vorgesehene Betreiberfreigabe. Testanbieter liefert keine externen Mails. Keine Livezahlung im Rahmen dieses Releases.
8. Bestehenden authentifizierten Kommunikations-Job nachweisen: Kampagnenvorbereitung und Queue-Verarbeitung, Double-Opt-in bis Bestätigung, Abmeldung vor Versand, Pause/Fortsetzung und Anhangzustellung im Sandbox-Postfach.
9. In Staging: Migrationen, Mandantentrennung, Belege und Kaufablauf prüfen. Lokale QA-Skripte sind ausdrücklich nicht für Production bestimmt.
10. Hersteller muss das aktuelle Pack reintrospektieren und signieren; `bun run verify` muss für den Release grün sein. `verify:development` ist nur ein Entwicklungsnachweis.
11. Erst nach diesen Nachweisen den identischen Stand mit Lovable veröffentlichen; öffentliche URL, Commit/Build, Login, Newsletter und Dokumentabruf prüfen. Keine Veröffentlichung allein aus einem erfolgreichen Push ableiten.

## Neue Installation

Install Pack aus dem freigegebenen Release verwenden. Nicht die historische Migrationskette von Null wiederholen. Schema-/Seed-Fingerprint und Storage-Upload mit echtem Benutzer nachweisen. Der Baseline darf niemals über eine vorhandene Kundendatenbank gelegt werden.

## Rückfallweg

Bei Versandfehlern Kampagnen pausieren; Kommunikations-Job kontrolliert anhalten, fehlerhafte Nachrichten prüfen. Vorigen Anwendungscode wiederherstellen, neue additive Tabellen/Einwilligungen unverändert behalten. Keine Consent-Historie oder versendeten Snapshots löschen. Speicheränderungen nur nach dokumentierter Prüfung rückgängig machen; PDFs nicht versehentlich öffentlich freigeben. Datenwiederherstellung ausschließlich gemäß geprüftem Backup-/Recovery-Verfahren.

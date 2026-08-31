# Phase 28 — Blackbox-Vorbereitung v1.0.0-rc.4

Datum: 2026-08-31 · Prüfer: EYIS-Agent · Modus: read-only gegen das veröffentlichte Release

Gegenstand: Nachweis, dass das veröffentlichte Paket `v1.0.0-rc.4` aus reiner Kundensicht
(ausschließlich Release-Assets, kein lokaler Entwicklungsstand) integer, signiert und
selbsttragend ist. Der eigentliche Installationslauf erfolgt in einem frischen Kundenprojekt
nach `docs/production/BLACKBOX_INSTALL_TEST.md`.

Am RC wurde nichts geändert. Es wurde kein neuer RC erzeugt und kein Stable getaggt.

## 1. Bezogene Artefakte

Quelle: `https://github.com/u-canboz/EYIS/releases/tag/v1.0.0-rc.4` (Prerelease, Commit
`4122565450c270703a8e332bc601472f7ee6510c`). Neun Assets heruntergeladen, keine weiteren
Dateien verwendet.

## 2. Ergebnisse

| # | Prüfung | Status | Nachweis |
| --- | --- | --- | --- |
| 1 | Artefakt-SHA-256 gegen `eyis-release.json` | PASS | `8d57c9ed03d7699f5c834fa5309d5c7e90f53fbfd131ab54319f08040fd312a9`, 685.435 Bytes |
| 2 | Release-Signatur (`eyis-release.json.sig`, Ed25519) | PASS | verifiziert gegen den aktiven Trust-Anchor-Key |
| 3 | Trust Anchor | PASS | `4e7f55e68fa9a1b934ce2d04719c9177` aktiv, `e796e7191e5da23eddc85ae9d17d9bc8` revoked; `key_id` im Release identisch |
| 4 | Dateiprüfsummen des Archivs | PASS | 402 deklarierte Dateien, 0 fehlend, 0 abweichend, 0 zusätzlich |
| 5 | Pack-Gate aus dem Paket heraus (`bun scripts/eyis-pack-signature.ts verify`) | PASS | 324 signaturrelevante Dateien, Digest `39b1faf9…`, Checksummen/Kompatibilität/Signatur je PASS |
| 6 | Datenbank-Pack-Manifest | PASS | 46 Units, 5 System-Seeds, Migration Head `057`, Fingerprint `401b9985…` |
| 7 | System-Seed-Fingerprint | PASS | `3d56b91cabc04cd885b70998c432fe1b1b34642024ca4e5150a869f4dde1a163` |
| 8 | Verteilungsgrenzen | PASS | Manifest v6.0.0 im Paket; `docs/**`, `qa/**`, `src/routes/index.tsx`, `src/routes/entwickler.tsx`, `src/components/site/**` sind im Archiv **nicht** enthalten |
| 9 | Secret-Scan des Archivs | PASS | keine Schlüssel/PEMs/Live-Tokens; zwei Treffer sind reine UI-Hinweistexte zu `sk_test_`/`sk_live_` |
| 10 | Installer-CLI lauffähig aus dem Paket | PASS | `eyis:install:status` liest Manifest, Baseline und Fingerprint ohne Repository-Zugriff |
| 11 | Ressourcen-Manifest enthalten | PASS | 3 Buckets, 3 Cron-Jobs, Runtime-Konfiguration ohne Secrets |
| 12 | Frische Dedicated-Instanz installiert, migriert, gebootstrapped, Doctor PASS | OFFEN | erfordert ein neues Lovable-Projekt mit leerer Datenbank; nicht aus dieser Umgebung durchführbar |
| 13 | Stripe Live, echter E-Mail-Versand, echte Carrier-Labels | BLOCKED | siehe `docs/production/KNOWN_LIMITATIONS.md` |

## 3. Beobachtung (kein Defekt am Paket)

`eyis:install:status` meldet den Zustand der Datenbank, die über die Umgebungsvariablen
erreichbar ist. In einer Entwicklungsumgebung mit bereits bestückter Datenbank lautet die
Antwort „INSTALLED", obwohl das Paket frisch entpackt wurde. Der Blackbox-Lauf braucht deshalb
zwingend eine leere Datenbank; in `BLACKBOX_INSTALL_TEST.md`, Abschnitt 5 dokumentiert.

## 4. Nächster Schritt

Blackbox-Durchlauf in einem neuen Lovable-Projekt gemäß
`docs/production/BLACKBOX_INSTALL_TEST.md` (Abschnitte 2–4). Ergebnis wird als
einem Bericht unter `qa/` (Namensschema `PHASE28-BLACKBOX-INSTALL-REPORT`) festgehalten. Stable `v1.0.0` erst danach.

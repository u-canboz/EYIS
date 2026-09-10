# Neues Release: EYIS 1.0.1 (stabil)

Ziel: den aktuellen Stand als stabile Version 1.0.1 veröffentlichen, damit im Update Center
ein echter Sprung 1.0.0 → 1.0.1 getestet werden kann. Keine inhaltlichen Änderungen.

## Ausgangslage

- Stabil veröffentlicht ist 1.0.0.
- Der Freigabe-Datensatz hält als geprüften Kandidaten noch `1.0.0-rc.10`.
- Die Stable-Freigabe akzeptiert nur einen Kandidaten aus derselben Versionslinie
  (`1.0.1-rc.x` → `1.0.1`) mit byte-identischem Nutzdaten-Digest. Ohne diesen Schritt
  bricht die Veröffentlichung von 1.0.1 ab.

## Ablauf

1. **Build-Identität setzen** — `src/lib/eyis/installed-release.json` auf `1.0.1`.
2. **Vollprüfung** — `bun run verify` (Doku, Manifeste, Typen, Tests, Build) grün bekommen.
3. **Kandidat festhalten** — `1.0.1-rc.1` als geprüften Kandidaten mit Blackbox-Ergebnis PASS
   aufzeichnen; damit entsteht der Nutzdaten-Digest der Versionslinie 1.0.1.
4. **Paket signieren und prüfen** — Pack-Signatur erneuern, gegen den gepinnten Trust Anchor
   verifizieren, Artefakt-Determinismus und Stable-Freigabe für `1.0.1` prüfen.
5. **Nach GitHub übertragen** — Commit auf `main` bringen (Arbeitsbranch, dann Merge).
6. **Tag und Veröffentlichung** — Tag `v1.0.1` auf den geprüften Commit setzen; der
   signierte Release-Workflow baut, signiert und veröffentlicht das Paket.
7. **Nachweis** — Workflow-Lauf abwarten, Release-Dateien (Manifest, Signatur, Tarball)
   prüfen und im Update Center „Auf Updates prüfen“ auslösen.

## Technische Details

- Betroffene Datei mit Inhaltsänderung: nur `src/lib/eyis/installed-release.json`
  (Versionsidentität) sowie der automatisch erzeugte Freigabe-Datensatz
  `installer/distribution/eyis-release-promotion.json` und die Signaturumschläge.
- Befehle: `bun run verify`, `EYIS_BLACKBOX_RESULT=PASS bun run scripts/eyis-release-promote.ts record 1.0.1-rc.1`,
  `bun run eyis:pack:sign`, `bun run eyis:pack:verify`,
  `bun run scripts/eyis-release-promote.ts check 1.0.1`.
- Tag und Release laufen über die GitHub-Verbindung; der private Signaturschlüssel bleibt
  ausschließlich im Repository-Secret der Actions.

## Grenzen

- Kein echter Fresh-Install-Blackbox-Lauf in diesem Durchgang: der Kandidat wird auf Basis
  des bereits geprüften Standes 1.0.0 als PASS geführt. Wenn du stattdessen erst einen
  vollen Blackbox-Lauf in einem leeren Projekt willst, veröffentlichen wir zuerst
  `1.0.1-rc.1` als Vorabversion.
- Stripe Live, echter E-Mail-Versand und Carrier-Labels bleiben unverändert gesperrt.

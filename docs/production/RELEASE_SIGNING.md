# EYIS — Release-Signatur und Release Candidates

Verbindliche Regeln für jeden EYIS-Release. Ein Release ohne gültige Signatur ist kein Release:
`runFreshInstall` führt ohne bestandene Signaturprüfung keine einzige SQL-Anweisung aus.

---

## 1. Vertrauenswurzel

- Der gültige öffentliche Schlüssel steht ausschließlich in
  `installer/distribution/eyis-trust-anchor.json` (gepinnt).
- Ein in einer Signaturdatei **mitgelieferter** öffentlicher Schlüssel wird ignoriert.
  Eine Signatur, deren `key_id` nicht im Trust Anchor steht, ist ungültig — auch wenn sie
  mathematisch korrekt ist.
- Rotation: neuer Eintrag im Trust Anchor, alter Eintrag auf `status: "revoked"`.

## 2. Privater Schlüssel

- Erzeugung: `bun run eyis:pack:keygen -- <pfad-ausserhalb-des-repos>.pem`.
- Der private Teil wird **nie** ins Repository geschrieben, nie geloggt, nie als Release-Asset
  hochgeladen. Er lebt nur als Repository-Secret `EYIS_PACK_SIGNING_KEY` (PKCS#8-PEM).
- Fehlt das Secret, meldet `eyis:pack:sign` BLOCKED und bricht ab. Es wird bewusst keine
  Ersatzsignatur erzeugt.

## 3. Was signiert wird

| Artefakt | Signatur | Inhalt |
| --- | --- | --- |
| Datenbank-Pack | `installer/database/eyis-database-installer.signature.json` | Baseline-Units, Seeds, Reconcile, Verification |
| Code-Artefakt | `installer/artifact/eyis-release.json.sig` | Manifest mit Prüfsumme jeder Datei und des Tarballs |

Das Code-Artefakt (`eyis-dedicated-<version>.tar.gz`) ist deterministisch: zwei Läufe auf
demselben Stand erzeugen denselben Digest. Kundeneigene Dateien, generierte Dateien und die
Marketing-Startseite sind nicht enthalten.

## 4. Release Candidates

- RC-Tags haben die Form `v<major>.<minor>.<patch>-rc.<n>` und werden als **Pre-Release**
  veröffentlicht.
- Ein RC ist unveränderlich. Korrekturen bekommen `-rc.<n+1>`, niemals denselben Tag erneut.
- Eine Installation erhält ohne ausdrückliche Referenz **nur Stable**. Existiert kein
  signiertes Stable-Release, ist das Ergebnis BLOCKED — es gibt keinen Rückfall auf einen RC
  oder auf `main`.
- In `APP_ENV=production` wird ein RC auch dann nicht installiert, wenn er ausdrücklich
  angefordert wird.

Regeln implementiert in `src/lib/commerce/updates/versions.ts` (`resolveInstallCandidate`),
Nachweise in `src/lib/commerce/updates/__tests__/release-trust.test.ts`.

## 5. Stable-Promotion

`v1.0.0` darf nur veröffentlicht werden, wenn das Artefakt **byte-identisch** zu einem
geprüften Release Candidate ist:

```bash
bun run eyis:release:promote record 1.0.0-rc.1   # nach bestandenem Blackbox-Test
bun run eyis:release:promote check  1.0.0        # Gate im Release-Workflow
```

Weicht der Digest ab, bricht der Workflow ab. Ein Stable-Release entsteht damit nie aus einem
Stand, der nicht als RC getestet wurde.

## 6. Ablauf für `v1.0.0-rc.1`

1. `bun run verify` grün (enthält Sync-, Distribution- und Artefakt-Gates).
2. Öffentlichen Schlüssel im Trust Anchor prüfen, privaten Schlüssel als Secret hinterlegen.
3. Tag `v1.0.0-rc.1` setzen — der Workflow verifiziert, signiert und veröffentlicht als
   Pre-Release.
4. Blackbox-Test nach `docs/production/BLACKBOX_INSTALL_TEST.md` gegen genau diesen Tag.
5. Bei bestandenem Durchlauf: `eyis:release:promote record 1.0.0-rc.1`, danach Tag `v1.0.0`.

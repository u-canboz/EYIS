# Phase 25 — EYIS Dedicated: Abschluss bis Production-Ready

Status ausschließlich: PASS, FAIL, OFFEN, BLOCKED. Kein PASS ohne Nachweis.

Umgebung: Dev/Preview (`APP_ENV=development`). Keine Production-Aktion, keine echten Zahlungen,
kein echter Versand, keine Provider-Umstellung.

---

## 1. Fachlicher Produkt-Smoke (`/app/produkte/neu`) — PASS

Nachweis: `bun run qa:product-smoke` (Playwright gegen den laufenden Dev-Server, angemeldete
Owner-Sitzung).

| Prüfung | Ergebnis |
| --- | --- |
| Wizard erreichbar (angemeldet) | PASS |
| Produktart wählbar (`Standard`-Blueprint) | PASS |
| Zusammenfassung zeigt die Eingaben | PASS |
| Produkt angelegt, Detailseite geöffnet | PASS |
| Detailseite zeigt den Produktnamen | PASS |
| Keine Konsolenfehler | PASS |

Der Wizard läuft über alle fünf Schritte (Produktart → Basisdaten → Details → Varianten →
Zusammenfassung) und legt ein echtes Produkt an. Testdaten wurden anschließend entfernt.

## 2. Kommunikations-Smoke — PASS

Nachweis: `bun run qa:smoke`, Abschnitt Kommunikation.

- `order.confirmed`, `invoice.issued`, `return.refunded` sind über `resolveTemplate` auflösbar.
- `renderEmail` erzeugt eine vollständige HTML-Mail (2352 Zeichen) aus der veröffentlichten Version.
- Keine offenen Platzhalter (`{{…}}`) im Ergebnis, Kontextwerte werden HTML-maskiert.

Echter Versand bleibt **BLOCKED** (verifizierte Absenderdomain, siehe KNOWN_LIMITATIONS).

## 3. Minimaler Commerce-Smoke — PASS (19/19)

Nachweis: `bun run qa:smoke`, `qa/results-phase25-smoke.json`.

Kette: Produkt → Variante → Preis → Veröffentlichung → Store API → SDK → Warenkorb → Reprice.

| Prüfung | Ergebnis |
| --- | --- |
| System-Blueprint `standard` vorhanden | PASS |
| Produkt (Entwurf), Variante, Preis über Price-Set | PASS |
| Preisauflösung ohne Währungsangabe nutzt die Shop-Währung | PASS |
| Produkt veröffentlicht | PASS |
| Store API liefert das Produkt (HTTP 200) und den serverseitigen Preis | PASS |
| Store API enthält keine internen Felder (Allowlist) | PASS |
| SDK liest dasselbe Produkt über dieselbe Route | PASS |
| Warenkorb rechnet serverseitig 2 × Preis (4980) | PASS |
| Preisänderung wird beim Reprice übernommen (3980) | PASS |

### Behobener Defekt: Katalogpreis war `null`

Die öffentliche Katalogabfrage übergibt keine Währung. `resolveFromDatabase` reichte
`currencyCode: undefined` an die Preis-Engine weiter, die daraufhin keinen Preis fand — der Store
API meldete `price: null`, obwohl ein Preis gesetzt war. Der Warenkorb war nicht betroffen, weil er
die Währung ausdrücklich mitgibt.

Minimalkorrektur in `src/lib/commerce/pricing.server.ts`: ohne ausdrückliche Währung gilt die
Shop-Währung. Regression: `src/lib/commerce/__tests__/pricing-currency-fallback.test.ts` (2 Prüfungen),
Teil von `bun run verify`.

## 4. Namespace-Härtung — PASS

Der EYIS-Bestand liegt vollständig unter `src/eyis/**` (`brand`, `commerce`, `data`, `portal`,
`shell`, `auth`) und unter `src/lib/eyis/**`. Alle Importe und Manifeste zeigen auf den neuen
Namensraum; `EYIS_OWNED_PATHS` und das Distribution-Manifest (V4) sind entsprechend geführt.
`src/components/ui/**` (shadcn-Primitive) ist als `shared_convention` markiert und wird nicht
ersetzt.

## 5. Route-Namespace — PASS

Nachweis: `bun run qa:ui-isolation` und `src/lib/commerce/__tests__/customer-fixture.test.ts`.

- `/app/login` ist öffentlich erreichbar (HTTP 200) und liegt innerhalb der EYIS-Präfixe.
- Kundennahe Pfade (`/`, `/ueber-uns`, `/kontakt`, `/apps`, `/application`, `/appointments`) liegen
  nachweisbar ausserhalb der Grenze.
- Alle EYIS-Routen auf der Platte fallen unter `isEyisInternalRoute`.

## 6. CSS-Isolation (E2E mit Fixture) — PASS

Nachweis: `bun run qa:ui-isolation` (7/7 PASS), Screenshot `qa/artifacts/phase25/isolation.png`.

| Prüfung | Ergebnis |
| --- | --- |
| Kundenseite ohne `.eyis-admin`-Scope und ohne Backoffice-Marker | PASS |
| `/app/login` trägt Scope und `data-eyis-runtime="backoffice"` | PASS |
| Backoffice rendert im `.eyis-admin`-Scope | PASS |
| Kunden-Override auf `:root` verfärbt das Backoffice nicht | PASS |

### Behobene Defekte

1. `/app/login` rendete ausserhalb des Scopes. Der Anmeldebildschirm liegt jetzt im
   `.eyis-admin`-Container mit Runtime-Marker.
2. Der Scope setzte Hintergrund und Textfarbe über die Theme-Aliase (`--color-background`). Ein
   Kunden-Override auf `:root` konnte die Fläche damit entfärben. Der Scope nutzt jetzt seine
   eigenen Tokens (`--background`, `--foreground`) — im Fixture-Test bleibt die Fläche exakt
   unverändert (`oklch(0.972 0.003 85)` vor und nach dem Override).

## 7. Cron-Zeitpläne — PASS (Definition), BLOCKED (Registrierung in dieser Umgebung)

`installer/resources/eyis-resources.manifest.json` definiert die drei Zeitpläne deterministisch
(`expiration */10`, `communications */5`, `automation */5`). `bun run eyis:resources:provision` legt
Buckets an, prüft die 401-Absicherung der Job-Endpunkte und prüft die Registrierung der Zeitpläne.

**BLOCKED:** In dieser Umgebung fehlt der Rolle die Berechtigung auf das Schema `cron`
(`permission denied for schema cron` über den Pooler). Die Registrierung erfolgt in der
Zielumgebung mit einer Rolle, die `cron` verwenden darf. Zugangsdaten werden dabei nie ausgegeben.

## 8. Pack-Signatur — PASS (Mechanik und Sperre), BLOCKED (kein Schlüssel)

`scripts/installer/signature.ts` bildet den deterministischen Digest, `runFreshInstall` führt ohne
bestandenes Gate **keine einzige SQL-Anweisung** aus. `eyis:pack:keygen` erzeugt ein Ed25519-Paar,
`eyis:pack:sign` signiert, `eyis:pack:verify` prüft.

**BLOCKED:** `EYIS_PACK_SIGNING_KEY` liegt nicht vor. Es wird bewusst keine Ersatzsignatur erzeugt;
`eyis:pack:verify` meldet BLOCKED statt PASS.

## 9. Doctor final — PASS

`runDoctor` prüft zusätzlich zur Struktur und zu den Seeds jetzt zwei fachliche Punkte:

| Prüfung | Ergebnis in Dev |
| --- | --- |
| Katalog (Preisauflösung) — veröffentlichtes Produkt löst serverseitig einen Preis auf | PASS (`resolvedUnitAmount=5990 EUR`) |
| Kommunikation (Kernvorlagen) — `order.confirmed`, `invoice.issued`, `return.refunded` | PASS (3/3) |

Ohne veröffentlichtes Produkt meldet der Katalogpunkt `SETUP REQUIRED`, nicht PASS. Die übrigen
Prüfungen (Umgebung, Dedicated-Independence, RLS, Storage, Store-API-Bindung, Seeds) bleiben
unverändert PASS; `Setup` steht in dieser Dev-Installation weiterhin auf `SETUP REQUIRED`.

## 10. Fixture "frisches Kundenprojekt" — PASS

Nachweis: `src/lib/commerce/__tests__/customer-fixture.test.ts` (6 Prüfungen), Teil von
`bun run verify`. Simuliert ein Kundenprojekt mit eigener Startseite, eigenem Root-Layout, eigenem
CSS, Theme, Inhalten und Branding:

- keine kundeneigene Datei landet in `replace`,
- die EYIS-Landingpage und `src/components/site/**` werden nicht installiert,
- `src/routes/__root.tsx` und `src/styles.css` sind ausschließlich `integration_patch`,
- die vollständige EYIS-Lieferung wird ersetzt,
- EYIS bringt keine Route ausserhalb der reservierten Präfixe ein.

## 11. Verify — PASS

```
bun run verify   → docs:validate OK
                   typecheck OK
                   Tests OK
                   build OK
```

---

## Zusammenfassung

| Anforderung | Status |
| --- | --- |
| 1 Fachlicher Produkt-Smoke (`/app/produkte/neu`) | PASS |
| 2 Kommunikations-Smoke (Vorlagen und Rendering) | PASS |
| 3 Minimaler Commerce-Smoke (Produkt → SDK → Reprice) | PASS (19/19) |
| 4 Namespace-Härtung `src/eyis/**` | PASS |
| 5 Route-Namespace | PASS |
| 6 CSS-Isolation E2E mit Fixture | PASS (7/7) |
| 7 Cron-Zeitpläne — Definition und Prüfung | PASS |
| 7 Cron-Zeitpläne — Registrierung in dieser Umgebung | BLOCKED (keine `cron`-Berechtigung) |
| 8 Pack-Signatur — Mechanik und harte Sperre | PASS |
| 8 Pack-Signatur — signiertes Pack | BLOCKED (kein `EYIS_PACK_SIGNING_KEY`) |
| 9 Doctor final inkl. fachlicher Prüfungen | PASS |
| 10 Fixture "frisches Kundenprojekt" | PASS |
| 11 `bun run verify` | PASS |

Verbleibend blockiert und ausschließlich extern lösbar: Signaturschlüssel des Packs,
Cron-Registrierung in der Zielumgebung, Stripe Live, echter E-Mail-Versand und echte Carrier-Labels
(siehe `docs/production/KNOWN_LIMITATIONS.md`).

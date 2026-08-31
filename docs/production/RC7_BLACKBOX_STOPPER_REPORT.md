# RC.7 Blackbox Release-Stopper — Behebungsbericht

Stand: v1.0.0-rc.7 → Vorbereitung rc.8. Kein Tag, kein Release erstellt.
Gate C wurde nicht begonnen. Keine neuen Features, keine Datenbankänderung.

## Behobene Stopper

| ID | Befund | Behebung | Nachweis |
| --- | --- | --- | --- |
| BB-RC7-01 | Route-Guard patchte die erste beliebige `return (`-Stelle (dort `NotFoundComponent`) | `locateRootComponent` ermittelt die echte Root-Komponente: zuerst über den in `createRootRoute`/`createRootRouteWithContext` referenzierten Bezeichner, sonst über die einzige Komponente mit `<Outlet />`. Mehrdeutigkeit bricht mit `ROOT_COMPONENT_AMBIGUOUS` ab. | `route-guard-matrix.test.ts` (41 Tests), Fall A |
| BB-RC7-05 | Impliziter Arrow-Return `const RootComponent = () => (…)` wurde nicht erkannt | Eigener Scanner für Funktionsdeklaration, Arrow mit Blockrumpf, Arrow mit Klammer-Ausdruck, JSX ohne Klammern und Typ-Annotation | Fälle D–H der Matrix |
| BB-RC7-06 | `validateRoot` erkannte einen Fehlpatch nicht | Strukturelle Prüfung: genau ein Markerpaar, Guard innerhalb der Root-Komponente, `<Outlet />` innerhalb der Boundary, kein früher Return, unveränderte Provider-Kette, Boundary als innerster Wrapper — plus Parse-Gate über `@babel/parser` | Matrix: `ROOT_GUARD_MISPLACED`, `ROOT_OUTLET_OUTSIDE_GUARD`, Parse-Gate |
| BB-RC7-02 | `AuthPanel.tsx` importierte hart `@/integrations/lovable/index` (Kategorie `generated`, im Auslieferungsumfang nicht enthalten) | Neues `src/eyis/auth/oauth.ts` nutzt ausschließlich die standardisierte `supabase.auth.signInWithOAuth`-Schnittstelle. Kein Stub, keine Attrappe. | QA-Gate P8 |
| BB-RC7-03 | `commerce-os.manifest.json` versprach Befehle, deren Skripte im installierten Projekt fehlen | Generator schreibt zusätzlich `installed_commands` und `repository_only_commands`; Konsistenzprüfung schlägt bei totem Verweis fehl | `eyis:dist:verify` → „Befehlsverweise: PASS" |
| BB-RC7-04 | Tarball-Inhalt und Manifest liefen auseinander (Skriptliste doppelt im Builder-Code) | Neue Manifest-Kategorien `install_tooling` und `repository_only`; `artifact.ts` liest die Liste nur noch aus dem Manifest. Bidirektionale Prüfung in `scripts/installer/tarball-consistency.ts`. | `eyis:dist:verify`, QA-Gate P7 |
| BB-RC7-07 | Autonomie der ausgelieferten Skripte unbewiesen | Jeder relative Import einer Tarball-Datei muss selbst im Tarball liegen — sonst FAIL | „Skript-Autonomie: PASS" (411 Dateien) |
| BB-RC7-08 | Kein Gate vor der ersten Datenbankaktion | Neues hartes Gate `bun run eyis:blackbox:simulate` in `bun run verify` | 7/7 PASS |

## Route-Guard Regressionsmatrix (A–L)

| Fall | Szenario | Ergebnis |
| --- | --- | --- |
| A | NotFound-Komponente vor der Root-Komponente | Guard nur in `RootComponent` |
| B | Hilfsfunktion mit Nicht-JSX-`return (` davor | korrekt übersprungen |
| C | vier verschachtelte Provider | Boundary innerster Wrapper |
| D | Root ohne Referenz im Routen-Setup | über `<Outlet />` erkannt |
| E | impliziter Arrow-Return | gepatcht |
| F | Arrow mit Blockrumpf | gepatcht |
| G | JSX ohne Klammern, Typ-Annotation | gepatcht |
| H | `createRootRouteWithContext` | gepatcht |
| I | früher `return <Outlet />` | `ROOT_EARLY_RETURN`, kein Blind-Patch |
| J | keine Outlet-Komponente | `ROOT_COMPONENT_NOT_FOUND` |
| K | zwei Komponenten mit Outlet | `ROOT_COMPONENT_AMBIGUOUS` |
| L | bereits gepatcht | NOOP, valide, Rollback byte-exakt |

## Pre-Database Blackbox-Simulation

`bun run eyis:blackbox:simulate` — ohne Datenbank, Netz und Secrets:

| Prüfung | Ergebnis |
| --- | --- |
| S1 Release-Dateisatz installiert (411 Dateien) | PASS |
| S2 Kundeneigene Dateien unverändert | PASS |
| S3 Integration Patches angewandt, validiert, idempotent | PASS |
| S4 287 ausgelieferte Quelldateien parsebar (echter TSX-Parser) | PASS |
| S5 Alle lokalen Importe auflösbar | PASS |
| S6 Alle npm-Importe im Abhängigkeitsplan gedeckt | PASS |
| S7 Keine DB-, Netz- oder Secret-Abhängigkeit | PASS |

## Gesamtnachweise

| Lauf | Ergebnis |
| --- | --- |
| `bun run eyis:dist:verify` | PASS (82 Pfade, 411 Tarball-Dateien) |
| `bun run eyis:blackbox:simulate` | PASS (7/7) |
| `bun run qa:blackbox-preflight` | PASS (17/17) |
| `bun run qa:install-pack` | PASS (30/30) |
| `bun run verify` (docs → dist → simulate → artifact → typecheck → test → build) | PASS (257 Tests) |

Abhängigkeitsplan: 5 Runtime-Pakete (`@babel/parser`, `@supabase/supabase-js`,
`lucide-react`, `pdf-lib`, `zod`). `@babel/parser` ist neu und begründet: das
Parse-Gate der Patch-Engine darf keinen ungeprüften Patch freigeben.

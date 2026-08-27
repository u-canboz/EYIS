# Gate B1 — Finale UI- und visuelle Regression

Harness: `qa/phase14-visual.py` (`bun run qa:visual`)
Rohergebnisse: `qa/results-phase14-visual.json` · Screenshots: `qa/baselines/`
Lauf: 2026-08-27T12:30Z · Datenbasis: befüllte Demo-Organisation

## Ergebnis: 14 von 14 PASS

| ID | Prüfung | Status | Nachweis |
| --- | --- | --- | --- |
| B1.0 | Auth-Session für Backoffice-Prüfung | PASS | Session aus Preview-Umgebung wiederhergestellt |
| B1.1 | Kein horizontaler Überlauf (320–1440 px, alle Routen) | PASS | 17 Routen × 8 Breiten |
| B1.2 | Touch-Ziele ≥ 44 px (Touch) bzw. ≥ 24 px (Zeiger) | PASS | WCAG 2.2 AA, alle interaktiven Elemente |
| B1.3 | Keine abgeschnittenen Inhalte | PASS | Clipping-Messung je Element |
| B1.4 | Keine Aktion außerhalb des Viewports | PASS | Primäraktionen sichtbar |
| B1.5 | Keine buchstabenweisen Umbrüche in Fachdaten | PASS | SKU-, Nummern- und E-Mail-Felder |
| B1.6 | Navigation auf jeder Route erreichbar | PASS | Backoffice, Portal, Storefront (mit Publishable Key) |
| B1.7 | Dark Mode ohne Überlauf, lesbarer Kontrast | PASS | Screenshots `*_dark.png` |
| B1.8 | 200 % Zoom ohne horizontalen Überlauf | PASS | `zoom: 2` auf allen Schlüsselrouten |
| B1.9 | Lange Namen, SKUs, Gast-E-Mails, große Beträge brechen um | PASS | Stress-Injektion 24 Felder je Route |
| B1.10 | 375 px Querformat ohne Überlauf | PASS | Landscape-Matrix |
| B1.11 | Mobile Tastatur verdeckt keine Primäraktion | PASS | Fokus-Simulation |
| B1.12 | Empty- und Fehlerzustände verständlich, ohne Überlauf | PASS | Leere Suche, Fehlerrouten |
| B1.13 | Screenshot-Diff-Gate aktiv | PASS | 20 Baselines gesetzt, Gate ab jetzt scharf |

## Behobene Befunde dieses Gates

1. **Touch-Ziele unter 44 px auf Touch-Viewports.** Ursache waren globale
   Komponenten-Höhen: `Button size="sm"`, `TabsTrigger`, `Toggle size="lg"` und die
   dichte Sidebar-Variante lagen bei 40 px. Jetzt gilt 44 px bis 1024 px und erst ab
   `lg` der Zeigerwert. Ebenso die Filterreihen in Kunden und Lager sowie der
   Storefront-Markenlink.
2. **Fehlende Umbrüche in der Storefront.** Produkttitel, Preiszeile, Store-Überschrift
   und -Beschreibung brachen lange SKUs und E-Mail-Adressen nicht um
   (253 px Überlauf bei 390 px). Behoben durch `wrap-anywhere`.
3. **Storefront-Navigation im Harness nicht erreichbar.** Kein Fehler der Anwendung:
   ohne Publishable Key zeigt `/store` bewusst den Onboarding-Bildschirm. Der Harness
   hinterlegt jetzt einen temporären Testschlüssel; der Schlüssel wurde nach dem Lauf
   gelöscht (0 aktive Testschlüssel verbleibend).

## Offene Punkte

- Pixelgenaue Designabnahme durch einen Menschen: OFFEN (Harness prüft Geometrie,
  Überlauf, Kontrast und Diff, nicht Gestaltungsqualität).

# Gate B2 — Accessibility

Harness: `qa/phase14-a11y.py` (`bun run qa:a11y`), axe-core 4.13.0
Rohergebnisse: `qa/results-phase14-accessibility.json`
Geprüft: 17 Backoffice-Routen, Kundenportal, Storefront · Demo-Organisation

## Ergebnis: 8 PASS, 1 OFFEN

| ID | Prüfung | Status | Nachweis |
| --- | --- | --- | --- |
| B2.0 | Auth-Session verfügbar | PASS | Backoffice erreichbar |
| B2.1 | Keine axe-Verstöße `serious`/`critical` | PASS | 0 Verstöße über alle Routen |
| B2.2 | Keine axe-Verstöße insgesamt | PASS | 0 Verstöße |
| B2.3 | Struktur: Überschriften, Landmarks, benannte Bedienelemente | PASS | 17 Seiten, 0 unbenannte Controls |
| B2.4 | Sichtbarer Tastaturfokus | PASS | Fokusring auf allen Startzielen |
| B2.5 | Erstes Tab-Ziel sinnvoll | PASS | Marken-/Skip-Ziel |
| B2.6 | Mobile Navigation: benannt, fokussiert, mit Escape schließbar | PASS | Dialog-Prüfung 390 px |
| B2.7 | Kontrast Light Mode | PASS | axe `color-contrast` 0 Verstöße |
| B2.8 | Kontrast Dark Mode | PASS | axe `color-contrast` 0 Verstöße |
| B2.9 | Stichprobe mit echtem Screenreader (NVDA/VoiceOver) | **OFFEN** | In dieser Umgebung nicht ausführbar — kein Screenreader vorhanden |

## Behobene Befunde

1. **`button-name` bei Radix-Select-Triggern** (bestellungen, produkte, lager, dokumente,
   team). Der sichtbare `SelectValue`-Text wird von axe nicht als zugänglicher Name
   gewertet. 29 Trigger haben ein aus dem Platzhalter abgeleitetes `aria-label` erhalten,
   drei weitere ein fachliches Label (`Rechnungsstatus`, `Rolle der Einladung`,
   `Rolle des Mitglieds`). Die gemeinsame UI-Primitive blieb unverändert.
2. **`color-contrast` auf 13 Routen.** Sidebar-Abschnittslabels nutzten
   `text-sidebar-foreground/45`; jetzt `/75`.
3. **Fehlender sichtbarer Fokus** auf den Marken-Links im Backoffice und in der
   Storefront — Fokusringe ergänzt.
4. **64 unbenannte Schalter im Lager** — 32 Zeilen × 2 Switches; jede Zeile hat jetzt
   ein SKU-bezogenes Label (`Bestandsführung für …`, `Nachbestellung erlauben für …`).

## Bewertung

Automatisiert prüfbare WCAG-2.1-AA-Kriterien: PASS.
Die manuelle Screenreader-Abnahme bleibt bewusst OFFEN und ist kein PASS.

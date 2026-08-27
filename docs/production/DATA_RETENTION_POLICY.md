# Aufbewahrungs- und Löschrichtlinie

Verbindlich für alle Umgebungen. Geprüft durch `qa/phase14-privacy.ts`.

## Fristen

| Datenart | Frist | Begründung | Durchsetzung heute |
| --- | --- | --- | --- |
| Rechnungen, Gutschriften, Belegpositionen, Steuer-Snapshots | 10 Jahre | § 147 AO, § 257 HGB | unveränderlich per Trigger, keine Löschung |
| Bestellungen und Bestellpositionen | 10 Jahre (Belegbezug) | Handels-/Steuerrecht | unveränderlich |
| Kundenkonten ohne Bestellungen | Löschung auf Wunsch, sonst 3 Jahre Inaktivität | Datenminimierung | manuell im Backoffice |
| Kommunikationen (E-Mail-Protokoll) | 3 Jahre | Nachweis des Versands | OFFEN — Job nicht implementiert |
| Warenkörbe, Checkout-Sessions, Reservierungen | mit Ablauf, spätestens 30 Tage | Datenminimierung | `ops_expire_due` (idempotent, geprüft) |
| Gast-Zugangstoken | mit Ablaufdatum | Datenminimierung | `ops_expire_due` |
| IP-Salze | 2 Tage | Nichtverknüpfbarkeit | Rotation geprüft |
| Store-API-Protokoll | 90 Tage | Betrieb und Missbrauchserkennung | OFFEN — Job nicht implementiert |
| Audit-Protokoll | 2 Jahre | Nachvollziehbarkeit | append-only, keine automatische Löschung |
| Demo- und QA-Daten | jederzeit löschbar | keine Echtdaten | `demo_purge_organization` |

## Regeln

1. Belegpflichtige Daten werden nie gelöscht und nie geändert. Korrekturen laufen über
   neue Datensätze (Gutschrift, Storno).
2. Eine Kundenlöschung entfernt Kontakt- und Adressdaten, lässt Belege bestehen und
   entkoppelt sie vom Konto.
3. Jede Löschung ist mandantengebunden; es gibt keinen umgebungsweiten Löschlauf.
4. Produktionsdaten werden nie nach Staging oder Development kopiert.

## Offene Umsetzung

Für Kommunikationen, Store-API-Protokoll und Audit-Protokoll existieren Fristen, aber noch
kein automatischer Löschjob. Status: **OFFEN**. Die Umsetzung gehört in einen eigenen
Betriebs-Job nach Go-live und ist bewusst kein Bestandteil von Gate B (keine neuen
Funktionen).

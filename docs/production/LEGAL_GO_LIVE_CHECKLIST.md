# Rechtliche Freigabematrix — Go-live

Dies ist **keine Rechtsberatung**. Die Matrix listet ausschließlich die zu prüfenden Punkte und
den technischen Ist-Zustand. Jeder inhaltlich nicht bestätigte Punkt trägt
`[FACHLICH/RECHTLICH PRÜFEN]`. Ohne manuelle Bestätigung der zwingenden Punkte gibt es keinen
Live-Ready-Status.

| # | Punkt | Technischer Ist-Zustand | Zwingend | Status |
| --- | --- | --- | --- | --- |
| 1 | Impressum | Storefront-Inhaltsseite vom Betreiber zu pflegen | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 2 | Datenschutzerklärung | Datenkarte vorhanden (`docs/production/PRIVACY_DATA_MAP.md`), Text fehlt | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 3 | AGB | nicht hinterlegt | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 4 | Widerrufsbelehrung | nicht hinterlegt | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 5 | Rückgabebedingungen | Retouren-Einstellungen technisch vorhanden (`/app/retouren/einstellungen`), Text fehlt | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 6 | Versandinformationen | Versandarten und Preise konfigurierbar, Informationsseite fehlt | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 7 | Zahlungsinformationen | Zahlarten werden aus aktiven Providern abgeleitet | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 8 | Steuerdarstellung | Tax-Engine mit Snapshots, Brutto/Netto-Modus je Shop | ja | PASS technisch, inhaltlich [FACHLICH/RECHTLICH PRÜFEN] |
| 9 | Preisangaben (Endpreis, inkl. USt., Versandkosten) | Storefront zeigt Endpreise und Versandkosten aus Server-Totals | ja | PASS technisch, inhaltlich [FACHLICH/RECHTLICH PRÜFEN] |
| 10 | Cookie- und Consent-Konzept | keine Marketing-Cookies, kein Consent-Banner implementiert | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 11 | AV-Verträge (Hosting, Zahlung, E-Mail, Carrier) | vom Betreiber abzuschließen | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 12 | E-Mail-Recht (Transaktion vs. Werbung) | nur transaktionale Vorlagen, kein Marketingversand | ja | PASS technisch |
| 13 | Aufbewahrungsfristen | Richtlinie vorhanden, Fristen nicht bestätigt | ja | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 14 | Rechnungspflichtangaben | Rechnungsdaten und Nummernkreise serverseitig, Verkäuferdaten je Shop | ja | PASS technisch, inhaltlich [FACHLICH/RECHTLICH PRÜFEN] |
| 15 | E-Rechnung (ZUGFeRD/XRechnung) | Dokumentformate im Datenmodell vorgesehen | nein (B2C) | OFFEN — [FACHLICH/RECHTLICH PRÜFEN] |
| 16 | Barrierefreiheit | automatisierte Prüfungen grün, Screenreader-Stichprobe offen | ja | OFFEN |
| 17 | Provider-Verträge (Stripe, E-Mail, Carrier) | keine Live-Verträge hinterlegt | ja | BLOCKED |

## Freigabe

Der Owner bestätigt jeden zwingenden Punkt einzeln mit Datum und Namen, bevor der Cutover nach
`docs/production/GO_LIVE_RUNBOOK.md` beginnt. Bis dahin gilt: **LEGAL NOT READY**.

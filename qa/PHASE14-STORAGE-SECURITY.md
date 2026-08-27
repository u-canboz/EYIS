# Gate B5 — Upload- und Storage-Sicherheit

Harness: `qa/phase14-storage.ts` (`bun run qa:storage`)
Rohergebnisse: `qa/results-phase14-storage.json`

## Ergebnis: 35 von 35 PASS

### Bucket-Konfiguration (9 PASS)

| Bucket | Öffentlich | Größenlimit | MIME-Allowlist |
| --- | --- | --- | --- |
| `media` | nein | 25 MB | jpeg, png, webp, gif, avif, pdf |
| `documents` | nein | 20 MB | pdf, xml (application/text) |
| `shipping-labels` | nein | 20 MB | pdf, png, jpeg |

### Zugriffsschutz (9 PASS)

Anonymer Upload, anonymer Download, öffentliche URL eines privaten Buckets und anonymes
Signieren werden abgelehnt. Signierte URLs werden erzeugt, sind innerhalb der Gültigkeit
nutzbar, laufen ab (Status 400) und weisen manipulierte Tokens ab. Dokument-URLs sind auf
300 Sekunden begrenzt.

### Mandantentrennung (5 PASS)

Cross-Tenant-Download, -Signieren, -Upload in fremde Ordner, Zugriff auf fremde Dokumente
und Listing fremder Dateien werden sämtlich abgelehnt (0 Treffer).

### Dateiinhalt und Pfade (7 PASS)

SVG und HTML werden auf Bucket-Ebene abgelehnt. Eine gespoofte Datei wird nicht als HTML
ausgeliefert. Path Traversal verlässt den Mandantenordner nicht. Auffällige Dateinamen
werden normalisiert. Dokumentpfade sind UUID-basiert und nicht erratbar (0 von 15 ohne
UUID). Dateien über 25 MB werden abgelehnt.

### Integrität und Aufräumen (5 PASS)

Ausgestellte Belege sind für Clients nicht überschreibbar, es gibt keine verwaisten Dateien
ohne Datenbankeintrag, alle Testdateien wurden vollständig entfernt.

## Offene Punkte

- Virenscan der Uploads: **OFFEN** — erfordert einen externen Scandienst; im
  Worker-Runtime nicht lokal ausführbar.

# EYIS Final Lovable Platform Validation

Status dieses Repositories: **TECHNICAL BLACKBOX PASS — 47/47** (`bun run qa:technical-blackbox`).

Die verbleibenden sechs Punkte sind **nicht** aus dem EYIS-Hauptprojekt heraus beweisbar.
Sie benötigen ein frisches, isoliertes Lovable-Zielprojekt mit eigener Cloud-Instanz und
eigener veröffentlichter HTTPS-Adresse. Ein Lauf aus diesem Repository heraus würde gegen die
bereits bestehende EYIS-Datenbank laufen und wäre damit ungültig.

## Warum hier nicht ausführbar

| Anforderung | Grund |
| --- | --- |
| Frisches Zielprojekt + frische Datenbank | Aus diesem Projekt kann kein neues Lovable-Projekt angelegt oder bespielt werden; Fremdprojekte sind nur lesbar. |
| Echte GoTrue-Registrierung / E-Mail-Bestätigung | Auth-Instanz des Zielprojekts. |
| Storage-Buckets und -Policies | Storage-Dienst des Zielprojekts. |
| Doctor Setup / Katalog / Job-Zeitpläne | Nur gegen die reale Zielinstanz aussagekräftig. |
| pg_cron mit `LOVABLE_CRON_SECRET` | Scheduler der Zielinstanz. |
| Öffentliche HTTPS Store API | Veröffentlichte Adresse des Zielprojekts. |

## Durchführung

1. Neues, leeres Lovable-Projekt anlegen (keine Wiederverwendung eines EYIS-Projekts,
   insbesondere nicht „EYIS Blackbox Install", „EYIS Commerce Backbone" oder „EYIS Storefront").
2. Lovable Cloud aktivieren, Datenbank leer belassen.
3. Den Prompt aus [`LOVABLE_PLATFORM_VALIDATION_PROMPT.md`](./LOVABLE_PLATFORM_VALIDATION_PROMPT.md)
   unverändert in dieses neue Projekt geben.
4. Antwort des Zielprojekts hierher zurückspielen.

Erst wenn das Zielprojekt alle acht Blöcke mit PASS und `Manual Code Repairs: 0` meldet, gilt:

    EYIS FULL BLACKBOX INSTALL PASS — READY FOR v1.0.0

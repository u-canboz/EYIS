# Betriebsarten — welcher Auftrag liegt vor?

Diese Entscheidung steht **vor** jeder technischen Arbeit. Sie bestimmt, ob überhaupt eine
Datenbank, ein Backend oder eine Installation angelegt wird.

> Der häufigste und teuerste Fehler eines neuen Agenten: für einen neuen Kunden oder eine neue
> Storefront eine neue Datenbank aufzubauen. Das ist in Betriebsart A und B **falsch**.

---

## Entscheidungsbaum

```text
Was soll entstehen?
├─ Ein weiterer Kunde/Mandant im bestehenden Commerce OS?      → A
├─ Ein eigenes Frontend/Shop-Design für einen bestehenden Shop? → B
└─ Eine komplett eigene, isolierte Commerce-OS-Installation
   (ausdrücklich gewünscht, eigene Datenbank, eigene Secrets)?  → C
```

---

## A — Neuer Kunde im bestehenden Commerce OS

**Ergebnis:** neue Organisation + neuer Shop in der laufenden Installation.

- **Neue Datenbank?** Nein.
- **Neues Backend?** Nein.
- **Neue Migration?** Nein — es werden nur Datensätze angelegt.
- **Arbeit:** Organisation anlegen, Shop konfigurieren (Währung, Steuern, Versand, Zahlungsart),
  Katalog befüllen, Publishable Key erzeugen.
- **Trennung:** garantiert über `organization_id`/`shop_id` und RLS, geprüft in
  `qa/PHASE14-RLS-REPORT.md`.
- **Anleitung:** [CUSTOMER_ONBOARDING.md](CUSTOMER_ONBOARDING.md)

## B — Neue React-/Lovable-Storefront

**Ergebnis:** ein eigenständiges Frontend-Projekt, das an einen bestehenden Shop andockt.

- **Neue Datenbank?** Nein.
- **Eigenes Commerce-Backend?** Nein.
- **Auth, Preise, Steuern, Bestellungen?** Kommen alle aus der Store API v1.
- **Was das Storefront-Projekt bekommt:** API-Basis-URL + Publishable Key. Mehr nicht.
- **Was es nie enthält:** Supabase-Client, Service-Role-Key, Datenbankzugriff, Preis- oder
  Steuerlogik, Bestandslogik.
- **SDK-Einbindung:** derzeit aus dem Repository-Quellstand (siehe
  [NEW_STOREFRONT_RUNBOOK.md](NEW_STOREFRONT_RUNBOOK.md)), noch **kein** npm-Paket.
- **Anleitung:** [NEW_STOREFRONT_RUNBOOK.md](NEW_STOREFRONT_RUNBOOK.md)

## C — Dedicated Deployment (eigenständige Installation)

**Ergebnis:** eine zweite, vollständig getrennte Commerce-OS-Instanz.

- **Neue Datenbank?** Ja — eigene Datenbank, eigene Auth, eigener Storage, eigene Secrets, eigener
  Cron.
- **Wann?** Nur wenn der Kunde vollständige Isolation ausdrücklich verlangt (Datenhoheit,
  Compliance, eigener Vertrag). Nie als Standardweg und nie als stille Annahme.
- **Arbeit:** Repository ausrollen, alle Migrationen aus `supabase/migrations/` anwenden, Secrets
  nach `docs/production/SECRETS_REGISTER.md` setzen, Cron-Zeitpläne einrichten, Health-Checks und
  Restore-Drill nach `docs/production/RESTORE_RUNBOOK.md` durchführen.
- **Kosten/Folgen ehrlich benennen:** eigener Betrieb, eigene Backups, eigene Updates, eigene
  Sicherheitsprüfung. Ein zweiter Datenbestand wird nicht automatisch mitgepflegt.

---

## Kurzvergleich

| | A — Neuer Kunde | B — Neue Storefront | C — Dedicated |
| --- | --- | --- | --- |
| Eigene Datenbank | nein | nein | ja |
| Eigene Auth | nein | nein | ja |
| Eigene Secrets | nein | nur Publishable Key (kein Geheimnis) | ja |
| Migrationen nötig | nein | nein | ja, alle |
| Änderung an diesem Repo | in der Regel nein | nein | Deployment-Konfiguration |
| Typischer Aufwand | Stunden | Tage (Design) | Wochen |

---

## Standardablauf für einen normalen Neukunden (A + B)

1. Im Commerce OS neue Organisation anlegen.
2. Shop konfigurieren (Währung, Steuersätze, Versandarten, Zahlungsart, Dokumenten-Nummernkreise).
3. Publishable Key erzeugen, Origin-Restriction auf die künftige Storefront-Domain setzen.
4. Neues Lovable-/React-Projekt starten.
5. Dem Agenten dieses Repository bzw. `docs/agent/` als Referenz geben.
6. API-Basis-URL und Publishable Key übergeben.
7. Agent bindet das SDK aus dem Repository-Quellstand ein.
8. Agent baut das individuelle Frontend — ausschließlich über SDK-Aufrufe.
9. E2E-Test: Katalog → Warenkorb → Checkout → Zahlung (Mock) → Bestellbestätigung.
10. Go-live: Origin-Restriction auf die Live-Domain, Live-Key erzeugen, Monitoring beobachten.

Das Commerce OS bleibt dabei die zentrale Engine. Eine neue Datenbank entsteht ausschließlich in
Betriebsart C.

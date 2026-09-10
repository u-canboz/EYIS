# Nachweis „Veröffentlichung“ abschließen (Lovable, Handschritt)

Die Installation bleibt bei Lovable. Lovable veröffentlicht neue Stände nicht von selbst — deshalb
wird dieser Punkt nicht durch eine Automatik grün, sondern durch eine einmalige, festgehaltene
Bestätigung plus verlässliche Erinnerung nach jedem Update.

## Was sich ändert

1. **Direkte Bestätigung am Punkt selbst.** Im Einrichtungsassistenten bekommt der Schritt
   „Veröffentlichung“ eine eigene Schaltfläche „Handschritt bestätigen“. Ein Klick genügt; der
   Punkt wechselt sofort auf „Bereit“, mit Datum und Person als Nachweis. Rückgängig machen bleibt
   möglich.
2. **Klarer Text statt Fachhinweis.** Der Hinweis auf Umgebungsvariablen und fremde Hosting-Anbieter
   verschwindet aus der Kundenansicht. Stattdessen: „Nach jedem Update in Lovable auf Publish →
   Update klicken. Ohne diesen Klick bleibt der bisherige Stand live.“
3. **Hosting wird festgeschrieben.** Der Assistent hinterlegt die Betriebsart „Lovable“ dauerhaft in
   der Installation, damit kein späterer Lauf wieder „Hostingvariante nicht deklariert“ meldet.
4. **Erinnerung, die wirklich erscheint.** Nach einem abgeschlossenen Update zeigt das Update Center
   oben einen deutlichen Hinweis mit Verweis auf Publish → Update, solange der Lauf nicht als
   veröffentlicht markiert wurde. Der Kunde markiert ihn mit einem Klick als erledigt.
5. **Ehrliche Bilanz.** Der Gesamtstatus meldet weiterhin, dass die Veröffentlichung ein bewusster
   Handschritt ist — nicht „vollautomatisch“.

## Technische Umsetzung

- `setup.server.ts`: `acknowledgePublishStep` setzt zusätzlich `hosting: "lovable_sync"` in
  `commerce_installation.update_config.setup`; neue Rückgabe enthält den Bestätigungszeitpunkt.
- `providers.server.ts`: `probeDeployment` formuliert den Lovable-Fall kundenverständlich um
  (bestätigt = SUPPORTED mit Nachweis, unbestätigt = offener Punkt mit Ein-Klick-Hinweis, kein
  Umgebungsvariablen-Text). `fullyAutomatic` bleibt für Lovable bewusst `false`.
- `updates-einrichtung.tsx`: Schritt „Veröffentlichung“ erhält eine Inline-Aktion über die
  bestehende Serverfunktion `acknowledgePublishStepFn`; Häkchen und Aktion teilen denselben Zustand.
- `update-center.server.ts` / `updates.tsx`: `publish_pending`-Kennzeichen pro abgeschlossenem Lauf
  in `update_config` plus Hinweisleiste mit „Als veröffentlicht markieren“ (neue Serverfunktion mit
  `system_updates.install`).
- Tests für die Zustandslogik des Deployment-Nachweises (bestätigt / unbestätigt / Git-Hosting) und
  für das Setzen und Zurückziehen der Bestätigung; danach `bun run generate:manifests`,
  `bun run eyis:pack:sign` und `bun run verify`.

## Nicht Teil dieser Arbeit

Keine Umstellung auf ein anderes Hosting, kein automatischer Publish-Aufruf (Lovable bietet dafür
keinen belegten Weg), keine Änderung am Update-Ablauf oder an der Signaturprüfung.

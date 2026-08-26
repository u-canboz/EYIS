# UI-Regeln (Phase 16)

Nur Präsentationsschicht. Keine Änderung an `src/lib/commerce/**` Serverlogik, `*.server.ts`,
`*.functions.ts`, `src/routes/api/**`, Migrationen oder `src/integrations/supabase/**`.
Datenabrufe und Mutationen bleiben exakt wie sie sind — nur Layout, Struktur und Zustände ändern.

## Bausteine (immer diese verwenden)

| Import | Zweck |
| --- | --- |
| `@/components/shell/PageHeader` → `PageHeader`, `StickyActionBar` | Seitenkopf, mobile Primäraktion |
| `@/components/shell/DetailLayout` → `DetailLayout`, `Panel`, `DataRow`, `ScrollTabs` | Detailseiten, Panels, Tab-Leisten |
| `@/components/data/TableScroll` → `TableScroll` | einziger sanktionierter horizontaler Scrollcontainer (`desktopOnly` blendet unter `lg` aus) |
| `@/components/data/RecordCard` → `RecordCard`, `RecordCardList` | Mobil-/Tabletdarstellung von Listen |
| `@/components/data/FilterBar` → `FilterBar` | Suche sichtbar, Filter mobil im Sheet, `activeCount`, `onReset` |
| `@/components/data/States` → `EmptyState`, `ErrorState`, `PermissionState`, `ListSkeleton` | Empty/Loading/Error/Berechtigung |

## Harte Regeln

1. Kein `overflow-x-hidden` zum Kaschieren. Ursache in der Komponente beheben:
   `min-w-0` an jedem Flex-/Grid-Textcontainer, `shrink-0` an Icons, `truncate` an einzeiligen Titeln.
2. Kopfzeilen mit Titel + Aktionen: `grid grid-cols-[minmax(0,1fr)_auto]` mobil, ab `sm:` `flex`.
   Am einfachsten `PageHeader` benutzen.
3. Listen: mobil `RecordCardList` mit `RecordCard`, Tabelle in `TableScroll desktopOnly`.
   Umschaltpunkt je nach Dichte (`lg` Standard, dünne Listen dürfen ab `md` Tabelle zeigen).
4. Geldbeträge und Zahlen: `tabular-nums`, nie `truncate`. SKUs: `break-words`, nie `break-all`.
5. Touch-Ziele mindestens 44 px (`min-h-11`, `size-11` für Icon-Buttons).
6. Sticky Bottom Actions nur mit `pb-safe` (`StickyActionBar` erledigt das).
7. Nur semantische Tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary` …).
   Keine `text-white`, `bg-black`, keine Hex-Werte, keine Gradients/Glassmorphism/Blobs.
8. Jede Liste und Detailseite behandelt: befüllt, leer (`EmptyState`), Laden (`ListSkeleton`),
   Fehler (`ErrorState`), fehlende Berechtigung (`PermissionState`).
9. Typografie: Fließtext nicht kleiner als `text-sm`, Sekundärinfo `text-xs`.
   Überschriften `font-display`.
10. Keine Card-Wüsten: zusammengehörige Felder in ein `Panel`, nicht je Feld eine Card.

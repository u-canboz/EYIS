import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, ArrowLeft, Mail, Users, Clock, Send } from "lucide-react";
import {
  newsletterOverviewFn,
  saveNewsletterFn,
  newsletterStateFn,
  testNewsletterFn,
  processNewsletterFn,
  unsubscribeNewsletterFn,
} from "@/lib/commerce/communications/newsletter.functions";
import { previewTemplateFn } from "@/lib/commerce/communications/communication.functions";
import {
  NEWSLETTER_STARTERS,
  NEWSLETTER_STATUS,
  type CampaignDraft,
} from "@/lib/commerce/communications/newsletter.types";
import type { Block } from "@/lib/commerce/communications/communication.types";
import type { Database } from "@/integrations/supabase/types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { SaveBar } from "@/eyis/shell/SaveBar";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";
import { MailBlockEditor } from "@/eyis/commerce/MailBlockEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/kommunikation/newsletter")({
  head: () => ({
    meta: [
      { title: "Newsletter Studio – EYIS" },
      {
        name: "description",
        content: "Abonnenten, Kampagnen und automatisierte E-Mails in deinem Shop-Design.",
      },
    ],
  }),
  component: NewsletterStudio,
});
type Campaign = Database["public"]["Tables"]["newsletter_campaigns"]["Row"];
const toDraft = (c: Campaign): CampaignDraft => ({
  id: c.id,
  name: c.name,
  subject: c.subject,
  preheader: c.preheader,
  blocks: c.blocks as unknown as Block[],
  kind: c.kind as CampaignDraft["kind"],
  delayMinutes: c.delay_minutes,
  scheduledAt: c.scheduled_at,
});
function NewsletterStudio() {
  const { organizationId, shopId, can, isLoading } = useActiveWorkspace();
  const scope = { organizationId, shopId };
  const fetch = useServerFn(newsletterOverviewFn),
    save = useServerFn(saveNewsletterFn),
    state = useServerFn(newsletterStateFn),
    test = useServerFn(testNewsletterFn),
    process = useServerFn(processNewsletterFn),
    unsubscribe = useServerFn(unsubscribeNewsletterFn),
    preview = useServerFn(previewTemplateFn);
  const [tab, setTab] = useState<"broadcast" | "welcome" | "subscribers">("broadcast");
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [testEmail, setTestEmail] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [activate, setActivate] = useState<Campaign | null>(null);
  const [subscriberPage, setSubscriberPage] = useState(1);
  const query = useQuery({
    queryKey: ["newsletter-studio", organizationId, shopId, search, statusFilter, subscriberPage],
    enabled: !!shopId && can("communications.read"),
    queryFn: () =>
      fetch({ data: { ...scope, search, status: statusFilter, page: subscriberPage } }),
  });
  const dirty = !!draft && JSON.stringify(draft) !== saved;
  const selected = query.data?.campaigns.find((c) => c.id === draft?.id);
  const editable =
    can("communications.manage") &&
    (!selected || (selected.status === "draft" && !selected.activated_at));
  const view = useQuery({
    queryKey: ["newsletter-preview", organizationId, shopId, draft],
    enabled: !!draft && !!shopId,
    queryFn: () =>
      preview({
        data: {
          ...scope,
          subject: draft!.subject,
          preheader: draft!.preheader,
          blocks: draft!.blocks,
          newsletter: true,
        },
      }),
  });
  const subscribed = query.data?.subscribedCount ?? 0;
  async function run(fn: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await fn();
      if (message) toast.success(message);
      await query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  function patch(p: Partial<CampaignDraft>) {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }
  async function saveNow() {
    if (!draft) return;
    await run(async () => {
      const result = await save({ data: { ...scope, draft } });
      const next = { ...draft, id: result.id };
      setDraft(next);
      setSaved(JSON.stringify(next));
    }, "Entwurf gespeichert.");
  }
  function open(c: Campaign) {
    const value = toDraft(c);
    setDraft(value);
    setSaved(JSON.stringify(value));
  }
  function starter(i: number) {
    const s = NEWSLETTER_STARTERS[i]!;
    const value: CampaignDraft = {
      name: s.name,
      subject: s.subject,
      preheader: "",
      blocks: structuredClone(s.blocks),
      kind: tab === "welcome" ? "welcome" : "broadcast",
      delayMinutes: 0,
      scheduledAt: null,
    };
    setDraft(value);
    setSaved("");
  }
  if (isLoading || query.isLoading) return <ListSkeleton />;
  if (!can("communications.read")) return <PermissionState />;
  if (query.isError)
    return (
      <ErrorState
        description="Das Newsletter-Studio konnte nicht geladen werden."
        action={<Button onClick={() => query.refetch()}>Erneut laden</Button>}
      />
    );
  return (
    <div className="min-w-0 space-y-6 pb-24">
      <PageHeader
        title={draft ? draft.name : "Newsletter Studio"}
        description={
          draft
            ? "Gestalte deine E-Mail, prüfe die Vorschau und sende zuerst einen Test."
            : "Persönliche E-Mails, passend zu deinem Shop. Von der Anmeldung bis zum Versand."
        }
        eyebrow={
          draft ? (
            <button
              className="inline-flex min-h-11 items-center gap-2"
              disabled={dirty}
              onClick={() => setDraft(null)}
            >
              <ArrowLeft className="size-4" />
              Alle Kampagnen
            </button>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/app/kommunikation/branding">Branding Studio</Link>
            </Button>
            {draft ? (
              <Button disabled={busy || !dirty || !editable} onClick={() => void saveNow()}>
                Entwurf speichern
              </Button>
            ) : (
              can("communications.manage") && (
                <Button onClick={() => starter(tab === "welcome" ? 1 : 0)}>
                  <Plus className="size-4" />
                  Neue E-Mail
                </Button>
              )
            )}
          </div>
        }
      />
      {!draft ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Bestätigte Abonnenten", value: subscribed, icon: Users },
              {
                label: "Kampagnen",
                value: query.data?.campaigns.filter((c) => c.kind === "broadcast").length ?? 0,
                icon: Mail,
              },
              {
                label: "Aktive Automationen",
                value:
                  query.data?.campaigns.filter((c) => c.kind === "welcome" && c.status === "active")
                    .length ?? 0,
                icon: Clock,
              },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-5">
                <m.icon className="mb-3 size-5 text-muted-foreground" />
                <p className="font-display text-3xl tabular-nums">{m.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          <div
            role="tablist"
            aria-label="Newsletter-Bereiche"
            className="flex flex-wrap gap-2 border-b border-border pb-3"
          >
            {(
              [
                { key: "broadcast", label: "Kampagnen" },
                { key: "welcome", label: "Automationen" },
                { key: "subscribers", label: "Abonnenten" },
              ] as const
            ).map((t) => (
              <Button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                variant={tab === t.key ? "secondary" : "ghost"}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          {tab === "subscribers" ? (
            <Panel
              title="Deine Newsletter-Community"
              description="Hier erscheinen Anmeldungen über die Store API nach der E-Mail-Bestätigung. Bestandskunden werden nicht automatisch angemeldet."
            >
              <div className="flex flex-wrap gap-3 pb-4">
                <Input
                  className="sm:max-w-sm"
                  aria-label="Abonnenten suchen"
                  placeholder="Name oder E-Mail suchen…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSubscriberPage(1);
                  }}
                />
                <select
                  aria-label="Anmeldestatus filtern"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setSubscriberPage(1);
                  }}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Alle Status</option>
                  {["subscribed", "pending", "unsubscribed"].map((s) => (
                    <option key={s} value={s}>
                      {NEWSLETTER_STATUS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="divide-y divide-border">
                {query.data?.subscribers
                  .filter(
                    (s) =>
                      (statusFilter === "all" || s.status === statusFilter) &&
                      `${s.email} ${s.first_name}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((s) => (
                    <div key={s.id} className="flex min-w-0 flex-wrap items-center gap-3 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium">{s.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.first_name || "Ohne Namensangabe"} ·{" "}
                          {s.confirmed_at
                            ? `Bestätigt am ${new Date(s.confirmed_at).toLocaleDateString("de-DE")}`
                            : "Bestätigung ausstehend"}
                        </p>
                      </div>
                      <Badge variant="secondary">{NEWSLETTER_STATUS[s.status]}</Badge>
                      {s.status === "subscribed" && can("communications.manage") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => unsubscribe({ data: { ...scope, id: s.id } }),
                              "Abonnent abgemeldet.",
                            )
                          }
                        >
                          Abmelden
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
              {!query.data?.subscribers.length && (
                <EmptyState
                  title="Die ersten Anmeldungen warten auf dich"
                  description="Verbinde das Newsletter-Formular deiner Storefront über newsletter.subscribe im Store SDK. Jede Anmeldung erhält eine Bestätigungsmail."
                />
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                {query.data?.subscriberCount ?? 0} Anmeldungen · Seite {subscriberPage}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  disabled={subscriberPage === 1}
                  onClick={() => setSubscriberPage((p) => p - 1)}
                >
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  disabled={subscriberPage * 50 >= (query.data?.subscriberCount ?? 0)}
                  onClick={() => setSubscriberPage((p) => p + 1)}
                >
                  Weiter
                </Button>
              </div>
            </Panel>
          ) : (
            <>
              {tab === "welcome" && (
                <Panel
                  title="Automatisch willkommen heißen"
                  description="Diese E-Mail wird einmal pro Abonnent nach bestätigter Anmeldung versendet. Du legst fest, wie lange die Automation warten soll."
                >
                  {null}
                </Panel>
              )}
              <div className="space-y-3">
                {query.data?.campaigns
                  .filter((c) => c.kind === tab)
                  .map((c) => (
                    <button
                      key={c.id}
                      className="flex w-full min-w-0 flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/40"
                      onClick={() => open(c)}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Mail className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.name}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {c.subject || "Betreff ergänzen"}
                        </p>
                      </div>
                      <Badge variant="secondary">{NEWSLETTER_STATUS[c.status]}</Badge>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {query.data?.campaignStats.find((stats) => stats.campaign_id === c.id)
                          ?.sent ?? 0}{" "}
                        gesendet
                      </span>
                    </button>
                  ))}
              </div>
              {!query.data?.campaigns.some((c) => c.kind === tab) && (
                <EmptyState
                  title={tab === "welcome" ? "Deine erste Willkommensmail" : "Deine erste Kampagne"}
                  description="Starte mit einer Vorlage und gestalte die E-Mail mit Texten, Bildern und Produkten."
                />
              )}
              <Panel title="Mit einer Vorlage starten">
                <div className="grid gap-3 md:grid-cols-3">
                  {NEWSLETTER_STARTERS.map((s, i) => (
                    <button
                      key={s.name}
                      disabled={!can("communications.manage")}
                      onClick={() => starter(i)}
                      className="space-y-3 rounded-lg border border-border p-4 text-left hover:bg-muted/40"
                    >
                      <Mail className="size-5 text-muted-foreground" />
                      <h3 className="font-medium">{s.name}</h3>
                      <p className="text-sm text-muted-foreground">{s.subject}</p>
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {can("communications.manage") && (
            <Panel
              title="Versandstatus"
              description="Geplante E-Mails werden über den eingerichteten Kommunikations-Job verarbeitet. Du kannst fällige Sendungen hier auch manuell anstoßen."
            >
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const result = await process({ data: scope });
                    if (result.newsletters.errors.length)
                      throw new Error(result.newsletters.errors.join(" · "));
                    toast.success(`${result.messages.sent} E-Mails verarbeitet.`);
                  })
                }
              >
                <Send className="size-4" />
                Fälligen Versand verarbeiten
              </Button>
              <Link to="/app/kommunikation/verlauf" className="ml-4 text-sm underline">
                Versandprotokoll öffnen
              </Link>
            </Panel>
          )}
        </>
      ) : (
        <>
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <div className="min-w-0 space-y-5">
              <Panel title="Kampagnendetails" bodyClassName="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Interner Name</Label>
                  <Input
                    id="campaign-name"
                    disabled={!editable}
                    value={draft.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-subject">Betreff</Label>
                  <Input
                    id="campaign-subject"
                    disabled={!editable}
                    value={draft.subject}
                    onChange={(e) => patch({ subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-preheader">Vorschautext im Posteingang</Label>
                  <Input
                    id="campaign-preheader"
                    disabled={!editable}
                    value={draft.preheader}
                    onChange={(e) => patch({ preheader: e.target.value })}
                  />
                </div>
                {draft.kind === "welcome" ? (
                  <div className="space-y-2">
                    <Label htmlFor="delay">Wartezeit nach Anmeldung (Minuten)</Label>
                    <Input
                      id="delay"
                      type="number"
                      min={0}
                      max={43200}
                      disabled={!editable}
                      value={draft.delayMinutes}
                      onChange={(e) => patch({ delayMinutes: Number(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="schedule">Versandzeitpunkt (optional)</Label>
                    <Input
                      id="schedule"
                      type="datetime-local"
                      disabled={!editable}
                      value={
                        draft.scheduledAt
                          ? new Date(
                              new Date(draft.scheduledAt).getTime() -
                                new Date(draft.scheduledAt).getTimezoneOffset() * 60000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        patch({
                          scheduledAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Ohne Zeitpunkt wird die Kampagne nach Freigabe für den nächsten Versandlauf
                      vorbereitet.
                    </p>
                  </div>
                )}
              </Panel>
              <Panel title="Inhalt">
                <MailBlockEditor
                  newsletter
                  blocks={draft.blocks}
                  disabled={!editable}
                  onChange={(blocks) => patch({ blocks })}
                />
              </Panel>
            </div>
            <div className="min-w-0 space-y-5">
              <Panel title="E-Mail-Vorschau" bodyClassName="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={device === "desktop" ? "secondary" : "ghost"}
                    onClick={() => setDevice("desktop")}
                  >
                    Desktop
                  </Button>
                  <Button
                    size="sm"
                    variant={device === "mobile" ? "secondary" : "ghost"}
                    onClick={() => setDevice("mobile")}
                  >
                    Mobil
                  </Button>
                </div>
                {view.isError ? (
                  <ErrorState
                    description={
                      view.error instanceof Error ? view.error.message : "Vorschau nicht verfügbar."
                    }
                  />
                ) : (
                  <iframe
                    title="Newsletter-Vorschau"
                    sandbox=""
                    srcDoc={
                      view.data?.html ??
                      '<p style="font-family:sans-serif">Vorschau wird geladen…</p>'
                    }
                    className="mx-auto h-[700px] w-full rounded-lg border border-border bg-card"
                    style={{ maxWidth: device === "mobile" ? 375 : 640 }}
                  />
                )}
              </Panel>
              <Panel
                title="Testversand"
                description="Prüfe die E-Mail vor der Freigabe in deinem Postfach. Der interne Testanbieter speichert sie im Versandprotokoll."
              >
                <div className="flex flex-wrap gap-2">
                  <Input
                    aria-label="Testempfänger"
                    type="email"
                    placeholder="deine@adresse.de"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    variant="outline"
                    disabled={busy || !testEmail || !can("communications.send_test")}
                    onClick={() =>
                      run(
                        () => test({ data: { ...scope, draft, email: testEmail } }),
                        "Testmail verarbeitet.",
                      )
                    }
                  >
                    Test senden
                  </Button>
                </div>
              </Panel>
              <Panel
                title="Freigabe"
                description={
                  draft.kind === "welcome"
                    ? "Die Automation startet für neue bestätigte Anmeldungen."
                    : "Empfänger sind alle zum Versandzeitpunkt bestätigten Abonnenten."
                }
              >
                <div className="flex flex-wrap gap-2">
                  {selected && ["scheduled", "active", "completed"].includes(selected.status) ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => state({ data: { ...scope, id: selected.id, action: "pause" } }),
                          "Versand pausiert.",
                        )
                      }
                    >
                      Pausieren
                    </Button>
                  ) : (
                    <Button
                      disabled={
                        busy ||
                        dirty ||
                        !selected ||
                        selected.status === "completed" ||
                        !can("communications.manage")
                      }
                      onClick={() => selected && setActivate(selected)}
                    >
                      {draft.kind === "welcome" ? "Automation aktivieren" : "Versand freigeben"}
                    </Button>
                  )}
                  {selected && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const { id, ...copy } = draft;
                        setDraft({ ...copy, name: `${copy.name} – Kopie`, scheduledAt: null });
                        setSaved("");
                      }}
                    >
                      Als neue E-Mail kopieren
                    </Button>
                  )}
                  <Badge variant="outline">{NEWSLETTER_STATUS[selected?.status ?? "draft"]}</Badge>
                </div>
              </Panel>
            </div>
          </div>
          <SaveBar
            dirty={dirty}
            saving={busy}
            disabled={!editable}
            onSave={() => void saveNow()}
            onDiscard={() => {
              if (selected) open(selected);
              else setDraft(null);
            }}
          />
        </>
      )}
      <AlertDialog open={!!activate} onOpenChange={(open) => !open && setActivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {activate?.kind === "welcome"
                ? "Willkommensmail aktivieren?"
                : "Kampagne zum Versand freigeben?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {activate?.name}: {activate?.subject}.{" "}
              {activate?.kind === "welcome"
                ? "Neue bestätigte Abonnenten erhalten diese E-Mail automatisch."
                : `Aktuell sind ${subscribed} Abonnenten bestätigt. Die endgültige Empfängerliste richtet sich nach dem Anmeldestatus zum Versandzeitpunkt.`}{" "}
              Nach der Freigabe bleibt diese Fassung unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück zur Vorschau</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const c = activate;
                setActivate(null);
                if (c)
                  void run(
                    () => state({ data: { ...scope, id: c.id, action: "activate" } }),
                    "Versand freigegeben.",
                  );
              }}
            >
              Freigeben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

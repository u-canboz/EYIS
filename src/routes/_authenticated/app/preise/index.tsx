import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPriceOverview, bulkUpdatePrices } from "@/lib/commerce/pricing.functions";
import { listCustomerGroups, saveCustomerGroup } from "@/lib/commerce/customer-groups.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney, parseMoneyToMinor, PRICE_TYPE_LABELS } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { FilterBar } from "@/eyis/data/FilterBar";
import { RecordCard, RecordCardList } from "@/eyis/data/RecordCard";
import { TableScroll } from "@/eyis/data/TableScroll";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/preise/")({
  head: () => ({
    meta: [
      { title: "Preise – EYIS" },
      {
        name: "description",
        content:
          "Alle Preiszeilen deines Shops im Überblick: Normalpreise, Aktionen, Staffeln und Kundengruppen.",
      },
      { property: "og:title", content: "Preise – EYIS" },
      { property: "og:description", content: "Preisregeln zentral pflegen und in Serie ändern." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingOverviewPage,
});

const MODES = [
  { value: "increase_percent", label: "Prozent erhöhen" },
  { value: "decrease_percent", label: "Prozent senken" },
  { value: "increase_amount", label: "Betrag erhöhen" },
  { value: "decrease_amount", label: "Betrag senken" },
  { value: "set", label: "Auf festen Betrag setzen" },
] as const;

function PricingOverviewPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("increase_percent");
  const [modeValue, setModeValue] = useState("10");
  const [groupName, setGroupName] = useState("");

  const fetchOverview = useServerFn(listPriceOverview);
  const fetchGroups = useServerFn(listCustomerGroups);
  const runBulk = useServerFn(bulkUpdatePrices);
  const runSaveGroup = useServerFn(saveCustomerGroup);

  const enabled = Boolean(organizationId && shopId);

  const overviewQuery = useQuery({
    queryKey: ["price-overview", organizationId, shopId, typeFilter, search],
    enabled,
    queryFn: () =>
      fetchOverview({
        data: {
          organizationId,
          shopId,
          ...(typeFilter === "all" ? {} : { type: typeFilter }),
          search,
        },
      }),
  });

  const groupsQuery = useQuery({
    queryKey: ["customer-groups", organizationId, shopId],
    enabled,
    queryFn: () => fetchGroups({ data: { organizationId, shopId } }),
  });

  const groupName_ = useMemo(
    () => new Map((groupsQuery.data?.groups ?? []).map((g) => [g.id, g.name])),
    [groupsQuery.data],
  );

  const items = overviewQuery.data?.items ?? [];
  const canManage = can("pricing.manage");
  const canManageGroups = can("customer_groups.manage");

  const bulkMutation = useMutation({
    mutationFn: () => {
      const isPercent = mode.endsWith("percent");
      const parsed = isPercent
        ? Math.round(Number(modeValue.replace(",", ".")) * 100)
        : parseMoneyToMinor(modeValue);
      if (parsed === null || !Number.isFinite(parsed) || parsed <= 0)
        throw new Error("Bitte gib einen gültigen Wert an.");
      return runBulk({
        data: {
          organizationId,
          priceIds: selected,
          mode,
          ...(isPercent ? { percentBp: parsed } : { amountMinor: parsed }),
          idempotencyKey: crypto.randomUUID(),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`${result.updated ?? 0} Preiszeilen aktualisiert.`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["price-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const groupMutation = useMutation({
    mutationFn: () => runSaveGroup({ data: { organizationId, shopId, name: groupName } }),
    onSuccess: () => {
      toast.success("Kundengruppe gespeichert.");
      setGroupName("");
      queryClient.invalidateQueries({ queryKey: ["customer-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const activeFilters = typeFilter !== "all" ? 1 : 0;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Preise"
        description="Alle gespeicherten Preiszeilen. Massenänderungen wirken immer auf die ausgewählten Zeilen, nie auf einen berechneten Preis."
        actions={
          <Button asChild variant="outline" className="h-11">
            <Link to="/app/preise/testen">Preis testen</Link>
          </Button>
        }
      />

      <Panel title="Preiszeilen">
        <FilterBar
          activeCount={activeFilters}
          onReset={() => setTypeFilter("all")}
          search={
            <Input
              className="h-11 w-full"
              placeholder="Produkt oder Variante"
              aria-label="Preiszeilen suchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
          filters={
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger aria-label="Preisart" className="h-11 w-full md:w-48">
                <SelectValue placeholder="Preisart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Preisarten</SelectItem>
                {Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <div className="mt-5">
          {overviewQuery.isLoading ? (
            <ListSkeleton />
          ) : overviewQuery.error ? (
            <ErrorState description={(overviewQuery.error as Error).message} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Keine Preise angelegt"
              description="Preise pflegst du im Produkt-Editor im Tab „Preise“."
            />
          ) : (
            <>
              <RecordCardList>
                {items.map((item) => (
                  <RecordCard
                    key={item.id}
                    title={item.productName}
                    subtitle={item.variantTitle ?? "Ohne Variante"}
                    trailing={formatMoney(item.amount_minor, item.currency_code)}
                    badges={
                      <>
                        <Badge variant="secondary">
                          {PRICE_TYPE_LABELS[item.type] ?? item.type}
                        </Badge>
                        {canManage && (
                          <label className="ml-auto flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={selected.includes(item.id)}
                              onCheckedChange={() => toggle(item.id)}
                              aria-label="Preiszeile auswählen"
                            />
                            auswählen
                          </label>
                        )}
                      </>
                    }
                    fields={[
                      {
                        label: "Gültigkeit",
                        value:
                          item.starts_at || item.ends_at
                            ? `${item.starts_at ? new Date(item.starts_at).toLocaleDateString("de-DE") : "…"} – ${
                                item.ends_at ? new Date(item.ends_at).toLocaleDateString("de-DE") : "…"
                              }`
                            : "dauerhaft",
                      },
                      {
                        label: "Menge",
                        value: `${item.min_quantity ? `ab ${item.min_quantity}` : "—"}${
                          item.max_quantity ? ` bis ${item.max_quantity}` : ""
                        }`,
                      },
                      {
                        label: "Gruppe",
                        value: item.customer_group_id
                          ? (groupName_.get(item.customer_group_id) ?? "Gruppe")
                          : "—",
                      },
                    ]}
                  />
                ))}
              </RecordCardList>

              <TableScroll desktopOnly>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="w-10 p-3" />
                      <th className="p-3 font-medium">Produkt</th>
                      <th className="p-3 font-medium">Variante</th>
                      <th className="p-3 font-medium">Art</th>
                      <th className="p-3 font-medium">Gültigkeit</th>
                      <th className="p-3 font-medium">Menge</th>
                      <th className="p-3 font-medium">Gruppe</th>
                      <th className="p-3 text-right font-medium">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="p-3">
                          <Checkbox
                            checked={selected.includes(item.id)}
                            onCheckedChange={() => toggle(item.id)}
                            aria-label="Preiszeile auswählen"
                          />
                        </td>
                        <td className="max-w-[16rem] p-3">
                          <Link
                            to="/app/produkte/$productId"
                            params={{ productId: item.productId }}
                            className="truncate font-medium hover:underline"
                          >
                            {item.productName}
                          </Link>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.variantTitle ?? "—"}</td>
                        <td className="p-3">
                          <Badge variant="secondary">
                            {PRICE_TYPE_LABELS[item.type] ?? item.type}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {item.starts_at || item.ends_at
                            ? `${item.starts_at ? new Date(item.starts_at).toLocaleDateString("de-DE") : "…"} – ${
                                item.ends_at ? new Date(item.ends_at).toLocaleDateString("de-DE") : "…"
                              }`
                            : "dauerhaft"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {item.min_quantity ? `ab ${item.min_quantity}` : "—"}
                          {item.max_quantity ? ` bis ${item.max_quantity}` : ""}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {item.customer_group_id
                            ? (groupName_.get(item.customer_group_id) ?? "Gruppe")
                            : "—"}
                        </td>
                        <td className="p-3 text-right font-medium tabular-nums">
                          {formatMoney(item.amount_minor, item.currency_code)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </>
          )}
        </div>

        {canManage && items.length > 0 && (
          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
            <p className="w-full text-sm font-medium">
              Massenänderung ({selected.length} ausgewählt)
            </p>
            <div className="w-full sm:w-[240px]">
              <Label>Aktion</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[160px]">
              <Label>{mode.endsWith("percent") ? "Prozent" : "Betrag"}</Label>
              <Input
                className="mt-2 h-11"
                value={modeValue}
                onChange={(e) => setModeValue(e.target.value)}
              />
            </div>
            <Button
              className="h-11"
              disabled={selected.length === 0 || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              Anwenden
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Relative Änderungen rechnen immer vom gespeicherten Betrag der jeweiligen Zeile.
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Kundengruppen">
        <div className="space-y-2">
          {(groupsQuery.data?.groups ?? []).map((group) => (
            <div
              key={group.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2 last:border-b-0"
            >
              <div className="min-w-0">
                <span className="truncate text-sm font-medium">{group.name}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">/{group.handle}</span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {group.status}
              </Badge>
            </div>
          ))}
          {(groupsQuery.data?.groups ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Kundengruppen angelegt.</p>
          )}
        </div>
        {canManageGroups && (
          <div className="mt-5 flex flex-col items-end gap-3 sm:flex-row">
            <div className="w-full flex-1">
              <Label>Neue Kundengruppe</Label>
              <Input
                className="mt-2 h-11"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="z. B. B2B"
              />
            </div>
            <Button
              className="h-11 w-full sm:w-auto"
              disabled={!groupName.trim() || groupMutation.isPending}
              onClick={() => groupMutation.mutate()}
            >
              Hinzufügen
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

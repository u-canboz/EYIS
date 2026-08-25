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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/preise/")({
  head: () => ({
    meta: [
      { title: "Preise – Commerce OS" },
      {
        name: "description",
        content:
          "Alle Preiszeilen deines Shops im Überblick: Normalpreise, Aktionen, Staffeln und Kundengruppen.",
      },
      { property: "og:title", content: "Preise – Commerce OS" },
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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Preise</h1>
          <p className="text-sm text-muted-foreground">
            Alle gespeicherten Preiszeilen. Massenänderungen wirken immer auf die ausgewählten
            Zeilen, nie auf einen berechneten Preis.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/preise/testen">Preis testen</Link>
        </Button>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label>Suche</Label>
            <Input
              className="mt-2"
              placeholder="Produkt oder Variante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-[220px]">
            <Label>Preisart</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {overviewQuery.isLoading ? (
          <Skeleton className="mt-6 h-40 w-full" />
        ) : items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Noch keine Preise angelegt. Preise pflegst du im Produkt-Editor im Tab „Preise“.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="w-10 py-2" />
                  <th className="py-2">Produkt</th>
                  <th className="py-2">Variante</th>
                  <th className="py-2">Art</th>
                  <th className="py-2">Gültigkeit</th>
                  <th className="py-2">Menge</th>
                  <th className="py-2">Gruppe</th>
                  <th className="py-2 text-right">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">
                      <Checkbox
                        checked={selected.includes(item.id)}
                        onCheckedChange={() => toggle(item.id)}
                        aria-label="Preiszeile auswählen"
                      />
                    </td>
                    <td className="py-2">
                      <Link
                        to="/app/produkte/$productId"
                        params={{ productId: item.productId }}
                        className="font-medium hover:underline"
                      >
                        {item.productName}
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground">{item.variantTitle ?? "—"}</td>
                    <td className="py-2">
                      <Badge variant="secondary">{PRICE_TYPE_LABELS[item.type] ?? item.type}</Badge>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {item.starts_at || item.ends_at
                        ? `${item.starts_at ? new Date(item.starts_at).toLocaleDateString("de-DE") : "…"} – ${
                            item.ends_at ? new Date(item.ends_at).toLocaleDateString("de-DE") : "…"
                          }`
                        : "dauerhaft"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {item.min_quantity ? `ab ${item.min_quantity}` : "—"}
                      {item.max_quantity ? ` bis ${item.max_quantity}` : ""}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {item.customer_group_id
                        ? (groupName_.get(item.customer_group_id) ?? "Gruppe")
                        : "—"}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatMoney(item.amount_minor, item.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && (
          <div className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-dashed p-4">
            <p className="w-full text-sm font-medium">
              Massenänderung ({selected.length} ausgewählt)
            </p>
            <div className="w-[240px]">
              <Label>Aktion</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger className="mt-2">
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
            <div className="w-[160px]">
              <Label>{mode.endsWith("percent") ? "Prozent" : "Betrag"}</Label>
              <Input
                className="mt-2"
                value={modeValue}
                onChange={(e) => setModeValue(e.target.value)}
              />
            </div>
            <Button
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
      </section>

      <section className="rounded-lg border bg-card p-6">
        <p className="font-medium">Kundengruppen</p>
        <div className="mt-4 space-y-2">
          {(groupsQuery.data?.groups ?? []).map((group) => (
            <div key={group.id} className="flex items-center justify-between border-b py-2">
              <div>
                <span className="text-sm font-medium">{group.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">/{group.handle}</span>
              </div>
              <Badge variant="secondary">{group.status}</Badge>
            </div>
          ))}
          {(groupsQuery.data?.groups ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Kundengruppen angelegt.</p>
          )}
        </div>
        {canManageGroups && (
          <div className="mt-6 flex items-end gap-3">
            <div className="flex-1">
              <Label>Neue Kundengruppe</Label>
              <Input
                className="mt-2"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="z. B. B2B"
              />
            </div>
            <Button
              disabled={!groupName.trim() || groupMutation.isPending}
              onClick={() => groupMutation.mutate()}
            >
              Hinzufügen
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

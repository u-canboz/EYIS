import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listCustomersFn, saveCustomerFn } from "@/lib/commerce/customers/customer.functions";
import {
  CUSTOMER_STATUS_LABELS,
  type CustomerStatus,
} from "@/lib/commerce/customers/customer.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { RecordCard, RecordCardList } from "@/components/data/RecordCard";
import { TableScroll } from "@/components/data/TableScroll";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/kunden/")({
  head: () => ({
    meta: [
      { title: "Kunden – Commerce OS" },
      {
        name: "description",
        content: "Kundenkonten, Adressen, Bestellhistorie und Kundengruppen verwalten.",
      },
      { property: "og:title", content: "Kunden – Commerce OS" },
      {
        property: "og:description",
        content: "Zentrale Kundenverwaltung mit Historie, Gruppen und Sperren.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

const STATUS_FILTERS: { key: string; label: string; status: CustomerStatus | null }[] = [
  { key: "all", label: "Alle", status: null },
  { key: "active", label: "Aktiv", status: "active" },
  { key: "guest", label: "Gäste", status: "guest" },
  { key: "blocked", label: "Gesperrt", status: "blocked" },
  { key: "archived", label: "Archiviert", status: "archived" },
];

function CustomersPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, shops, can } = useActiveWorkspace();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    type: "b2c",
  });

  const fetchCustomers = useServerFn(listCustomersFn);
  const save = useServerFn(saveCustomerFn);
  const status = STATUS_FILTERS.find((s) => s.key === tab)?.status ?? null;

  const customers = useQuery({
    queryKey: ["customers", organizationId, shopId, tab, search],
    enabled: !!organizationId,
    queryFn: () =>
      fetchCustomers({
        data: { organizationId, shopId: shopId || null, status, search: search || null },
      }),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.email.trim()) throw new Error("E-Mail ist erforderlich.");
      return await save({
        data: {
          organizationId,
          shopId: shopId || shops[0]?.id || "",
          email: form.email,
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          phone: form.phone || null,
          customerType: form.type as "b2c" | "b2b",
        },
      });
    },
    onSuccess: () => {
      toast.success("Kunde angelegt.");
      setOpen(false);
      setForm({ email: "", firstName: "", lastName: "", phone: "", type: "b2c" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("customers.read")) {
    return <PermissionState what="Kunden" />;
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Kunden"
        description="Konten, Bestellhistorie, Gruppen und Sperren – zentral pro Shop."
        actions={
          can("customers.manage") ? (
            <Button className="h-11" onClick={() => setOpen(true)}>
              Kunde anlegen
            </Button>
          ) : null
        }
      />

      <div className="min-w-0 space-y-3">
        <Input
          className="h-11 w-full md:max-w-sm"
          placeholder="Name oder E-Mail suchen"
          aria-label="Kunden suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="scroll-x -mx-4 flex gap-2 px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              className="h-10 shrink-0"
              variant={tab === f.key ? "default" : "outline"}
              onClick={() => setTab(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {customers.isLoading ? (
        <ListSkeleton />
      ) : customers.error ? (
        <ErrorState description={(customers.error as Error).message} />
      ) : !customers.data?.length ? (
        <EmptyState
          title="Keine Kunden in dieser Auswahl"
          description="Wechsle den Statusfilter oder lege einen Kunden an."
        />
      ) : (
        <>
          <RecordCardList>
            {customers.data.map((c) => (
              <Link key={c.id} to="/app/kunden/$customerId" params={{ customerId: c.id }}>
                <RecordCard
                  interactive
                  title={[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                  subtitle={c.email}
                  trailing={formatMoney(c.totalSpentMinor, c.currencyCode)}
                  badges={
                    <>
                      <Badge variant={c.status === "blocked" ? "destructive" : "secondary"}>
                        {CUSTOMER_STATUS_LABELS[c.status]}
                      </Badge>
                      {c.hasAccount ? <Badge variant="outline">Konto</Badge> : null}
                    </>
                  }
                  fields={[
                    { label: "Bestellungen", value: c.orderCount },
                    {
                      label: "Letzte Bestellung",
                      value: c.lastOrderAt
                        ? new Date(c.lastOrderAt).toLocaleDateString("de-DE")
                        : "—",
                    },
                  ]}
                />
              </Link>
            ))}
          </RecordCardList>

          <TableScroll desktopOnly>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Kunde</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Bestellungen</th>
                  <th className="px-4 py-3 text-right">Umsatz</th>
                  <th className="px-4 py-3">Letzte Bestellung</th>
                </tr>
              </thead>
              <tbody>
                {customers.data.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="max-w-[22rem] px-4 py-3">
                      <Link
                        to="/app/kunden/$customerId"
                        params={{ customerId: c.id }}
                        className="font-medium hover:underline"
                      >
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === "blocked" ? "destructive" : "secondary"}>
                        {CUSTOMER_STATUS_LABELS[c.status]}
                      </Badge>
                      {c.hasAccount && (
                        <span className="ml-2 text-xs text-muted-foreground">Konto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(c.totalSpentMinor, c.currencyCode)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("de-DE") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kunde anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email">E-Mail</Label>
              <Input
                className="h-11"
                id="email"
                className="h-11"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="first">Vorname</Label>
                <Input
                  id="first"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="last">Nachname</Label>
                <Input
                  id="last"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Kundentyp</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2c">Privatkunde</SelectItem>
                    <SelectItem value="b2b">Geschäftskunde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="min-h-11 w-full" onClick={() => create.mutate()} disabled={create.isPending}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

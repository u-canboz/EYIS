import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addCustomerNoteFn,
  getCustomerFn,
  saveCustomerAddressFn,
  setCustomerGroupsFn,
  setCustomerStatusFn,
} from "@/lib/commerce/customers/customer.functions";
import { listCustomerGroups } from "@/lib/commerce/customer-groups.functions";
import { listReturnsFn } from "@/lib/commerce/returns/return.functions";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_KIND_LABELS } from "@/lib/commerce/customers/customer.types";
import { RETURN_STATUS_LABELS } from "@/lib/commerce/returns/return.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { formatMoney } from "@/lib/commerce/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/app/kunden/$customerId")({
  head: () => ({
    meta: [
      { title: "Kundendetails – Commerce OS" },
      { name: "description", content: "Kundenprofil mit Adressen, Bestellungen, Retouren und Notizen." },
      { property: "og:title", content: "Kundendetails – Commerce OS" },
      { property: "og:description", content: "Alles zu einem Kunden auf einen Blick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetailPage,
  errorComponent: ({ error }) => (
    <p className="rounded-lg border p-6 text-sm text-destructive">{(error as Error).message}</p>
  ),
  notFoundComponent: () => <p className="p-6 text-sm">Kunde nicht gefunden.</p>,
});

const EMPTY_ADDRESS = {
  type: "both" as const,
  firstName: "",
  lastName: "",
  company: "",
  street: "",
  postalCode: "",
  city: "",
  countryCode: "DE",
  phone: "",
};

function CustomerDetailPage() {
  const { customerId } = Route.useParams();
  const queryClient = useQueryClient();
  const { organizationId, can } = useActiveWorkspace();
  const [note, setNote] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS });

  const fetchCustomer = useServerFn(getCustomerFn);
  const fetchGroups = useServerFn(listCustomerGroups);
  const fetchReturns = useServerFn(listReturnsFn);
  const setStatus = useServerFn(setCustomerStatusFn);
  const saveAddress = useServerFn(saveCustomerAddressFn);
  const setGroups = useServerFn(setCustomerGroupsFn);
  const addNote = useServerFn(addCustomerNoteFn);

  const customer = useQuery({
    queryKey: ["customer", organizationId, customerId],
    enabled: !!organizationId,
    queryFn: () => fetchCustomer({ data: { organizationId, customerId } }),
  });

  const groups = useQuery({
    queryKey: ["customer-groups", organizationId],
    enabled: !!organizationId,
    queryFn: () => fetchGroups({ data: { organizationId } }),
  });

  const returns = useQuery({
    queryKey: ["customer-returns", organizationId, customerId],
    enabled: !!organizationId,
    queryFn: () => fetchReturns({ data: { organizationId, customerId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["customer", organizationId, customerId] });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "blocked" | "archived") =>
      setStatus({ data: { organizationId, customerId, status } }),
    onSuccess: () => {
      toast.success("Status aktualisiert.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addressMutation = useMutation({
    mutationFn: () => saveAddress({ data: { organizationId, customerId, address } }),
    onSuccess: () => {
      toast.success("Adresse gespeichert.");
      setAddressOpen(false);
      setAddress({ ...EMPTY_ADDRESS });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groupMutation = useMutation({
    mutationFn: (groupIds: string[]) => setGroups({ data: { organizationId, customerId, groupIds } }),
    onSuccess: () => {
      toast.success("Kundengruppen aktualisiert.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noteMutation = useMutation({
    mutationFn: () => addNote({ data: { organizationId, customerId, body: note } }),
    onSuccess: () => {
      setNote("");
      toast.success("Notiz gespeichert.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (customer.isLoading || !customer.data) return <Skeleton className="h-96 w-full" />;
  const c = customer.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/kunden" className="text-xs text-muted-foreground hover:underline">
            ← Zurück zu Kunden
          </Link>
          <h1 className="font-display text-2xl font-semibold">
            {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email}
          </h1>
          <p className="text-sm text-muted-foreground">
            {c.email} · {CUSTOMER_KIND_LABELS[c.customerType]} · Kunde seit{" "}
            {new Date(c.createdAt).toLocaleDateString("de-DE")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={c.status === "blocked" ? "destructive" : "secondary"}>
            {CUSTOMER_STATUS_LABELS[c.status]}
          </Badge>
          {can("customers.block") &&
            (c.status === "blocked" ? (
              <Button size="sm" variant="outline" onClick={() => statusMutation.mutate("active")}>
                Entsperren
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("blocked")}>
                Sperren
              </Button>
            ))}
        </div>
      </header>

      {c.status === "blocked" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Gesperrt: keine neuen Bestellungen oder Retouren. Bestehende Bestellungen, Rechnungen und Belege bleiben
          weiterhin einsehbar.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bestellungen</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{c.orderCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bezahlter Umsatz</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(c.totalSpentMinor, c.currencyCode)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Retouren</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{c.returnCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Adressen</CardTitle>
          {can("customers.manage") && (
            <Button size="sm" variant="outline" onClick={() => setAddressOpen(true)}>
              Adresse hinzufügen
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!c.addresses.length ? (
            <p className="text-sm text-muted-foreground">Noch keine Adressen hinterlegt.</p>
          ) : (
            c.addresses.map((a) => (
              <div key={a.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {a.firstName} {a.lastName} {a.company ? `· ${a.company}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {a.street} {a.street2 ?? ""}, {a.postalCode} {a.city}, {a.countryCode}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kundengruppen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {!groups.data?.length ? (
            <p className="text-sm text-muted-foreground">Keine Kundengruppen angelegt.</p>
          ) : (
            groups.data.map((g) => {
              const checked = c.groupIds.includes(g.id);
              return (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={!can("customer_groups.assign")}
                    onCheckedChange={(v) =>
                      groupMutation.mutate(
                        v ? [...c.groupIds, g.id] : c.groupIds.filter((id) => id !== g.id),
                      )
                    }
                  />
                  {g.name}
                </label>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bestellhistorie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!c.orders.length ? (
            <p className="text-sm text-muted-foreground">Noch keine Bestellungen.</p>
          ) : (
            c.orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <Link
                    to="/app/bestellungen/$orderId"
                    params={{ orderId: o.id }}
                    className="font-medium hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.placedAt).toLocaleDateString("de-DE")} · {o.paymentStatus}
                  </p>
                </div>
                <span>{formatMoney(o.totalMinor, o.currencyCode)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retouren</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!returns.data?.length ? (
            <p className="text-sm text-muted-foreground">Keine Retouren.</p>
          ) : (
            returns.data.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <Link to="/app/retouren/$returnId" params={{ returnId: r.id }} className="font-medium hover:underline">
                  {r.returnNumber}
                </Link>
                <Badge variant="secondary">{RETURN_STATUS_LABELS[r.status]}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interne Notizen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {can("customers.manage") && (
            <div className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz hinzufügen" />
              <Button size="sm" disabled={!note.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
                Notiz speichern
              </Button>
            </div>
          )}
          {c.notes.map((n) => (
            <div key={n.id} className="rounded-md border p-3 text-sm">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("de-DE")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={addressOpen} onOpenChange={setAddressOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adresse hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vorname</Label>
              <Input value={address.firstName} onChange={(e) => setAddress({ ...address, firstName: e.target.value })} />
            </div>
            <div>
              <Label>Nachname</Label>
              <Input value={address.lastName} onChange={(e) => setAddress({ ...address, lastName: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Straße und Hausnummer</Label>
              <Input value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
            </div>
            <div>
              <Label>PLZ</Label>
              <Input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
            </div>
            <div>
              <Label>Ort</Label>
              <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </div>
            <div>
              <Label>Land (ISO)</Label>
              <Input value={address.countryCode} onChange={(e) => setAddress({ ...address, countryCode: e.target.value })} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => addressMutation.mutate()} disabled={addressMutation.isPending}>
            Speichern
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import type { StoreReturn } from "@/lib/store-sdk";
import { ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/storefront/errors";
import { formatDate } from "@/lib/storefront/money";
import { cn } from "@/lib/utils";

const REASONS = [
  "Artikel gefällt nicht",
  "Falsche Größe",
  "Beschädigt geliefert",
  "Falscher Artikel geliefert",
  "Anderer Grund",
];

export const Route = createFileRoute("/retouren")({
  head: () => ({
    meta: [
      { title: "Retoure anmelden | Hauptshop" },
      { name: "description", content: "Artikel in wenigen Schritten zurücksenden." },
      { property: "og:title", content: "Retoure anmelden | Hauptshop" },
      { property: "og:description", content: "Artikel in wenigen Schritten zurücksenden." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const client = useCommerce();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>(REASONS[0]!);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<StoreReturn | null>(null);

  const eligibility = useQuery({
    queryKey: ["commerce", "returns", "eligibility"],
    queryFn: () => client.returns.guestEligibility(),
    retry: false,
  });

  if (created) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <h1 className="text-3xl">Retoure {created.returnNumber} ist angemeldet</h1>
        <p className="mt-4 text-muted-foreground">
          Status: {created.status} · Angemeldet am {formatDate(created.requestedAt)}. Die weiteren
          Schritte bekommst du per E-Mail.
        </p>
        <Link to="/shop" className="mt-10 inline-block bg-primary px-6 py-3 text-sm text-primary-foreground">
          Zurück zum Shop
        </Link>
      </div>
    );
  }

  if (eligibility.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-24">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (eligibility.isError) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <h1 className="text-3xl">Retoure anmelden</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Öffne zuerst deine Bestellung — danach kannst du hier Artikel zurücksenden.
        </p>
        <Link
          to="/bestellung/gast"
          className="mt-8 inline-block bg-primary px-6 py-3 text-sm text-primary-foreground"
        >
          Bestellung öffnen
        </Link>
        <div className="mt-10">
          <ErrorState error={eligibility.error} onRetry={() => eligibility.refetch()} />
        </div>
      </div>
    );
  }

  const data = eligibility.data;

  if (!data?.eligible || data.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <h1 className="text-3xl">Retoure anmelden</h1>
        <p className="mt-4 text-muted-foreground">
          {data?.reason ?? "Für diese Bestellung ist derzeit keine Rücksendung möglich."}
        </p>
        <Link to="/kontakt" className="mt-8 inline-block border border-border px-6 py-3 text-sm">
          Support kontaktieren
        </Link>
      </div>
    );
  }

  const selected = Object.entries(quantities).filter(([, quantity]) => quantity > 0);

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl">Retoure anmelden</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Wähle die Artikel und die Menge, die du zurücksenden möchtest.
      </p>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {data.items.map((item) => {
          const quantity = quantities[item.orderItemId] ?? 0;
          return (
            <li key={item.orderItemId} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  Bis zu {item.returnableQuantity} Stück rücksendbar
                </p>
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: item.returnableQuantity + 1 }, (_, index) => index).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setQuantities({ ...quantities, [item.orderItemId]: value })}
                    className={cn(
                      "size-9 border text-sm",
                      value === quantity ? "border-foreground bg-foreground text-background" : "border-border",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 grid gap-3">
        <Label htmlFor="reason">Grund</Label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="h-10 border border-input bg-background px-3 text-sm"
        >
          {REASONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-3">
        <Label htmlFor="note">Anmerkung (optional)</Label>
        <Textarea id="note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <Button
        size="lg"
        className="mt-8"
        disabled={selected.length === 0 || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await client.returns.create({
              items: selected.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
              reason,
              note: note.trim() ? note.trim() : null,
            });
            setCreated(result);
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        Retoure absenden
      </Button>
    </div>
  );
}

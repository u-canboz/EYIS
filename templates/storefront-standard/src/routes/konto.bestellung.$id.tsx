import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCommerce } from "@/lib/store-sdk/react/provider";
import { useCustomerOrder } from "@/lib/store-sdk/react/hooks";
import { ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { OrderDetail } from "@/components/store/OrderDetail";
import { errorMessage } from "@/lib/storefront/errors";

export const Route = createFileRoute("/konto/bestellung/$id")({
  head: () => ({
    meta: [
      { title: "Bestelldetails | Hauptshop" },
      { name: "description", content: "Artikel, Versandstatus und Belege deiner Bestellung." },
      { property: "og:title", content: "Bestelldetails | Hauptshop" },
      { property: "og:description", content: "Artikel, Versandstatus und Belege deiner Bestellung." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = useParams({ from: "/konto/bestellung/$id" });
  const client = useCommerce();
  const query = useCustomerOrder(id);

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-16">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <Link to="/konto" className="text-sm text-muted-foreground underline underline-offset-4">
        Zurück zum Konto
      </Link>
      <OrderDetail
        order={query.data}
        onDocument={async (documentId) => {
          try {
            const { url } = await client.customer.documentUrl(id, documentId);
            if (url) window.open(url, "_blank", "noopener");
            else toast.error("Dieses Dokument ist noch nicht verfügbar.");
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
    </div>
  );
}

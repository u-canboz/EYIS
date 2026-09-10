import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { commerceKeys } from "./hooks";
import type { StoreOrder } from "../types";
import { useCommerce } from "./provider";

/** Payment return flow shared by the reference storefront and customer template. */
export function usePaymentConfirmation(session?: string) {
  const client = useCommerce();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testAvailable, setTestAvailable] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const sessionId = useRef<string | null>(null);
  const redemption = useRef<Promise<StoreOrder> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) {
      // Keep the promise in memory across React effect replays, never the token.
      redemption.current ??= client.orders.redeemConfirmation(token);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    sessionId.current =
      session ??
      url.searchParams.get("session") ??
      url.searchParams.get("ps") ??
      window.sessionStorage.getItem("commerce.paymentSessionId");
    const redeem = async () => {
      const result = await redemption.current!;
      if (cancelled) return;
      window.sessionStorage.removeItem("commerce.paymentSessionId");
      await queryClient.cancelQueries({ queryKey: commerceKeys.cart });
      queryClient.setQueryData(commerceKeys.cart, null);
      setTestAvailable(false);
      setOrder(result);
    };
    const poll = async () => {
      try {
        if (redemption.current) return await redeem();
        if (!sessionId.current) throw new Error("Keine Zahlungssitzung gefunden.");
        const status = await client.payments.status(sessionId.current);
        if (cancelled) return;
        if (status.confirmationToken) {
          redemption.current ??= client.orders.redeemConfirmation(status.confirmationToken);
          return await redeem();
        }
        if (
          status.status === "failed" ||
          status.status === "cancelled" ||
          status.status === "expired"
        )
          throw new Error("Die Zahlung wurde nicht abgeschlossen.");
        setTestAvailable(status.testConfirmationAvailable === true);
        // Test buyers explicitly confirm; waiting for them is not a timeout.
        if (!status.testConfirmationAvailable && ++attempts > 40)
          throw new Error("Zahlung wird noch verarbeitet. Bitte die Seite später erneut laden.");
        timer = setTimeout(poll, 3000);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Zahlung konnte nicht geprüft werden.");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, session, queryClient]);

  const confirmTest = async () => {
    if (!sessionId.current || confirming || !testAvailable) return;
    setConfirming(true);
    try {
      await client.payments.confirmTest(sessionId.current);
      setTestAvailable(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Testzahlung fehlgeschlagen.");
    } finally {
      setConfirming(false);
    }
  };
  return { order, error, testAvailable, confirming, confirmTest };
}

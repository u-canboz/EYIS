CREATE OR REPLACE FUNCTION public.health_run_checks(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  findings jsonb := '[]'::jsonb;
  f jsonb;
BEGIN
  -- Access: service role (internal jobs) or org member with system role.
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR NOT (
      public.has_org_role(auth.uid(), _org_id, 'owner')
      OR public.has_org_role(auth.uid(), _org_id, 'administrator')
      OR public.has_org_role(auth.uid(), _org_id, 'operations')
    ) THEN
      RAISE EXCEPTION 'Keine Berechtigung für System-Health-Checks.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- ============ Payments & Orders ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','payment_without_order','area','payments_orders','severity','critical',
      'entityType','payment_session','entityId',ps.id,'shopId',ps.shop_id,
      'message','Zahlung erfolgreich abgeschlossen, aber keine Bestellung angelegt.') AS x
    FROM public.payment_sessions ps
    WHERE ps.organization_id = _org_id AND ps.status = 'paid'
      AND ps.created_at < now() - interval '15 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.checkout_session_id = ps.checkout_session_id)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','paid_order_without_transaction','area','payments_orders','severity','high',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Bestellung als bezahlt markiert, aber keine Zahlungstransaktion vorhanden.') AS x
    FROM public.orders o
    WHERE o.organization_id = _org_id AND o.payment_status = 'paid'
      AND NOT EXISTS (SELECT 1 FROM public.payment_transactions pt
        WHERE pt.order_id = o.id AND pt.type IN ('charge','capture'))
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','multiple_orders_per_checkout','area','payments_orders','severity','critical',
      'entityType','checkout_session','entityId',g.checkout_session_id,'shopId',g.shop_id,
      'message','Mehrere Bestellungen (' || g.n || ') für dieselbe Checkout-Sitzung.') AS x
    FROM (SELECT checkout_session_id, (array_agg(shop_id))[1] AS shop_id, count(*) AS n FROM public.orders
          WHERE organization_id = _org_id AND checkout_session_id IS NOT NULL
          GROUP BY checkout_session_id HAVING count(*) > 1) g
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','payment_amount_mismatch','area','payments_orders','severity','critical',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Zahlbetrag (' || ps.amount_minor || ') weicht vom Bestellbetrag (' || o.total_minor || ') ab.') AS x
    FROM public.orders o
    JOIN public.payment_sessions ps ON ps.checkout_session_id = o.checkout_session_id AND ps.status = 'paid'
    WHERE o.organization_id = _org_id AND ps.amount_minor <> o.total_minor
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','payment_currency_mismatch','area','payments_orders','severity','critical',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Währung der Zahlung (' || ps.currency_code || ') weicht von der Bestellung (' || o.currency_code || ') ab.') AS x
    FROM public.orders o
    JOIN public.payment_sessions ps ON ps.checkout_session_id = o.checkout_session_id AND ps.status = 'paid'
    WHERE o.organization_id = _org_id AND upper(ps.currency_code) <> upper(o.currency_code)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','completed_cart_without_order','area','payments_orders','severity','medium',
      'entityType','cart','entityId',c.id,'shopId',c.shop_id,
      'message','Warenkorb als abgeschlossen markiert, aber keine Bestellung vorhanden.') AS x
    FROM public.carts c
    WHERE c.organization_id = _org_id AND c.status = 'completed'
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.cart_id = c.id)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','order_without_snapshot','area','payments_orders','severity','high',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Bestellung ohne gültigen Checkout-Snapshot.') AS x
    FROM public.orders o
    WHERE o.organization_id = _org_id AND (o.checkout_snapshot_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.checkout_snapshots cs WHERE cs.id = o.checkout_snapshot_id))
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','order_without_number','area','payments_orders','severity','critical',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Bestellung ohne gültige Bestellnummer.') AS x
    FROM public.orders o
    WHERE o.organization_id = _org_id AND (o.order_number IS NULL OR btrim(o.order_number) = '')
    LIMIT 50) t;
  findings := findings || f;

  -- ============ Inventory ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','negative_stock_values','area','inventory','severity','high',
      'entityType','inventory_level','entityId',l.id,'shopId',l.shop_id,
      'message','Negativer Bestandswert (on_hand=' || l.on_hand || ', reserved=' || l.reserved || ', damaged=' || l.damaged || ', incoming=' || l.incoming || ').') AS x
    FROM public.inventory_levels l
    WHERE l.organization_id = _org_id AND (l.on_hand < 0 OR l.reserved < 0 OR l.damaged < 0 OR l.incoming < 0)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','negative_availability','area','inventory','severity','high',
      'entityType','inventory_level','entityId',l.id,'shopId',l.shop_id,
      'message','Verfügbarkeit negativ (' || (l.on_hand - l.damaged - l.reserved) || ').') AS x
    FROM public.inventory_levels l
    WHERE l.organization_id = _org_id AND (l.on_hand - l.damaged - l.reserved) < 0
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','active_reservation_without_checkout','area','inventory','severity','medium',
      'entityType','inventory_reservation','entityId',r.id,'shopId',r.shop_id,
      'message','Aktive Reservierung ohne offene Checkout-Sitzung.') AS x
    FROM public.inventory_reservations r
    WHERE r.organization_id = _org_id AND r.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.checkout_sessions cs
        WHERE cs.id::text = r.reference_id AND cs.status IN ('open','validated','awaiting_payment'))
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','committed_reservation_without_order','area','inventory','severity','high',
      'entityType','inventory_reservation','entityId',r.id,'shopId',r.shop_id,
      'message','Verbuchte Reservierung ohne zugehörige Bestellung.') AS x
    FROM public.inventory_reservations r
    WHERE r.organization_id = _org_id AND r.status = 'committed'
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id::text = r.reference_id)
      AND NOT EXISTS (SELECT 1 FROM public.orders o JOIN public.checkout_sessions cs ON cs.id = o.checkout_session_id
        WHERE cs.id::text = r.reference_id)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','multiple_inventory_commits','area','inventory','severity','critical',
      'entityType','inventory_reservation','entityId',g.reference_id,'shopId',g.shop_id,
      'message','Reservierung wurde mehrfach (' || g.n || ') verbucht.') AS x
    FROM (SELECT reference_id, (array_agg(shop_id))[1] AS shop_id, count(*) AS n FROM public.inventory_movements
          WHERE organization_id = _org_id AND movement_type = 'sale_commit' AND reference_id IS NOT NULL
          GROUP BY reference_id HAVING count(*) > 1) g
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','movement_level_deviation','area','inventory','severity','high',
      'entityType','inventory_level','entityId',l.id,'shopId',l.shop_id,
      'message','Buchungsjournal (' || coalesce(s.n,0) || ') weicht vom Bestand (' || l.on_hand || ') ab.') AS x
    FROM public.inventory_levels l
    LEFT JOIN LATERAL (
      SELECT sum(m.quantity_delta) AS n FROM public.inventory_movements m
      WHERE m.inventory_item_id = l.inventory_item_id AND m.location_id = l.location_id
        AND m.movement_type IN ('initial_stock','receipt','adjustment','sale_commit','return','transfer_out','transfer_in','correction')
    ) s ON true
    WHERE l.organization_id = _org_id AND l.on_hand <> coalesce(s.n, 0)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','reserved_mismatch','area','inventory','severity','high',
      'entityType','inventory_level','entityId',l.id,'shopId',l.shop_id,
      'message','Reservierter Bestand (' || l.reserved || ') weicht von aktiven Reservierungen (' || coalesce(s.n,0) || ') ab.') AS x
    FROM public.inventory_levels l
    LEFT JOIN LATERAL (
      SELECT sum(r.quantity) AS n FROM public.inventory_reservations r
      WHERE r.inventory_item_id = l.inventory_item_id AND r.location_id = l.location_id AND r.status = 'active'
    ) s ON true
    WHERE l.organization_id = _org_id AND l.reserved <> coalesce(s.n, 0)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','transfer_sum_mismatch','area','inventory','severity','medium',
      'entityType','inventory_transfer','entityId',g.reference_id,'shopId',g.shop_id,
      'message','Umbuchung mit abweichenden Ausgangs- (' || g.out_qty || ') und Eingangssummen (' || g.in_qty || ').') AS x
    FROM (
      SELECT m.reference_id, (array_agg(m.shop_id))[1] AS shop_id,
        coalesce(sum(-m.quantity_delta) FILTER (WHERE m.movement_type = 'transfer_out'), 0) AS out_qty,
        coalesce(sum(m.quantity_delta) FILTER (WHERE m.movement_type = 'transfer_in'), 0) AS in_qty
      FROM public.inventory_movements m
      WHERE m.organization_id = _org_id AND m.reference_type = 'transfer'
      GROUP BY m.reference_id
    ) g
    JOIN public.inventory_transfers t ON t.id::text = g.reference_id AND t.status = 'completed'
    WHERE g.out_qty <> g.in_qty
    LIMIT 50) t;
  findings := findings || f;

  -- ============ Tax ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','order_tax_mismatch','area','tax','severity','high',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Bestellsteuer (' || o.tax_total_minor || ') kleiner als Positionssumme (' || s.n || ') oder inkonsistent ohne Versand.') AS x
    FROM public.orders o
    JOIN LATERAL (SELECT coalesce(sum(oi.tax_minor),0) AS n FROM public.order_items oi WHERE oi.order_id = o.id) s ON true
    WHERE o.organization_id = _org_id
      AND (s.n > o.tax_total_minor OR (o.shipping_minor = 0 AND s.n <> o.tax_total_minor))
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','tax_snapshot_orphan','area','tax','severity','medium',
      'entityType','tax_snapshot','entityId',ts.id,'shopId',ts.shop_id,
      'message','Steuer-Snapshot ohne fachliche Verknüpfung (weder Warenkorb, Checkout noch Bestellung).') AS x
    FROM public.tax_snapshots ts
    WHERE ts.organization_id = _org_id AND ts.order_id IS NULL AND ts.checkout_session_id IS NULL AND ts.cart_id IS NULL
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','tax_snapshot_multi_order','area','tax','severity','critical',
      'entityType','tax_snapshot','entityId',g.tax_snapshot_id,'shopId',g.shop_id,
      'message','Steuer-Snapshot wird von mehreren Bestellungen (' || g.n || ') referenziert.') AS x
    FROM (SELECT tax_snapshot_id, (array_agg(shop_id))[1] AS shop_id, count(*) AS n FROM public.orders
          WHERE organization_id = _org_id AND tax_snapshot_id IS NOT NULL
          GROUP BY tax_snapshot_id HAVING count(*) > 1) g
    LIMIT 50) t;
  findings := findings || f;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND c.relname = 'tax_snapshots'
      AND p.proname = 'tax_snapshot_immutable' AND t.tgenabled <> 'D'
  ) THEN
    findings := findings || jsonb_build_object('code','tax_snapshot_mutable','area','tax','severity','critical',
      'entityType','config','entityId','tax_snapshots','shopId',null,
      'message','Unveränderbarkeits-Trigger für Steuer-Snapshots fehlt oder ist deaktiviert.');
  END IF;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','line_net_tax_gross_mismatch','area','tax','severity','high',
      'entityType','order_item','entityId',oi.id,'shopId',o.shop_id,
      'message','Position: Netto (' || oi.net_minor || ') + Steuer (' || oi.tax_minor || ') ungleich Brutto (' || oi.gross_minor || ').') AS x
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.organization_id = _org_id AND oi.net_minor + oi.tax_minor <> oi.gross_minor
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','order_net_tax_gross_mismatch','area','tax','severity','high',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Bestellung: Netto (' || o.net_total_minor || ') + Steuer (' || o.tax_total_minor || ') ungleich Brutto (' || o.gross_total_minor || ').') AS x
    FROM public.orders o
    WHERE o.organization_id = _org_id AND o.net_total_minor + o.tax_total_minor <> o.gross_total_minor
    LIMIT 50) t;
  findings := findings || f;

  -- ============ Documents ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','issued_invoice_without_number','area','documents','severity','critical',
      'entityType','invoice','entityId',i.id,'shopId',i.shop_id,
      'message','Ausgestellte Rechnung ohne Rechnungsnummer.') AS x
    FROM public.invoices i
    WHERE i.organization_id = _org_id AND i.status IN ('issued','partially_credited','credited')
      AND (i.invoice_number IS NULL OR btrim(i.invoice_number) = '')
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','duplicate_invoice_number','area','documents','severity','critical',
      'entityType','invoice','entityId',g.invoice_number,'shopId',g.shop_id,
      'message','Rechnungsnummer ' || g.invoice_number || ' ist ' || g.n || '-mal vergeben.') AS x
    FROM (SELECT shop_id, invoice_number, count(*) AS n FROM public.invoices
          WHERE organization_id = _org_id AND status <> 'voided' AND invoice_number IS NOT NULL
          GROUP BY shop_id, invoice_number HAVING count(*) > 1) g
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','invoice_order_amount_drift','area','documents','severity','high',
      'entityType','invoice','entityId',i.id,'shopId',i.shop_id,
      'message','Rechnungsbetrag (' || i.total_gross_minor || ') weicht vom aktuellen Bestellbetrag (' || o.gross_total_minor || ') ab.') AS x
    FROM public.invoices i
    JOIN public.orders o ON o.id = i.order_id
    WHERE i.organization_id = _org_id AND i.status IN ('issued','partially_credited','credited')
      AND i.total_gross_minor <> o.gross_total_minor
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','invoice_internal_mismatch','area','documents','severity','high',
      'entityType','invoice','entityId',i.id,'shopId',i.shop_id,
      'message','Rechnungssumme (' || i.total_gross_minor || ') weicht von der Summe der Positionen (' || coalesce(s.n,0) || ') ab.') AS x
    FROM public.invoices i
    LEFT JOIN LATERAL (SELECT sum(ii.line_gross_minor) AS n FROM public.invoice_items ii WHERE ii.invoice_id = i.id) s ON true
    WHERE i.organization_id = _org_id AND i.status IN ('issued','partially_credited','credited')
      AND i.total_gross_minor <> coalesce(s.n, 0)
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','document_file_without_checksum','area','documents','severity','medium',
      'entityType','document_file','entityId',d.id,'shopId',d.shop_id,
      'message','Dokumentdatei ohne Prüfsumme.') AS x
    FROM public.document_files d
    WHERE d.organization_id = _org_id AND (d.checksum IS NULL OR btrim(d.checksum) = '')
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','issued_invoice_missing_pdf','area','documents','severity','high',
      'entityType','invoice','entityId',i.id,'shopId',i.shop_id,
      'message','Ausgestellte Rechnung ohne erzeugte PDF-Datei.') AS x
    FROM public.invoices i
    WHERE i.organization_id = _org_id AND i.status IN ('issued','partially_credited','credited')
      AND NOT EXISTS (SELECT 1 FROM public.document_files d
        WHERE d.document_type = 'invoice' AND d.document_id = i.id AND d.format = 'pdf' AND d.status = 'generated')
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','credit_note_over_invoice','area','documents','severity','critical',
      'entityType','invoice','entityId',i.id,'shopId',i.shop_id,
      'message','Gutschriften (' || s.n || ') übersteigen den Rechnungsbetrag (' || i.total_gross_minor || ').') AS x
    FROM public.invoices i
    JOIN LATERAL (SELECT coalesce(sum(cn.total_gross_minor),0) AS n FROM public.credit_notes cn
                  WHERE cn.invoice_id = i.id AND cn.status = 'issued') s ON true
    WHERE i.organization_id = _org_id AND s.n > i.total_gross_minor
    LIMIT 50) t;
  findings := findings || f;

  -- ============ Shipping & Fulfillment ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','fulfillment_over_ordered','area','shipping','severity','high',
      'entityType','order_item','entityId',g.order_item_id,'shopId',g.shop_id,
      'message','Fulfillment-Menge (' || g.n || ') übersteigt bestellte Menge (' || oi.quantity || ').') AS x
    FROM (
      SELECT fi.order_item_id, (array_agg(fu.shop_id))[1] AS shop_id, sum(fi.quantity) AS n
      FROM public.fulfillment_items fi
      JOIN public.fulfillments fu ON fu.id = fi.fulfillment_id AND fu.status <> 'cancelled'
      WHERE fi.organization_id = _org_id
      GROUP BY fi.order_item_id
    ) g
    JOIN public.order_items oi ON oi.id = g.order_item_id
    WHERE g.n > oi.quantity
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','shipped_without_shipment','area','shipping','severity','high',
      'entityType','fulfillment','entityId',fu.id,'shopId',fu.shop_id,
      'message','Fulfillment als verschickt markiert, aber kein Shipment vorhanden.') AS x
    FROM public.fulfillments fu
    WHERE fu.organization_id = _org_id AND fu.status IN ('shipped','delivered')
      AND NOT EXISTS (SELECT 1 FROM public.shipments s WHERE s.fulfillment_id = fu.id AND s.status <> 'cancelled')
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','delivered_without_tracking','area','shipping','severity','medium',
      'entityType','shipment','entityId',s.id,'shopId',s.shop_id,
      'message','Sendung als zugestellt markiert, aber kein Zustell-Tracking-Ereignis vorhanden.') AS x
    FROM public.shipments s
    WHERE s.organization_id = _org_id AND s.status = 'delivered'
      AND NOT EXISTS (SELECT 1 FROM public.tracking_events te
        WHERE te.shipment_id = s.id AND te.normalized_status = 'delivered')
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','multiple_active_labels','area','shipping','severity','high',
      'entityType','shipment','entityId',g.shipment_id,'shopId',g.shop_id,
      'message','Mehrere aktive Labels (' || g.n || ') für dieselbe Sendung.') AS x
    FROM (SELECT shipment_id, (array_agg(shop_id))[1] AS shop_id, count(*) AS n FROM public.shipping_labels
          WHERE organization_id = _org_id AND voided_at IS NULL
          GROUP BY shipment_id HAVING count(*) > 1) g
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','shipment_without_reference','area','shipping','severity','critical',
      'entityType','shipment','entityId',s.id,'shopId',s.shop_id,
      'message','Sendung ohne gültigen Fulfillment-/Order-Bezug.') AS x
    FROM public.shipments s
    WHERE s.organization_id = _org_id AND (s.fulfillment_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.fulfillments fu WHERE fu.id = s.fulfillment_id))
    LIMIT 50) t;
  findings := findings || f;

  -- ============ Returns ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','return_over_ordered','area','returns','severity','high',
      'entityType','order_item','entityId',g.order_item_id,'shopId',g.shop_id,
      'message','Genehmigte Retourenmenge (' || g.n || ') übersteigt bestellte Menge (' || oi.quantity || ').') AS x
    FROM (
      SELECT ri.order_item_id, (array_agg(r.shop_id))[1] AS shop_id, sum(ri.quantity_approved) AS n
      FROM public.return_items ri
      JOIN public.returns r ON r.id = ri.return_id AND r.status NOT IN ('rejected','cancelled')
      WHERE ri.organization_id = _org_id
      GROUP BY ri.order_item_id
    ) g
    JOIN public.order_items oi ON oi.id = g.order_item_id
    WHERE g.n > oi.quantity
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','multiple_restock','area','returns','severity','high',
      'entityType','return_item','entityId',ri.id,'shopId',r.shop_id,
      'message','Position wurde mehrfach oder übermäßig wieder eingelagert (' || coalesce(s.n,0) || ' > ' || ri.quantity_approved || ').') AS x
    FROM public.return_items ri
    JOIN public.returns r ON r.id = ri.return_id
    JOIN LATERAL (
      SELECT coalesce(sum(m.quantity_delta),0) AS n FROM public.inventory_movements m
      WHERE m.movement_type = 'return' AND m.idempotency_key = 'return_item:' || ri.id::text
    ) s ON true
    WHERE ri.organization_id = _org_id AND s.n > ri.quantity_approved
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','refund_over_order_total','area','returns','severity','critical',
      'entityType','order','entityId',o.id,'shopId',o.shop_id,
      'message','Erstattungen (' || s.n || ') übersteigen den Bestellbetrag (' || o.total_minor || ').') AS x
    FROM public.orders o
    JOIN LATERAL (SELECT coalesce(sum(rf.amount_minor),0) AS n FROM public.refunds rf
                  WHERE rf.order_id = o.id AND rf.status = 'completed') s ON true
    WHERE o.organization_id = _org_id AND s.n > o.total_minor
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','completed_return_incomplete','area','returns','severity','high',
      'entityType','return','entityId',r.id,'shopId',r.shop_id,
      'message','Abgeschlossene Retoure mit fehlendem Refund- oder Restock-Ergebnis.') AS x
    FROM public.returns r
    WHERE r.organization_id = _org_id AND r.status IN ('completed','refunded')
      AND (
        (EXISTS (SELECT 1 FROM public.return_items ri WHERE ri.return_id = r.id
                 AND ri.resolution = 'refund' AND coalesce(ri.refund_amount_minor,0) > 0) AND r.refund_id IS NULL)
        OR EXISTS (SELECT 1 FROM public.return_items ri WHERE ri.return_id = r.id
                   AND ri.restock_decision = 'restock' AND ri.restocked_at IS NULL)
      )
    LIMIT 50) t;
  findings := findings || f;

  -- ============ Communications & Automations ============

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','communication_stuck_queued','area','communications_automations','severity','medium',
      'entityType','communication','entityId',c.id,'shopId',c.shop_id,
      'message','Communication seit über 30 Minuten in der Queue ohne Verarbeitung.') AS x
    FROM public.communications c
    WHERE c.organization_id = _org_id AND c.status = 'queued'
      AND coalesce(c.next_attempt_at, c.scheduled_at, c.queued_at, c.created_at) < now() - interval '30 minutes'
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','duplicate_communication','area','communications_automations','severity','medium',
      'entityType','communication','entityId',g.source_event_id,'shopId',g.shop_id,
      'message','Mehrere Communications (' || g.n || ') für dasselbe Event und dieselbe Regel.') AS x
    FROM (
      SELECT source_event_id, communication_rule_id, recipient_address, (array_agg(shop_id))[1] AS shop_id, count(*) AS n
      FROM public.communications
      WHERE organization_id = _org_id AND source_event_id IS NOT NULL AND communication_rule_id IS NOT NULL
        AND is_test_send = false AND resend_of_communication_id IS NULL
      GROUP BY source_event_id, communication_rule_id, recipient_address
      HAVING count(*) > 1
    ) g
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','job_stuck_locked','area','communications_automations','severity','high',
      'entityType','automation_job','entityId',j.id,'shopId',j.shop_id,
      'message','Job seit über 60 Minuten gesperrt (Worker vermutlich abgestürzt).') AS x
    FROM public.automation_jobs j
    WHERE j.organization_id = _org_id AND j.status = 'running'
      AND j.locked_at < now() - interval '1 hour'
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','job_over_max_retries','area','communications_automations','severity','medium',
      'entityType','automation_job','entityId',j.id,'shopId',j.shop_id,
      'message','Job hat mehr Versuche (' || j.attempts || ') als erlaubt (' || j.max_attempts || ').') AS x
    FROM public.automation_jobs j
    WHERE j.organization_id = _org_id AND j.attempts > j.max_attempts
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','execution_without_final_state','area','communications_automations','severity','high',
      'entityType','automation_execution','entityId',e.id,'shopId',e.shop_id,
      'message','Automation-Ausführung seit über 60 Minuten ohne Abschlusszustand.') AS x
    FROM public.automation_executions e
    WHERE e.organization_id = _org_id AND e.status IN ('queued','running')
      AND e.created_at < now() - interval '1 hour'
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','loop_guard_violation','area','communications_automations','severity','critical',
      'entityType','automation_execution','entityId',e.id,'shopId',e.shop_id,
      'message','Ausführungskette tiefer (' || e.chain_depth || ') als das Loop-Limit (5).') AS x
    FROM public.automation_executions e
    WHERE e.organization_id = _org_id AND e.chain_depth > 5
    LIMIT 50) t;
  findings := findings || f;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO f FROM (
    SELECT jsonb_build_object('code','circuit_breaker_active','area','communications_automations','severity','medium',
      'entityType','automation_rule','entityId',r.id,'shopId',r.shop_id,
      'message','Regel automatisch pausiert (Circuit Breaker): ' || coalesce(r.auto_pause_reason, 'ohne Grund') || '.') AS x
    FROM public.automation_rules r
    WHERE r.organization_id = _org_id AND r.auto_paused_at IS NOT NULL
    LIMIT 50) t;
  findings := findings || f;

  RETURN findings;
END;
$$;

REVOKE ALL ON FUNCTION public.health_run_checks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_run_checks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_run_checks(uuid) TO service_role;
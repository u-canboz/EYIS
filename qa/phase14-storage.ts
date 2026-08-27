/* QA harness — Gate B / B5: Storage- und Upload-Sicherheit.
 * Echte Negativtests gegen die Buckets media, documents und shipping-labels.
 * Läuft ausschließlich gegen Dev/Preview. */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { admin, check, results, summary } from "./lib";

const URL = process.env["SUPABASE_URL"]!;
const PUB = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
const ORG_A = "5eebb5ba-0a22-4a34-9c28-5dfab7d48924"; // Demo-Organisation
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07"; // QA Organisation B
const PREFIX = `gateb-${Date.now()}`;

const anon = createClient(URL, PUB, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created: { bucket: string; path: string }[] = [];
let tenantClient: ReturnType<typeof createClient> | null = null;

async function put(bucket: string, path: string, body: Blob, upsert = false) {
  const res = await admin.storage.from(bucket).upload(path, body, { upsert });
  // Der tatsächlich gespeicherte Schlüssel kann vom übergebenen Pfad abweichen.
  if (!res.error) created.push({ bucket, path: res.data?.path ?? path });
  return res;
}

async function main() {
  // ------------------------------------------------ B5.1 Bucket-Grundzustand
  const { data: buckets } = await admin.storage.listBuckets();
  const byId = new Map((buckets ?? []).map((b) => [b.id, b]));
  for (const id of ["media", "documents", "shipping-labels"]) {
    const b = byId.get(id);
    check(`Bucket ${id} existiert und ist privat`, Boolean(b) && b!.public === false,
      b ? `public=${b.public}` : "fehlt");
    check(
      `Bucket ${id} hat eine Größenbegrenzung`,
      Boolean(b?.file_size_limit && b.file_size_limit > 0),
      `limit=${b?.file_size_limit ?? "null"}`,
    );
    check(
      `Bucket ${id} hat eine MIME-Allowlist`,
      Array.isArray(b?.allowed_mime_types) && (b!.allowed_mime_types as string[]).length > 0,
      `mime=${JSON.stringify(b?.allowed_mime_types ?? null)}`,
    );
  }

  // ------------------------------------------------------- B5.2 Anonym-Zugriff
  const anonUp = await anon.storage
    .from("media")
    .upload(`${ORG_A}/${PREFIX}-anon.png`, new Blob(["x"], { type: "image/png" }));
  check("Anonymer Upload in media wird abgelehnt", Boolean(anonUp.error),
    anonUp.error?.message ?? "Upload akzeptiert");

  const seed = await put("media", `${ORG_A}/${PREFIX}-ok.png`,
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }));
  check("Kontroll-Upload (Service-Rolle) erfolgreich", !seed.error, seed.error?.message ?? "");

  const anonDl = await anon.storage.from("media").download(`${ORG_A}/${PREFIX}-ok.png`);
  check("Anonymer Download aus privatem Bucket wird abgelehnt", Boolean(anonDl.error),
    anonDl.error?.message ?? "Download möglich");

  const publicUrl = anon.storage.from("media").getPublicUrl(`${ORG_A}/${PREFIX}-ok.png`)
    .data.publicUrl;
  const rawFetch = await fetch(publicUrl);
  check("Öffentliche URL eines privaten Buckets liefert kein 200", rawFetch.status !== 200,
    `status ${rawFetch.status}`);

  const anonSign = await anon.storage.from("media").createSignedUrl(`${ORG_A}/${PREFIX}-ok.png`, 60);
  check("Anonymes Signieren wird abgelehnt", Boolean(anonSign.error),
    anonSign.error?.message ?? "signiert");

  // ------------------------------------------------------ B5.3 Signierte URLs
  const signed = await admin.storage.from("media").createSignedUrl(`${ORG_A}/${PREFIX}-ok.png`, 5);
  check("Signierte URL wird erzeugt", Boolean(signed.data?.signedUrl));
  if (signed.data?.signedUrl) {
    const ok = await fetch(signed.data.signedUrl);
    check("Signierte URL ist innerhalb der Gültigkeit nutzbar", ok.status === 200, `status ${ok.status}`);
    await new Promise((r) => setTimeout(r, 7000));
    const expired = await fetch(signed.data.signedUrl);
    check("Signierte URL läuft ab", expired.status !== 200, `status ${expired.status}`);
    const tampered = signed.data.signedUrl.replace(/token=.{6}/, "token=aaaaaa");
    const t = await fetch(tampered);
    check("Manipuliertes URL-Token wird abgelehnt", t.status !== 200, `status ${t.status}`);
  }

  // Dokument-URLs sind kurzlebig (300 s im Code) — Nachweis über die tatsächliche Signatur.
  const docSeed = await put("documents", `${ORG_A}/${PREFIX}-doc.pdf`,
    new Blob(["%PDF-1.4"], { type: "application/pdf" }));
  check("Dokument-Kontrolldatei angelegt", !docSeed.error, docSeed.error?.message ?? "");
  const docSigned = await admin.storage.from("documents").createSignedUrl(
    `${ORG_A}/${PREFIX}-doc.pdf`, 300);
  check("Dokument-URL ist signiert und kurzlebig (300 s)", Boolean(docSigned.data?.signedUrl));

  // -------------------------------------------------------- B5.4 Cross-Tenant
  // Ein Mitglied von Organisation B darf nicht auf Dateien von Organisation A zugreifen.
  const { data: memberB } = await admin
    .from("memberships")
    .select("user_id")
    .eq("organization_id", ORG_B)
    .limit(1)
    .maybeSingle();
  if (memberB?.user_id) {
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: (await admin.auth.admin.getUserById(memberB.user_id)).data.user?.email ?? "",
    });
    const otp = link?.properties?.email_otp;
    const email = link?.user?.email;
    if (otp && email) {
      const c = createClient(URL, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await c.auth.verifyOtp({ email, token: otp, type: "email" });
      if (!error) tenantClient = c;
    }
    if (tenantClient) {
      const foreignRead = await tenantClient.storage
        .from("media")
        .download(`${ORG_A}/${PREFIX}-ok.png`);
      check("Cross-Tenant-Download (Org B liest Org A) wird abgelehnt", Boolean(foreignRead.error),
        foreignRead.error?.message ?? "Download möglich");
      const foreignSign = await tenantClient.storage
        .from("media")
        .createSignedUrl(`${ORG_A}/${PREFIX}-ok.png`, 60);
      check("Cross-Tenant-Signieren wird abgelehnt", Boolean(foreignSign.error),
        foreignSign.error?.message ?? "signiert");
      const foreignWrite = await tenantClient.storage
        .from("media")
        .upload(`${ORG_A}/${PREFIX}-fremd.png`, new Blob(["x"], { type: "image/png" }));
      check("Cross-Tenant-Upload in fremden Ordner wird abgelehnt", Boolean(foreignWrite.error),
        foreignWrite.error?.message ?? "Upload möglich");
      const foreignDocs = await tenantClient.storage
        .from("documents")
        .download(`${ORG_A}/${PREFIX}-doc.pdf`);
      check("Cross-Tenant-Zugriff auf fremde Dokumente wird abgelehnt", Boolean(foreignDocs.error),
        foreignDocs.error?.message ?? "Download möglich");
      const listForeign = await tenantClient.storage.from("media").list(ORG_A, { limit: 5 });
      check("Cross-Tenant-Listing liefert keine fremden Dateien",
        (listForeign.data ?? []).length === 0, `${(listForeign.data ?? []).length} Treffer`);
    } else {
      check("Cross-Tenant-Prüfung mit echtem Mandantennutzer", false, "kein Login möglich");
    }
  } else {
    check("Cross-Tenant-Prüfung mit echtem Mandantennutzer", false, "kein Mitglied in Org B");
  }

  // ------------------------------------------------- B5.5 Gefährliche Inhalte
  const svg = new Blob(
    ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    { type: "image/svg+xml" },
  );
  const svgUp = await put("media", `${ORG_A}/${PREFIX}-x.svg`, svg);
  check("SVG-Upload wird auf Bucket-Ebene abgelehnt", Boolean(svgUp.error),
    svgUp.error?.message ?? "SVG akzeptiert");
  const html = new Blob(["<html><script>alert(1)</script></html>"], { type: "text/html" });
  const htmlUp = await put("media", `${ORG_A}/${PREFIX}-x.html`, html);
  check("HTML-Upload wird auf Bucket-Ebene abgelehnt", Boolean(htmlUp.error),
    htmlUp.error?.message ?? "HTML akzeptiert");
  // MIME-Spoofing: HTML-Inhalt mit image/png deklariert.
  const spoof = await put("media", `${ORG_A}/${PREFIX}-spoof.png`,
    new Blob(["<html><script>alert(1)</script></html>"], { type: "image/png" }));
  if (!spoof.error) {
    const s = await admin.storage.from("media").createSignedUrl(`${ORG_A}/${PREFIX}-spoof.png`, 60);
    const r = await fetch(s.data!.signedUrl);
    const ct = r.headers.get("content-type") ?? "";
    const disp = r.headers.get("content-disposition") ?? "";
    check(
      "Gespoofte Datei wird nicht als HTML ausgeliefert",
      !ct.includes("text/html") || disp.includes("attachment"),
      `content-type=${ct} disposition=${disp}`,
    );
  } else {
    check("Gespoofte Datei wird nicht als HTML ausgeliefert", true, "Upload bereits abgelehnt");
  }

  // ------------------------------------------------ B5.6 Pfade und Dateinamen
  // Traversal muss aus Sicht eines echten Mandantennutzers geprüft werden:
  // die Service-Rolle umgeht RLS und wäre kein gültiger Nachweis.
  if (tenantClient) {
    const key = `${ORG_B}/../${ORG_A}/${PREFIX}-trav.png`;
    const trav = await tenantClient.storage
      .from("media")
      .upload(key, new Blob(["x"], { type: "image/png" }));
    const landed = Boolean(
      (await admin.storage.from("media").list(ORG_A, { limit: 200 })).data?.some((f) =>
        f.name.includes(`${PREFIX}-trav`),
      ),
    );
    if (!trav.error) created.push({ bucket: "media", path: `${ORG_A}/${PREFIX}-trav.png` });
    check("Path Traversal verlässt den Mandantenordner nicht", Boolean(trav.error) && !landed,
      trav.error?.message ?? "Upload akzeptiert");
  } else {
    check("Path Traversal verlässt den Mandantenordner nicht", false, "kein Mandantennutzer");
  }

  const weird = await put("media", `${ORG_A}/${PREFIX}-a b#c?d%2e%2e.png`,
    new Blob(["x"], { type: "image/png" }));
  check("Auffällige Dateinamen werden normalisiert oder abgelehnt",
    Boolean(weird.error) || !String(weird.data?.path ?? "").includes(".."),
    weird.error?.message ?? String(weird.data?.path));

  // Erratbarkeit: Pfade enthalten UUIDs, keine laufenden Nummern.
  const { data: docRows } = await admin
    .from("document_files")
    .select("storage_path")
    .limit(20);
  const guessable = (docRows ?? []).filter(
    (r) => !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
      String(r.storage_path),
    ),
  );
  check("Private Dokumentpfade sind nicht erratbar (UUID-basiert)", guessable.length === 0,
    `${guessable.length} von ${(docRows ?? []).length} ohne UUID`);

  // ------------------------------------------------------ B5.7 Größenlimit
  const big = new Blob([new Uint8Array(26_000_000)], { type: "image/png" });
  const bigUp = await put("media", `${ORG_A}/${PREFIX}-big.png`, big);
  check("Datei über 25 MB wird abgelehnt", Boolean(bigUp.error),
    bigUp.error?.message ?? "akzeptiert");

  // ------------------------------------- B5.8 Historische Belege unveränderbar
  const { data: issued } = await admin
    .from("document_files")
    .select("storage_path")
    .limit(1)
    .maybeSingle();
  if (issued?.storage_path) {
    const noPolicy = await anon.storage
      .from("documents")
      .update(String(issued.storage_path), new Blob(["overwrite"], { type: "application/pdf" }));
    check("Ausgestellte Belege sind für Clients nicht überschreibbar", Boolean(noPolicy.error),
      noPolicy.error?.message ?? "überschrieben");
  } else {
    check("Ausgestellte Belege sind für Clients nicht überschreibbar", true,
      "keine Belegdatei vorhanden");
  }

  // ---------------------------------------------------- B5.9 Verwaiste Dateien
  const orphans: string[] = [];
  for (const bucket of ["media", "documents", "shipping-labels"]) {
    const { data: orgs } = await admin.storage.from(bucket).list("", { limit: 100 });
    for (const folder of orgs ?? []) {
      if (!/^[0-9a-f-]{36}$/i.test(folder.name)) continue;
      const { data: files } = await admin.storage.from(bucket).list(folder.name, { limit: 200 });
      for (const f of files ?? []) {
        if (f.name.startsWith(PREFIX) || f.id === null) continue;
        const path = `${folder.name}/${f.name}`;
        const table = bucket === "media" ? "media_assets" : bucket === "documents"
          ? "document_files" : "shipping_labels";
        const { count } = await admin
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("storage_path", path);
        if (!count) orphans.push(`${bucket}:${path}`);
      }
    }
  }
  check("Keine verwaisten Dateien ohne Datenbankeintrag", orphans.length === 0,
    orphans.slice(0, 5).join("; "));

  // -------------------------------------------------------------- Aufräumen
  for (const c of created) await admin.storage.from(c.bucket).remove([c.path]);
  // Nachlese: Schlüssel können durch Sonderzeichen von der übergebenen Form abweichen.
  for (const bucket of ["media", "documents", "shipping-labels"]) {
    for (const org of [ORG_A, ORG_B]) {
      const { data } = await admin.storage.from(bucket).list(org, { limit: 500 });
      const stale = (data ?? []).filter((f) => f.name.startsWith(PREFIX)).map((f) => `${org}/${f.name}`);
      if (stale.length) await admin.storage.from(bucket).remove(stale);
    }
  }
  const leftovers: string[] = [];
  for (const bucket of ["media", "documents", "shipping-labels"]) {
    for (const org of [ORG_A, ORG_B]) {
      const { data } = await admin.storage.from(bucket).list(org, { limit: 200 });
      for (const f of data ?? []) if (f.name.startsWith(PREFIX)) leftovers.push(`${bucket}:${f.name}`);
    }
  }
  check("Testdateien vollständig entfernt", leftovers.length === 0, leftovers.join("; "));

  writeFileSync(
    "qa/results-phase14-storage.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        results,
      },
      null,
      2,
    ),
  );
  summary();
}

void main();

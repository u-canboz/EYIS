import { mkdir, writeFile } from "node:fs/promises";
import { renderDocumentPdf } from "../src/lib/commerce/documents/pdf.server";
import { invoiceFixture, stressFixture } from "./document-layout-fixtures";
const output = ".local-state/expansion/pdf";
await mkdir(output, { recursive: true });
for (const [name, doc] of [
  ["rechnung", invoiceFixture()],
  ["rechnung-mehrseitig", stressFixture()],
  [
    "gutschrift",
    {
      ...invoiceFixture(),
      kind: "credit_note" as const,
      title: "Gutschrift",
      number: "TEST-GS-000044",
    },
  ],
] as const) {
  const placements: unknown[] = [];
  await writeFile(
    `${output}/${name}.pdf`,
    await renderDocumentPdf(doc, { onText: (p) => placements.push(p) }),
  );
  await writeFile(`${output}/${name}.layout.json`, JSON.stringify(placements, null, 2));
  console.log(`${name}: ${placements.length} Textblöcke`);
}

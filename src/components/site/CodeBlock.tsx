import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CodeBlockProps = {
  code: string;
  label?: string;
  language?: string;
};

/** Präsentationskomponente: Codeblock mit Kopierfunktion. Keine Geschäftslogik. */
export function CodeBlock({ code, label, language = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-muted/60 px-4 py-2">
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {label ?? language}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Code kopieren"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          {copied ? (
            <Check className="size-3.5 shrink-0 text-success" aria-hidden />
          ) : (
            <Copy className="size-3.5 shrink-0" aria-hidden />
          )}
          {copied ? "Kopiert" : "Kopieren"}
        </button>
      </div>
      <pre className="scroll-x p-4 text-[13px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

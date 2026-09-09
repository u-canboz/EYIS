import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promoMessages } from "@/content/conversion";

/** Schmale Aktionsleiste ganz oben. Wechselt ruhig zwischen den Hinweisen. */
export function PromoBar() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const interval = window.setInterval(() => {
      if (media.matches) {
        setIndex((i) => (i + 1) % promoMessages.length);
        return;
      }
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % promoMessages.length);
        setVisible(true);
      }, 320);
    }, 4600);
    return () => window.clearInterval(interval);
  }, []);

  const show = (offset: number) => {
    setVisible(false);
    window.setTimeout(() => {
      setIndex((current) => (current + offset + promoMessages.length) % promoMessages.length);
      setVisible(true);
    }, 160);
  };

  return (
    <div className="border-b border-brass/20 bg-brass/15 text-foreground">
      <div className="mx-auto grid h-8 max-w-(--content-max) grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center px-2 sm:h-9 sm:px-6">
        <Button variant="ghost" size="icon" className="size-8 justify-self-start hover:bg-brass/10" onClick={() => show(-1)} aria-label="Vorheriger Hinweis">
          <ChevronLeft className="size-3.5" />
        </Button>
        <div className="flex min-w-0 items-center justify-center gap-2">
        <Sparkles className="size-3.5 shrink-0 text-brass" aria-hidden />
        <p
          aria-live="polite"
          className={`truncate text-center text-[11px] transition-opacity duration-300 sm:text-xs ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {promoMessages[index]}
        </p>
        </div>
        <Button variant="ghost" size="icon" className="size-8 justify-self-end hover:bg-brass/10" onClick={() => show(1)} aria-label="Nächster Hinweis">
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  /** Always-visible search field (or any primary control). */
  search?: ReactNode | undefined;
  /** Secondary filters: inline from `md`, inside a sheet below. */
  filters: ReactNode;
  /** Number of active filters, shown on the mobile trigger. */
  activeCount?: number | undefined;
  onReset?: () => void | undefined;
  className?: string | undefined;
};

export function FilterBar({ search, filters, activeCount = 0, onReset, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:hidden">
        <div className="min-w-0">{search}</div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 shrink-0 gap-2">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filter
              {activeCount > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filter</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4 pb-6 pb-safe">
              {filters}
              <div className="flex gap-2 pt-2">
                {onReset ? (
                  <Button variant="outline" className="h-11 flex-1" onClick={onReset}>
                    Zurücksetzen
                  </Button>
                ) : null}
                <Button className="h-11 flex-1" onClick={() => setOpen(false)}>
                  Anwenden
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
        {search ? <div className="min-w-56 flex-1">{search}</div> : null}
        {filters}
      </div>
    </div>
  );
}

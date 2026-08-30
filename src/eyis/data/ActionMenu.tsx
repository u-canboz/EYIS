import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ActionItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode | undefined;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  separatorBefore?: boolean | undefined;
};

/**
 * Overflow menu for secondary and destructive actions. Pages expose exactly one
 * primary action; everything else lives here.
 */
export function ActionMenu({
  items,
  label = "Weitere Aktionen",
  className,
}: {
  items: ActionItem[];
  label?: string | undefined;
  className?: string | undefined;
}) {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {items.map((item, i) => (
          <div key={item.label}>
            {item.separatorBefore && i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={item.disabled ?? false}
              onSelect={item.onSelect}
              className={cn("gap-2", item.destructive && "text-destructive focus:text-destructive")}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

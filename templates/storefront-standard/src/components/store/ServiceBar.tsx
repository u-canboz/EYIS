import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircleQuestion } from "lucide-react";
import { serviceBar } from "@/content/shop";

export function ServiceBar() {
  return (
    <div className="bg-olive text-olive-foreground">
      <div className="mx-auto grid h-9 max-w-(--content-max) grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 text-[11px] sm:px-6 sm:text-xs">
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="size-3.5 shrink-0 text-brass" aria-hidden />
          <span className="truncate">{serviceBar.left}</span>
        </span>
        <Link to="/kontakt" className="flex min-w-0 items-center gap-2 transition-colors hover:text-brass">
          <MessageCircleQuestion className="size-3.5 shrink-0 text-brass" aria-hidden />
          <span className="hidden sm:inline">{serviceBar.right}</span>
          <span className="sm:hidden">Kontakt</span>
        </Link>
      </div>
    </div>
  );
}

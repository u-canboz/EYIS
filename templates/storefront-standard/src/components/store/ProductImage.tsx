import { cn } from "@/lib/utils";

/** Neutrale Produktfläche: echtes Bild, sonst ruhiger Platzhalter mit Initial. */
export function ProductImage({
  src,
  alt,
  title,
  className,
}: {
  src?: string | null | undefined;
  alt?: string | null | undefined;
  title: string;
  className?: string | undefined;

}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? title}
        loading="lazy"
        className={cn("h-full w-full bg-card object-contain p-3 sm:p-4", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-full w-full items-center justify-center bg-card text-muted-foreground",
        className,
      )}
    >
      <span className="font-display text-4xl opacity-40">{title.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { dateWorld } from "@/content/shop";

export function DateWorld() {
  return (
    <section className="relative isolate min-h-[34rem]">
      <img
        src={dateWorld.image}
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <span aria-hidden className="absolute inset-0 -z-10 bg-olive/55" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-olive via-olive/65 to-transparent sm:bg-linear-to-r sm:from-olive/90 sm:via-olive/70 sm:to-olive/20" />
      <div className="mx-auto flex min-h-[34rem] max-w-(--content-max) items-end px-5 py-14 sm:items-center sm:px-8 sm:py-28">
        <div className="max-w-md text-olive-foreground">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{dateWorld.eyebrow}</p>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{dateWorld.title}</h2>
          <p className="mt-4 text-olive-foreground/85">{dateWorld.text}</p>
          <Link
            to="/kategorie/$handle"
            params={{ handle: dateWorld.handle }}
            className="mt-8 inline-flex min-h-11 items-center bg-brass px-6 text-sm text-primary-foreground transition-opacity hover:opacity-90"
          >
            {dateWorld.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

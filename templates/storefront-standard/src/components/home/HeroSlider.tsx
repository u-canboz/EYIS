import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroSlides } from "@/content/shop";

const AUTOPLAY_DELAY = 8_000;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const paused = userPaused || interactionPaused || reducedMotion;

  const selectSlide = (nextIndex: number) => {
    setIndex((nextIndex + heroSlides.length) % heroSlides.length);
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => {
      setIndex((current) => (current + 1) % heroSlides.length);
    }, AUTOPLAY_DELAY);
    return () => window.clearTimeout(id);
  }, [paused, index]);

  const handlePointerUp = (clientX: number) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (start === null || Math.abs(start - clientX) < 45) return;
    selectSlide(start > clientX ? index + 1 : index - 1);
  };

  return (
    <section
      aria-roledescription="Karussell"
      aria-label=`${shop.name} entdecken`
      className="hero-stage relative bg-olive text-olive-foreground"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") selectSlide(index - 1);
        if (event.key === "ArrowRight") selectSlide(index + 1);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") pointerStart.current = event.clientX;
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onPointerUp={(event) => handlePointerUp(event.clientX)}
    >
      <div className="relative h-[min(45rem,calc(100svh-10rem))] min-h-[38rem] overflow-hidden max-md:h-[min(44rem,calc(100svh-7.5rem))] max-md:min-h-[39rem]">
        {heroSlides.map((item, slideIndex) => {
          const active = slideIndex === index;

          return (
            <article
              key={item.tab}
              aria-hidden={!active}
              className={`hero-panel absolute inset-0 ${active ? "hero-panel-active z-10" : "pointer-events-none"}`}
            >
              <picture>
                <source media="(max-width: 767px)" srcSet={item.mobileImage} />
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  width={1920}
                  height={1080}
                  fetchPriority={slideIndex === 0 ? "high" : "auto"}
                  loading={slideIndex === 0 ? "eager" : "lazy"}
                  draggable={false}
                  className={`hero-image absolute inset-0 h-full w-full max-w-none object-cover ${active ? "hero-image-active" : ""}`}
                />
              </picture>

              <span aria-hidden className="absolute inset-0 bg-olive/20 max-md:bg-olive/45" />
              <span aria-hidden className="absolute inset-y-0 left-0 w-[61%] bg-olive/55 max-md:w-full max-md:bg-olive/25" />

              <div className="relative mx-auto flex h-full max-w-(--content-max) items-center px-5 pb-28 pt-14 sm:px-8 sm:pb-32 lg:px-12 lg:pb-24 lg:pt-16">
                <div className="w-full max-w-[43rem] lg:w-[59%] lg:pr-10">
                  <div className={`hero-copy ${active ? "hero-copy-active" : ""}`}>
                    <div className="mb-6 flex items-center gap-4 sm:mb-8">
                      <span aria-hidden className="h-px w-10 bg-brass sm:w-14" />
                      <p className="text-[0.68rem] font-semibold uppercase text-brass sm:text-xs">{item.eyebrow}</p>
                    </div>

                    {active ? (
                      <h1 className="max-w-[13ch] text-balance font-display text-[3.15rem] leading-[0.9] max-[359px]:text-[2.7rem] sm:text-[4.4rem] lg:text-[5.6rem]">
                        {item.title}
                      </h1>
                    ) : (
                      <h2 className="max-w-[13ch] text-balance font-display text-[3.15rem] leading-[0.9] max-[359px]:text-[2.7rem] sm:text-[4.4rem] lg:text-[5.6rem]">
                        {item.title}
                      </h2>
                    )}

                    <p className="mt-6 max-w-[33rem] text-sm leading-7 text-olive-foreground/80 sm:mt-8 sm:text-base sm:leading-8">
                      {item.text}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4 sm:mt-10">
                      <Link
                        to="/kategorie/$handle"
                        params={{ handle: item.cta.handle }}
                        tabIndex={active ? 0 : -1}
                        className="group inline-flex min-h-12 items-center gap-5 bg-brass px-6 text-sm font-semibold text-primary-foreground transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-primary sm:px-8"
                      >
                        {item.cta.label}
                        <ArrowRight className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                      </Link>
                      <Link
                        to={item.secondary.to}
                        tabIndex={active ? 0 : -1}
                        className="group inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-olive-foreground"
                      >
                        <span className="border-b border-olive-foreground/40 pb-1.5 transition-colors group-hover:border-brass">
                          {item.secondary.label}
                        </span>
                        <ArrowRight className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <p className="absolute right-6 top-7 hidden text-[0.65rem] uppercase text-olive-foreground/55 sm:block lg:right-12 lg:top-9">
                {item.marker}
              </p>
            </article>
          );
        })}

        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-olive-foreground/20 bg-olive/88">
          <div className="mx-auto grid min-h-20 max-w-(--content-max) grid-cols-[auto_minmax(0,1fr)_auto] items-stretch px-2 sm:px-6 lg:px-10">
            <div className="flex items-center gap-0.5 border-r border-olive-foreground/20 pr-1 sm:gap-1 sm:pr-4">
              <Button type="button" aria-label="Vorheriger Bereich" onClick={() => selectSlide(index - 1)} variant="ghost" size="icon" className="text-olive-foreground hover:bg-olive-foreground/10 hover:text-olive-foreground">
                <ChevronLeft className="size-5" />
              </Button>
              <Button type="button" aria-label="Nächster Bereich" onClick={() => selectSlide(index + 1)} variant="ghost" size="icon" className="text-olive-foreground hover:bg-olive-foreground/10 hover:text-olive-foreground">
                <ChevronRight className="size-5" />
              </Button>
            </div>

            <div className="grid min-w-0 grid-cols-3">
              {heroSlides.map((item, slideIndex) => (
                <Button
                  key={item.tab}
                  type="button"
                  variant="ghost"
                  onClick={() => selectSlide(slideIndex)}
                  aria-current={slideIndex === index ? "true" : undefined}
                  aria-label={`${item.tab}, Folie ${slideIndex + 1} von ${heroSlides.length}`}
                  className="relative h-full min-h-20 min-w-0 rounded-none px-1 text-olive-foreground hover:bg-olive-foreground/5 hover:text-olive-foreground sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <span className="hidden text-[0.65rem] tabular-nums text-brass sm:inline">0{slideIndex + 1}</span>
                    <span className={`truncate text-[0.68rem] sm:text-sm ${slideIndex === index ? "font-semibold" : "text-olive-foreground/50"}`}>
                      {item.tab}
                    </span>
                  </span>
                  {slideIndex === index ? (
                    <span key={`${index}-${paused}`} aria-hidden className={`hero-progress absolute inset-x-0 bottom-0 h-0.5 bg-brass ${paused ? "hero-progress-paused" : ""}`} />
                  ) : null}
                </Button>
              ))}
            </div>

            <div className="flex items-center border-l border-olive-foreground/20 pl-1 sm:pl-4">
              <Button type="button" aria-label={userPaused ? "Slider abspielen" : "Slider pausieren"} onClick={() => setUserPaused((value) => !value)} variant="ghost" size="icon" className="text-olive-foreground hover:bg-olive-foreground/10 hover:text-olive-foreground">
                {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        <Link to="/shop" aria-label="Zum gesamten Sortiment" className="absolute bottom-[6.25rem] right-6 z-20 hidden min-h-11 items-center gap-3 text-[0.65rem] uppercase text-olive-foreground/65 transition-colors hover:text-olive-foreground lg:flex lg:right-12">
          Sortiment
          <ArrowDown className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { productFaq } from "@/content/conversion";

/** Häufige Fragen direkt am Kaufpunkt — nimmt typische Kaufhürden weg. */
export function ProductFaq() {
  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-2xl">Häufige Fragen</h2>
      <Accordion type="single" collapsible className="mt-4">
        {productFaq.map((entry) => (
          <AccordionItem key={entry.question} value={entry.question}>
            <AccordionTrigger className="text-left text-sm">{entry.question}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {entry.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

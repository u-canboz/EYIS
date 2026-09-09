import { createFileRoute } from "@tanstack/react-router";
import { HeroSlider } from "@/components/home/HeroSlider";
import { CategoryEntries } from "@/components/home/CategoryEntries";
import { BestsellerRow } from "@/components/home/BestsellerRow";
import { DateWorld } from "@/components/home/DateWorld";
import { CareAndScents } from "@/components/home/CareAndScents";
import { StoryLocation } from "@/components/home/StoryLocation";
import { TrustBar } from "@/components/store/TrustBar";
import { GuaranteeStrip } from "@/components/store/GuaranteeStrip";
import { ReviewsSection } from "@/components/store/Reviews";
import { ReviewSummary } from "@/components/store/ReviewSummary";
import { RecentlyViewed } from "@/components/store/RecentlyViewed";
import { NewsletterSignup } from "@/components/store/NewsletterSignup";
import { reviews } from "@/content/conversion";
import { shop } from "@/content/shop";

const TITLE = `${shop.name} — ausgewähltes Sortiment online bestellen`;
const DESCRIPTION =
  `Entdecke das Sortiment von ${shop.name}: sorgfältig ausgewählte Produkte, sicher bestellt und zuverlässig versandt.`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <HeroSlider />
      <TrustBar />
      <CategoryEntries />
      <BestsellerRow />
      <div className="mx-auto flex max-w-(--content-max) justify-center px-4 py-10 sm:px-6">
        <ReviewSummary />
      </div>
      <DateWorld />
      <CareAndScents />
      <ReviewsSection reviews={reviews} />
      <GuaranteeStrip />
      <StoryLocation />
      <RecentlyViewed />
      <NewsletterSignup source="startseite" />
    </>
  );
}

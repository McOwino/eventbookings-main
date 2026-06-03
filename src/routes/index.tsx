import { createFileRoute } from "@tanstack/react-router";
import VillageMarketPage from "@/pages/VillageMarketPage";
import {
  activePromotionsQueryOptions,
  facilityShowcaseQueryOptions,
  publicEventsQueryOptions,
} from "@/lib/queries";
import { publicTournamentsQueryOptions } from "@/lib/tournaments";

export const Route = createFileRoute("/")({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(publicEventsQueryOptions());
    queryClient.prefetchQuery(facilityShowcaseQueryOptions());
    queryClient.prefetchQuery(publicTournamentsQueryOptions());
    queryClient.prefetchQuery(activePromotionsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Village Market Recreation — Events & Promotions" },
      {
        name: "description",
        content:
          "Browse upcoming birthdays, school trips, and hangouts across Village Bowl, Ozone, Glitch, REV, Mini-Golf, Ballpoint, and Under the Sea.",
      },
      { property: "og:title", content: "Village Market Recreation — Events & Promotions" },
      {
        property: "og:description",
        content: "Discover what's happening across all our recreation facilities.",
      },
    ],
  }),
  component: VillageMarketPage,
});

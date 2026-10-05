import { createFileRoute } from "@tanstack/react-router";
import AfroMetaverseGame from "@/components/afrometaverse/AfroMetaverseGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AfroMetaverse — Find your place in Port Harcourt" },
      {
        name: "description",
        content:
          "A living browser simulation of Port Harcourt. Work shifts, trade at Town Market, shape the city with your civic vote and meet your neighbours in the Town Square.",
      },
      { property: "og:title", content: "AfroMetaverse — Find your place in Port Harcourt" },
      {
        property: "og:description",
        content:
          "A living browser simulation of Port Harcourt. Work, trade, vote and learn your way through Season 01.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AfroMetaverse — Find your place in Port Harcourt" },
      {
        name: "twitter:description",
        content:
          "A living browser simulation of Port Harcourt. Work, trade, vote and learn your way through Season 01.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <AfroMetaverseGame />;
}

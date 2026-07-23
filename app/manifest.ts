import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Harmony Homeschool",
    short_name: "Harmony",
    description: "Track and manage your homeschool activities",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#5a7a5e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

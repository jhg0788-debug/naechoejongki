import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { siteUrl } from "@/lib/server";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.8 },
    ...GUIDES.map(g => ({ url: `${base}/guide/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/terms`, priority: 0.2 },
    { url: `${base}/privacy`, priority: 0.2 },
    { url: `${base}/refund`, priority: 0.2 },
  ];
}

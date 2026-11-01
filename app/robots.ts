import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/r/", "/admin", "/api/", "/pay/", "/kids"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

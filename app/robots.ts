import type { MetadataRoute } from "next";
import { siteUrl } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // Signed-in areas and the API have nothing to index.
            disallow: ["/api/", "/dashboard", "/my-appointments", "/notifications", "/profile"]
        },
        sitemap: new URL("/sitemap.xml", siteUrl).toString()
    };
}

import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "./lib/db";
import { publicBusinessWhere } from "./lib/public-business";
import { siteUrl } from "./lib/site";

// Rendered per request so the build never needs the database; only the query below is cached.
export const dynamic = "force-dynamic";

// shortcut: unstable_cache is superseded by "use cache" in Next 16, which needs cacheComponents app-wide;
// switch when that flag is enabled. It does not store a call that throws, so a failure is never cached.
const publicListings = unstable_cache(
    // shortcut: one sitemap caps at 50,000 URLs; switch to generateSitemaps past that.
    () => prisma.business.findMany({
        where: publicBusinessWhere,
        select: {
            id: true,
            catalogs: {
                where: { state: true },
                select: { services: { where: { state: true }, select: { id: true } } }
            }
        }
    }),
    ["sitemap-public-listings"],
    { revalidate: 3600 }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const url = (path: string) => new URL(path, siteUrl).toString();
    const pages: MetadataRoute.Sitemap = [
        { url: url("/"), changeFrequency: "monthly", priority: 1 },
        { url: url("/explore"), changeFrequency: "daily", priority: 0.9 }
    ];
    let businesses;
    try {
        businesses = await publicListings();
    } catch {
        // Database blip: answer with the static pages for this request only; the next one retries.
        return pages;
    }
    return [
        ...pages,
        ...businesses.flatMap(business => [
            { url: url(`/businesses/${business.id}`), changeFrequency: "weekly" as const, priority: 0.7 },
            ...business.catalogs.flatMap(catalog => catalog.services.map(service => (
                { url: url(`/services/${service.id}`), changeFrequency: "weekly" as const, priority: 0.6 }
            )))
        ])
    ];
}

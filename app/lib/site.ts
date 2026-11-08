// Public origin for canonical, Open Graph, robots and sitemap URLs. An explicit NEXT_PUBLIC_SITE_URL wins
// (a custom domain); on Vercel the project's production domain is the fallback; locally, localhost.
const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const siteUrl = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || (vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000")
);

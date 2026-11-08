import type { Metadata, ResolvingMetadata } from "next";
import { prisma } from "@/app/lib/db";
import { publicBusinessWhere } from "@/app/lib/public-business";

export async function generateMetadata({ params }: LayoutProps<"/businesses/[id]">, parent: ResolvingMetadata): Promise<Metadata> {
    const id = Number((await params).id);
    let business: { name: string; description: string } | null = null;
    try {
        business = Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647
            ? await prisma.business.findFirst({ where: { id, ...publicBusinessWhere }, select: { name: true, description: true } })
            : null;
    } catch {
        // A database blip must not replace the page with an error or de-index it.
        return { title: "Negocio" };
    }
    if (!business) return { title: "Negocio no encontrado", robots: { index: false } };
    // Cut by code points so an emoji is never split in half.
    const description = Array.from(business.description).slice(0, 160).join("");
    // A page-level openGraph replaces the root one, so carry the site image over.
    const images = (await parent).openGraph?.images ?? [];
    return {
        title: business.name,
        description,
        alternates: { canonical: `/businesses/${id}` },
        openGraph: { title: business.name, description, url: `/businesses/${id}`, images }
    };
}

export default function BusinessLayout({ children }: LayoutProps<"/businesses/[id]">) {
    return children;
}

import type { Metadata, ResolvingMetadata } from "next";
import { prisma } from "@/app/lib/db";
import { publicBusinessWhere } from "@/app/lib/public-business";

export async function generateMetadata({ params }: LayoutProps<"/services/[id]">, parent: ResolvingMetadata): Promise<Metadata> {
    const id = Number((await params).id);
    let service: { name: string; durationMinutes: number; catalog: { business: { name: string } } } | null = null;
    try {
        service = Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647
            ? await prisma.service.findFirst({
                // Same rule as the booking page: an inactive owner's services are not bookable.
                where: { id, state: true, catalog: { state: true, business: publicBusinessWhere } },
                select: { name: true, durationMinutes: true, catalog: { select: { business: { select: { name: true } } } } }
            })
            : null;
    } catch {
        // A database blip must not replace the page with an error or de-index it.
        return { title: "Servicio" };
    }
    if (!service) return { title: "Servicio no encontrado", robots: { index: false } };
    const business = service.catalog.business.name;
    const title = `${service.name} en ${business}`;
    const description = `Reserva ${service.name} (${service.durationMinutes} min) en ${business}. Elige día y hora libre en línea.`;
    // A page-level openGraph replaces the root one, so carry the site image over.
    const images = (await parent).openGraph?.images ?? [];
    return {
        title,
        description,
        alternates: { canonical: `/services/${id}` },
        openGraph: { title, description, url: `/services/${id}`, images }
    };
}

export default function ServiceLayout({ children }: LayoutProps<"/services/[id]">) {
    return children;
}

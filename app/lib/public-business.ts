import type { Prisma } from "@prisma/client";
import { businessLocation } from "./costa-rica-locations";

// Listed publicly only while the business and its owner's account are active.
export const publicBusinessWhere = { state: true, owner: { state: true } } satisfies Prisma.BusinessWhereInput;

export const publicBusinessSelect = {
    id: true,
    name: true,
    description: true,
    cantonCode: true,
    owner: { select: { state: true } },
    catalogs: {
        where: { state: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
            id: true,
            name: true,
            services: {
                where: { state: true },
                orderBy: [{ name: "asc" }, { id: "asc" }],
                select: { id: true, name: true, durationMinutes: true }
            }
        }
    }
} satisfies Prisma.BusinessSelect;

export function publicBusiness({ owner, cantonCode, ...business }: Prisma.BusinessGetPayload<{ select: typeof publicBusinessSelect }>) {
    return { ...business, location: businessLocation(cantonCode), acceptsBookings: owner?.state === true && business.catalogs.some(catalog => catalog.services.length > 0) };
}

export type PublicBusiness = ReturnType<typeof publicBusiness>;

import { Prisma } from "@prisma/client";
import { lockCalendar } from "@/app/lib/booking";
import { prisma } from "@/app/lib/db";

export const moderationReasonLimit = 500;

export function moderationChange(body: unknown) {
    if (!body || typeof body !== "object" || !("status" in body)) return null;
    if (body.status === "active") return { status: "active" } as const;
    const reason = "reason" in body && typeof body.reason === "string" ? body.reason.trim() : "";
    return body.status === "banned" && reason && reason.length <= moderationReasonLimit
        ? { status: "banned", reason } as const
        : null;
}

export async function changeClientModeration(
    ownerId: number, businessId: number, userId: number, change: NonNullable<ReturnType<typeof moderationChange>>
) {
    if (userId === ownerId) return null;

    return prisma.$transaction(async tx => {
        await lockCalendar(tx, businessId);
        const client = await tx.user.findFirst({
            where: {
                id: userId,
                state: true,
                OR: [
                    { appointments: { some: { state: true, service: { catalog: { business: { id: businessId, ownerId, state: true } } } } } },
                    { moderations: { some: { businessId, business: { ownerId, state: true } } } }
                ]
            },
            select: { id: true }
        });
        if (!client) return null;

        const existing = await tx.moderation.findFirst({
            where: { userId, businessId, state: true },
            orderBy: { id: "desc" }
        });
        if (existing) {
            // Older data can have duplicate active records. Apply the same rule to all of them.
            await tx.moderation.updateMany({ where: { userId, businessId, state: true }, data: change });
            return { ...existing, ...change };
        }
        if (change.status === "active") return null;
        return tx.moderation.create({ data: { userId, businessId, ...change } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

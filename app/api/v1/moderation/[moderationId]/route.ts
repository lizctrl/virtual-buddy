import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { lockCalendar } from "@/app/lib/booking";
import { changeClientModeration, moderationChange } from "@/app/lib/moderation";
import { prisma } from "@/app/lib/db";

type Context = RouteContext<"/api/v1/moderation/[moderationId]">;

async function ownedModeration(context: Context) {
    const user = await getCurrentUser();
    if (!user) return { error: Response.json(ApiResponse.unauthenticated("Inicia sesión."), { status: 401 }) };
    const id = Number((await context.params).moderationId);
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
        return { error: Response.json(ApiResponse.invalidParameter("Moderación inválida."), { status: 400 }) };
    }
    const where = { id, state: true, business: { ownerId: user.id, state: true } };
    const moderation = await prisma.moderation.findFirst({ where });
    if (!moderation) return { error: Response.json(ApiResponse.notFound("Moderación no encontrada."), { status: 404 }) };
    return { user, where, moderation };
}

export async function GET(_request: Request, context: Context) {
    const result = await ownedModeration(context);
    if (result.error) return result.error;
    return Response.json(ApiResponse.success("Moderación encontrada.", { moderation: result.moderation }));
}

export async function PUT(request: Request, context: Context) {
    const result = await ownedModeration(context);
    if (result.error) return result.error;
    const change = moderationChange(await request.json().catch(() => null));
    if (!change) {
        return Response.json(ApiResponse.invalidParameter("Indica un estado válido y un motivo para bloquear."), { status: 400 });
    }
    const moderation = await changeClientModeration(result.user.id, result.moderation.businessId, result.moderation.userId, change);
    if (!moderation) return Response.json(ApiResponse.notFound("Cliente del negocio no encontrado."), { status: 404 });
    return Response.json(ApiResponse.success("Moderación actualizada.", { moderation }));
}

export async function DELETE(_request: Request, context: Context) {
    const result = await ownedModeration(context);
    if (result.error) return result.error;
    const { count } = await prisma.$transaction(async tx => {
        await lockCalendar(tx, result.moderation.businessId);
        return tx.moderation.updateMany({ where: result.where, data: { state: false } });
    });
    if (!count) return Response.json(ApiResponse.notFound("Moderación no encontrada."), { status: 404 });
    return Response.json(ApiResponse.success("Moderación desactivada.", { moderation: { ...result.moderation, state: false } }));
}

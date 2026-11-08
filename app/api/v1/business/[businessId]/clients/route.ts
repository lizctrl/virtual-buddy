import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/v1/business/[businessId]/clients">) {
    const owner = await getCurrentUser();
    if (!owner) return Response.json(ApiResponse.unauthenticated("Inicia sesión."), { status: 401 });
    const id = Number((await context.params).businessId);
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
        return Response.json(ApiResponse.invalidParameter("Negocio inválido."), { status: 400 });
    }
    const business = await prisma.business.findFirst({ where: { id, ownerId: owner.id, state: true }, select: { id: true } });
    if (!business) return Response.json(ApiResponse.notFound("Negocio no encontrado."), { status: 404 });

    const clients = await prisma.user.findMany({
        where: {
            state: true,
            id: { not: owner.id },
            OR: [
                { appointments: { some: { state: true, service: { catalog: { businessId: id } } } } },
                { moderations: { some: { state: true, businessId: id } } }
            ]
        },
        orderBy: [{ name: "asc" }, { last_name: "asc" }, { id: "asc" }],
        select: {
            id: true, name: true, last_name: true, email: true,
            moderations: {
                where: { state: true, status: "banned", businessId: id },
                orderBy: { id: "desc" },
                take: 1,
                select: { reason: true }
            }
        }
    });
    return Response.json(ApiResponse.success("Clientes del negocio.", {
        clients: clients.map(({ moderations, ...client }) => ({ ...client, block: moderations[0] ?? null }))
    }));
}

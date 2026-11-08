import { ApiResponse } from "@/app/lib/api/responses";
import { getCurrentUser } from "@/app/lib/auth";
import { businessLocation } from "@/app/lib/costa-rica-locations";
import { prisma } from "@/app/lib/db";
import { publicBusiness, publicBusinessSelect } from "@/app/lib/public-business";

export async function GET(_request: Request, context: RouteContext<"/api/v1/business/[businessId]">) {
    const id = Number((await context.params).businessId);
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
        return Response.json(ApiResponse.invalidParameter("Emprendimiento inválido."), { status: 400 });
    }

    const business = await prisma.business.findUnique({
        where: { id, state: true },
        select: publicBusinessSelect
    });
    if (!business) {
        return Response.json(ApiResponse.notFound("Emprendimiento no encontrado."), { status: 404 });
    }

    return Response.json(ApiResponse.success("Emprendimiento encontrado.", { business: publicBusiness(business) }));
}

export async function PATCH(request: Request, context: RouteContext<"/api/v1/business/[businessId]">) {
    const user = await getCurrentUser();
    if (!user) return Response.json(ApiResponse.unauthenticated("Inicia sesión."), { status: 401 });

    const id = Number((await context.params).businessId);
    const body = await request.json().catch(() => null);
    const cantonCode = body?.cantonCode;
    if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647 ||
        (cantonCode !== null && (typeof cantonCode !== "number" || !businessLocation(cantonCode)))) {
        return Response.json(ApiResponse.invalidParameter("Selecciona un negocio y un cantón válidos."), { status: 400 });
    }

    const { count } = await prisma.business.updateMany({
        where: { id, ownerId: user.id, state: true },
        data: { cantonCode }
    });
    if (!count) return Response.json(ApiResponse.notFound("Negocio no encontrado."), { status: 404 });
    return Response.json(ApiResponse.success("Ubicación guardada.", { cantonCode }));
}

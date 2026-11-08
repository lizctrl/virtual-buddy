import { ApiResponse } from "@/app/lib/api/responses";
import { listBookingStarts } from "@/app/lib/booking";

export async function GET(_request: Request, context: RouteContext<"/api/v1/service/[serviceId]/slots">) {
    const id = Number((await context.params).serviceId);
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2_147_483_647) {
        return Response.json(ApiResponse.invalidParameter("Servicio inválido."), { status: 400 });
    }

    const availability = await listBookingStarts(id);
    if (!availability) {
        return Response.json(ApiResponse.notFound("Servicio no encontrado."), { status: 404 });
    }

    return Response.json(ApiResponse.success("Horarios disponibles.", availability), {
        headers: { "Cache-Control": "no-store" }
    });
}

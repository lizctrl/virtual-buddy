import { apiGet, type Pagination } from "@/app/lib/api/client";

export interface Service {
    id: number;
    name: string;
    catalogId: number;
    durationMinutes: number;
    state: boolean;
}

export interface Catalog {
    id: number;
    name: string;
    services: Service[];
}

export async function loadCatalogs(businessId: number) {
    const catalogs: Catalog[] = [];
    for (let page = 1; ; page++) {
        const result = await apiGet<{ catalogs: Catalog[]; pagination: Pagination }>(
            `/api/v1/catalog?businessId=${businessId}&state=true&service=true&limit=100&page=${page}`
        );
        if (!result.ok) return result;
        catalogs.push(...result.data.catalogs.map(catalog => ({
            ...catalog, services: catalog.services.filter(service => service.state)
        })));
        if (!result.data.pagination.hasNextPage) return { ok: true as const, data: catalogs };
    }
}


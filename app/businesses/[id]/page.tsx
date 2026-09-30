"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppLayout from "@/app/components/layout/AppLayout";
import { apiGet } from "@/app/lib/api/client";

interface Business {
    id: number;
    name: string;
    description: string;
    ownerId: number | null;
    state: boolean;
}
interface Service {
    id: number;
    name: string;
    catalogId: number;
    state: boolean;
}
interface Catalog {
    id: number;
    name: string;
    businessId: number;
    state: boolean;
    services: Service[];
}

export default function BusinessDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);

    const [business, setBusiness] = useState<Business | null>(null);
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            apiGet<{ business: Business }>(`/api/v1/business/${id}`),
            apiGet<{ catalogs: Catalog[] }>(
                `/api/v1/catalog?businessId=${id}&state=true&service=true&limit=100`
            )
        ]).then(([b, c]) => {
            if (!b.ok) {
                setError(b.message);
                return;
            }
            if (!c.ok) {
                setError(c.message);
                return;
            }
            setBusiness(b.data.business);
            setCatalogs(c.data.catalogs);
        }).finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <AppLayout>
                <p className="text-gray-500">Loading...</p>
            </AppLayout>
        );
    }

    if (!business) {
        return (
            <AppLayout>
                <p className={error ? "text-red-600" : "text-gray-500"}>
                    {error ?? "Business not found."}
                </p>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Link
                href="/explore"
                className="mb-4 inline-block text-sm text-blue-600 hover:underline"
            >
                ← Back to explore
            </Link>

            <h1 className="mb-1 text-2xl font-bold text-gray-900">
                {business.name}
            </h1>
            <p className="mb-8 text-gray-500">{business.description}</p>

            {catalogs.map(catalog => (
                <div key={catalog.id} className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-gray-900">
                        {catalog.name}
                    </h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {catalog.services.map(s => (
                            <Link
                                key={s.id}
                                href={`/services/${s.id}`}
                                className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow"
                            >
                                <h3 className="font-medium text-gray-900">
                                    {s.name}
                                </h3>
                                <p className="text-sm text-blue-600">
                                    View & book →
                                </p>
                            </Link>
                        ))}
                        {catalog.services.length === 0 && (
                            <p className="text-sm text-gray-500">
                                No services in this catalog yet.
                            </p>
                        )}
                    </div>
                </div>
            ))}

            {catalogs.length === 0 && (
                <p className="text-sm text-gray-500">
                    This business has no catalogs yet.
                </p>
            )}
        </AppLayout>
    );
}

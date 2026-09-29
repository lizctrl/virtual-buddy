"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppLayout from "@/app/components/layout/AppLayout";
import Input from "@/app/components/ui/Input";

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
    catalog: { id: number; name: string; businessId: number };
}

type Tab = "businesses" | "services";

async function apiGet<T>(url: string): Promise<T | null> {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

export default function ExplorePage() {
    const [tab, setTab] = useState<Tab>("businesses");
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        apiGet<{ businesses: Business[] }>(
            "/api/v1/business?state=true&limit=100"
        ).then(d => setBusinesses(d?.businesses ?? []));
        apiGet<{ catalogs: { services: Service[] }[] }>(
            "/api/v1/catalog?state=true&service=true&limit=100"
        ).then(d => {
            const all = (d?.catalogs ?? []).flatMap(c => c.services);
            setServices(all);
        });
    }, []);

    const filteredBusinesses = businesses.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase())
    );
    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AppLayout>
            <h1 className="mb-6 text-2xl font-bold text-gray-900">
                Explore
            </h1>

            <div className="mb-6 flex gap-2 border-b border-gray-200">
                {(
                    [
                        { id: "businesses", label: "Businesses" },
                        { id: "services", label: "Services" }
                    ] as { id: Tab; label: string }[]
                ).map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`
                            px-4 py-2 text-sm font-medium
                            ${tab === t.id
                                ? "border-b-2 border-blue-600 text-blue-600"
                                : "text-gray-500 hover:text-gray-700"}
                        `}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mb-6 max-w-md">
                <Input
                    id="search"
                    name="search"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {tab === "businesses" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredBusinesses.map(b => (
                        <Link
                            key={b.id}
                            href={`/businesses/${b.id}`}
                            className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow"
                        >
                            <h2 className="mb-1 text-lg font-semibold text-gray-900">
                                {b.name}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {b.description}
                            </p>
                        </Link>
                    ))}
                    {filteredBusinesses.length === 0 && (
                        <p className="text-sm text-gray-500">
                            No businesses found.
                        </p>
                    )}
                </div>
            )}

            {tab === "services" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredServices.map(s => (
                        <Link
                            key={s.id}
                            href={`/services/${s.id}`}
                            className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-300 hover:shadow"
                        >
                            <h2 className="mb-1 text-lg font-semibold text-gray-900">
                                {s.name}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {s.catalog?.name}
                            </p>
                        </Link>
                    ))}
                    {filteredServices.length === 0 && (
                        <p className="text-sm text-gray-500">
                            No services found.
                        </p>
                    )}
                </div>
            )}
        </AppLayout>
    );
}

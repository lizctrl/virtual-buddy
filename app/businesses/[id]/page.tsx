"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppLayout from "@/app/components/layout/AppLayout";
import BusinessIdentity from "@/app/components/directory/BusinessIdentity";
import { apiGet } from "@/app/lib/api/client";
import type { PublicBusiness } from "@/app/lib/public-business";

export default function BusinessDetailPage() {
    const { id } = useParams<{ id: string }>();
    return <BusinessDetail key={id} id={id} />;
}

function BusinessDetail({ id }: { id: string }) {
    const [business, setBusiness] = useState<PublicBusiness | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        apiGet<{ business: PublicBusiness }>(`/api/v1/business/${encodeURIComponent(id)}`).then(result => {
            if (!active) return;
            if (result.ok) setBusiness(result.data.business);
            else setError(result.message);
        });
        return () => { active = false; };
    }, [id]);

    const catalogs = business?.catalogs.filter(catalog => catalog.services.length > 0) ?? [];

    return (
        <AppLayout>
            <div lang="es" className="mx-auto max-w-[90rem]">
                <Link href="/explore" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-700">
                    <span aria-hidden="true">←</span> Volver a Explorar
                </Link>

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
                {!business && !error && <p role="status" className="text-sm text-slate-600">Cargando emprendimiento…</p>}

                {business && (
                    <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
                        <BusinessIdentity id={business.id} name={business.name} cover />
                        <header className="border-b border-indigo-100 bg-white px-4 py-5 sm:px-6">
                            <p className="text-xs font-bold tracking-widest text-indigo-700 uppercase">Perfil del emprendimiento</p>
                            <h1 className="mt-1 text-2xl font-bold break-words text-slate-900 sm:text-3xl">{business.name}</h1>
                            {business.location && <p className="mt-2 text-sm font-semibold text-indigo-800">{business.location.canton} · {business.location.province}</p>}
                            {business.description && <p className="mt-2 max-w-3xl text-sm break-words text-slate-600">{business.description}</p>}
                        </header>

                        <div className="space-y-5 p-4 sm:p-6">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Servicios</h2>
                                {business.acceptsBookings && <p className="mt-1 text-sm text-slate-600">Selecciona un servicio para consultar sus horarios y reservar.</p>}
                            </div>
                            {!business.acceptsBookings && (
                                <p className="rounded-xl border border-indigo-100 bg-white p-4 text-sm text-slate-700">
                                    Este emprendimiento todavía no ofrece reservas en línea.
                                </p>
                            )}
                            {catalogs.map(catalog => (
                                <section key={catalog.id}>
                                    <h3 className="mb-2 text-xs font-bold tracking-wide break-words text-slate-700 uppercase">{catalog.name}</h3>
                                    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                        {catalog.services.map(service => (
                                            <li key={service.id} className="flex min-w-0 flex-col rounded-xl border border-indigo-100 bg-white p-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="font-semibold break-words text-slate-900">{service.name}</h4>
                                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">{service.durationMinutes} min</span>
                                                </div>
                                                {business.acceptsBookings && (
                                                    <Link href={`/services/${service.id}`} aria-label={`Ver horarios de ${service.name}`}
                                                        className="mt-3 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-indigo-700 px-3 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">
                                                        Ver horarios <span aria-hidden="true">→</span>
                                                    </Link>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </AppLayout>
    );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/layout/AppLayout";
import BusinessIdentity from "@/app/components/directory/BusinessIdentity";
import Select from "@/app/components/ui/Select";
import { provinces } from "@/app/lib/costa-rica-locations";
import { apiGet } from "@/app/lib/api/client";
import type { PublicBusiness } from "@/app/lib/public-business";

const pageSize = 12;
const card = "group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700";
const control = "rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-700";

function normalize(value: string) {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-CR");
}

function matches(query: string[], ...fields: string[]) {
    if (!query.length) return true;
    const text = normalize(fields.join(" "));
    return query.every(word => text.includes(word));
}

async function loadDirectory() {
    const businesses: PublicBusiness[] = [];
    for (let page = 1; ; page++) {
        const result = await apiGet<{ businesses: PublicBusiness[]; hasNextPage: boolean }>(
            `/api/v1/directory?limit=100&page=${page}`
        );
        if (!result.ok) return result;
        businesses.push(...result.data.businesses);
        if (!result.data.hasNextPage) return { ok: true as const, data: businesses };
    }
}

export default function ExplorePage() {
    const [tab, setTab] = useState<"businesses" | "services">("businesses");
    const [businesses, setBusinesses] = useState<PublicBusiness[] | null>(null);
    const [search, setSearch] = useState("");
    const [provinceCode, setProvinceCode] = useState(0);
    const [cantonCode, setCantonCode] = useState(0);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [limit, setLimit] = useState(pageSize);

    useEffect(() => {
        let active = true;
        loadDirectory().then(result => {
            if (!active) return;
            if (result.ok) setBusinesses(result.data);
            else setError(result.message);
        });
        return () => { active = false; };
    }, [retry]);

    const query = normalize(search).trim().split(/\s+/).filter(Boolean);
    const province = provinces.find(item => item.code === provinceCode);
    const localBusinesses = (businesses ?? []).filter(business =>
        (!provinceCode || business.location?.provinceCode === provinceCode) &&
        (!cantonCode || business.location?.cantonCode === cantonCode)
    );
    const hasFilters = query.length > 0 || provinceCode !== 0;
    const listedBusinesses = localBusinesses.filter(business =>
        matches(query, business.name, business.description, business.location?.canton ?? "", business.location?.province ?? "", ...business.catalogs.flatMap(catalog => [
            catalog.name, ...catalog.services.map(service => service.name)
        ]))
    );
    const listedServices = localBusinesses.flatMap(business => business.acceptsBookings
        ? business.catalogs.flatMap(catalog => catalog.services
            .filter(service => matches(query, business.name, business.description, business.location?.canton ?? "", business.location?.province ?? "", catalog.name, service.name))
            .map(service => ({ ...service, business, catalogName: catalog.name })))
        : []
    );
    const count = tab === "businesses" ? listedBusinesses.length : listedServices.length;
    const resultLabel = tab === "businesses"
        ? count === 1 ? "emprendimiento" : "emprendimientos"
        : count === 1 ? "servicio" : "servicios";

    return (
        <AppLayout>
            <div lang="es" className="mx-auto max-w-[90rem]">
                <header className="relative isolate overflow-hidden rounded-2xl bg-indigo-950 px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
                    <svg aria-hidden="true" viewBox="0 0 420 240" fill="none" className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden h-full w-auto text-indigo-300 opacity-45 sm:block" stroke="currentColor" strokeWidth="1.6">
                        <path d="M119 239v-97a86 86 0 0 1 172 0v97m-151 0v-97a65 65 0 0 1 130 0v97m-109 0v-97a44 44 0 0 1 88 0v97m-67 0v-97a23 23 0 0 1 46 0v97M329 0v48a57 57 0 0 0 57 57h34m-70-105v48a36 36 0 0 0 36 36h34m-49-84v48a15 15 0 0 0 15 15h34" />
                        <path d="M67 72h24M79 60v24m249 90h28m-14-14v28" strokeLinecap="round" /><circle cx="72" cy="155" r="13" />
                    </svg>
                    <p className="mb-2 text-xs font-bold tracking-[0.18em] text-indigo-200 uppercase">Directorio de negocios</p>
                    <h1 className="max-w-xl text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Descubre emprendimientos</h1>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-indigo-100 sm:text-base">
                        Encuentra un negocio que te guste, explora sus servicios y elige un horario para tu próxima cita.
                    </p>
                </header>

                <section aria-label="Directorio" className="mt-4 rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-indigo-100 bg-white p-4 sm:px-5">
                        <div aria-label="Explorar por" className="inline-flex rounded-lg bg-indigo-50 p-1">
                            {(["businesses", "services"] as const).map(mode => (
                                <button type="button" key={mode} aria-pressed={tab === mode}
                                    onClick={() => { setTab(mode); setLimit(pageSize); }}
                                    className={`rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-indigo-700 ${tab === mode ? "bg-white text-indigo-900 shadow-sm" : "text-slate-600 hover:text-indigo-800"}`}>
                                    {mode === "businesses" ? "Emprendimientos" : "Servicios"}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full sm:w-80">
                            <svg aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
                            </svg>
                            <label htmlFor="directory-search" className="sr-only">Buscar negocios o servicios</label>
                            <input id="directory-search" type="search" placeholder="Buscar negocios o servicios" value={search}
                                onChange={event => { setSearch(event.target.value); setLimit(pageSize); }}
                                className="min-h-10 w-full min-w-0 rounded-lg border border-indigo-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-700" />
                        </div>
                    </div>

                    <div className="grid gap-3 border-b border-indigo-100 bg-white px-4 py-3 sm:grid-cols-2 sm:px-5">
                        <Select id="directory-province" label="Provincia" value={provinceCode}
                            options={[{ label: "Todas las provincias", value: 0 }, ...provinces.map(item => ({ label: item.name, value: item.code }))]}
                            onChange={event => { setProvinceCode(Number(event.target.value)); setCantonCode(0); setLimit(pageSize); }}
                            className="min-w-0 w-full bg-white text-sm" />
                        <Select id="directory-canton" label="Cantón" value={cantonCode} disabled={!province}
                            options={[{ label: province ? "Todos los cantones" : "Primero elige una provincia", value: 0 }, ...(province?.cantons ?? []).map(([value, label]) => ({ value, label }))]}
                            onChange={event => { setCantonCode(Number(event.target.value)); setLimit(pageSize); }}
                            className="min-w-0 w-full bg-white text-sm disabled:bg-slate-100" />
                    </div>

                    <div className="p-4 sm:p-5">
                        {error && (
                            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 text-sm text-rose-800">
                                <p>No se pudo cargar el directorio. {error}</p>
                                <button type="button" className={control} onClick={() => { setError(""); setRetry(n => n + 1); }}>Reintentar</button>
                            </div>
                        )}
                        {!businesses && !error && <p role="status" className="px-1 py-3 text-sm text-slate-600">Cargando el directorio…</p>}
                        {businesses && (
                            <>
                                <p role="status" className="mb-3 px-1 text-sm font-semibold text-slate-700">
                                    {count} {resultLabel}{hasFilters ? (count === 1 ? " encontrado" : " encontrados") : " en el directorio"}
                                </p>
                                {count === 0 && (
                                    <div className="rounded-xl border border-dashed border-indigo-200 bg-white p-7 text-center">
                                        <p className="font-semibold text-slate-900">{hasFilters ? "No encontramos coincidencias." : "Todavía no hay resultados para mostrar."}</p>
                                        {hasFilters && (
                                            <button type="button" className={`mt-3 ${control}`} onClick={() => { setSearch(""); setProvinceCode(0); setCantonCode(0); setLimit(pageSize); }}>Limpiar filtros</button>
                                        )}
                                    </div>
                                )}
                                <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                    {tab === "businesses" ? listedBusinesses.slice(0, limit).map(business => {
                                        const categories = business.catalogs.filter(catalog => catalog.services.length > 0);
                                        const services = categories.flatMap(catalog => catalog.services);
                                        return (
                                            <li key={business.id} className="min-w-0">
                                                <Link href={`/businesses/${business.id}`} className={card}>
                                                    <BusinessIdentity id={business.id} name={business.name} cover />
                                                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                                                        <h2 className="text-lg font-bold break-words text-slate-900">{business.name}</h2>
                                                        {business.location && <p className="mt-1 text-xs font-semibold text-indigo-800">{business.location.canton} · {business.location.province}</p>}
                                                        {business.description && <p className="mt-1 line-clamp-2 text-sm break-words text-slate-600">{business.description}</p>}
                                                        {categories.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                                {categories.slice(0, 2).map(category => (
                                                                    <span key={category.id} className="max-w-full truncate rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">{category.name}</span>
                                                                ))}
                                                                {categories.length > 2 && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">+{categories.length - 2}</span>}
                                                            </div>
                                                        )}
                                                        {services.length > 0 && (
                                                            <p className="mt-2 line-clamp-2 text-xs break-words text-slate-600">
                                                                {services.slice(0, 3).map(service => service.name).join(" · ")}
                                                            </p>
                                                        )}
                                                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                                                            <span className="text-xs text-slate-600">{business.acceptsBookings
                                                                ? `${services.length} ${services.length === 1 ? "servicio" : "servicios"}`
                                                                : "Sin reservas en línea"}</span>
                                                            <span className="font-semibold text-indigo-800 group-hover:underline">{services.length ? "Ver servicios" : "Ver perfil"} →</span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </li>
                                        );
                                    }) : listedServices.slice(0, limit).map(service => (
                                        <li key={service.id} className="min-w-0">
                                            <Link href={`/services/${service.id}`} className={`${card} p-4 sm:p-5`}>
                                                <div className="flex items-start gap-3">
                                                    <BusinessIdentity id={service.business.id} name={service.business.name} />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold break-words text-indigo-800">{service.business.name}</p>
                                                        <h2 className="mt-0.5 text-base font-bold break-words text-slate-900">{service.name}</h2>
                                                        <p className="text-xs break-words text-slate-600">{service.catalogName}</p>
                                                        {service.business.location && <p className="mt-1 text-xs text-slate-600">{service.business.location.canton} · {service.business.location.province}</p>}
                                                    </div>
                                                </div>
                                                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">{service.durationMinutes} min</span>
                                                    <span className="font-semibold text-indigo-800 group-hover:underline">Ver horarios →</span>
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                                {count > limit && (
                                    <div className="mt-5 text-center">
                                        <button type="button" className={control} onClick={() => setLimit(n => n + pageSize)}>Mostrar más</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import { apiPost, apiPut, type ApiResult } from "@/app/lib/api/client";
import { defaultDuration, maxDuration } from "@/app/lib/calendar";

import { loadCatalogs, type Catalog, type Service } from "./business-catalogs";
import { panelPrimary as primary, panelSecondary as secondary } from "./panel-styles";

function countLabel(count: number, singular: string, plural: string) {
    return `${count} ${count === 1 ? singular : plural}`;
}

export default function CatalogsServices({ businessId }: { businessId: number }) {
    const [catalogs, setCatalogs] = useState<Catalog[] | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editor, setEditor] = useState<"catalog" | "service" | number | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [retry, setRetry] = useState(0);
    const selected = catalogs?.find(catalog => catalog.id === selectedId);
    const visible = selected ? [selected] : catalogs ?? [];
    const serviceCount = catalogs?.reduce((total, catalog) => total + catalog.services.length, 0) ?? 0;
    const visibleCount = selected?.services.length ?? serviceCount;

    useEffect(() => {
        let active = true;
        loadCatalogs(businessId).then(result => {
            if (!active) return;
            if (result.ok) setCatalogs(result.data);
            else setLoadError(result.message);
        });
        return () => { active = false; };
    }, [businessId, retry]);

    function open(next: typeof editor) {
        setEditor(next);
        setError("");
        setNotice("");
    }

    function selectCatalog(id: number | null) {
        setSelectedId(id);
        open(null);
    }

    async function save<T>(request: () => Promise<ApiResult<T>>, update: (data: T) => void, message: string) {
        if (saving) return;
        setSaving(true);
        setError("");
        setNotice("");
        const result = await request();
        setSaving(false);
        if (!result.ok) {
            setError(result.message);
            return;
        }
        update(result.data);
        setEditor(null);
        setNotice(message);
    }

    function addCatalog(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
        if (!name) {
            setError("Escribe el nombre del catálogo.");
            return;
        }
        void save(() => apiPost<{ catalog: Omit<Catalog, "services"> }>("/api/v1/catalog", { name, businessId }),
            ({ catalog }) => {
                setCatalogs(previous => [...(previous ?? []), { ...catalog, services: [] }]);
                setSelectedId(catalog.id);
            }, "Catálogo creado.");
    }

    function addService(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const name = String(values.get("name") ?? "").trim();
        const catalogId = Number(values.get("catalogId"));
        const durationMinutes = Number(values.get("durationMinutes"));
        if (!name) {
            setError("Escribe el nombre del servicio.");
            return;
        }
        void save(() => apiPost<{ service: Service }>("/api/v1/service", { name, catalogId, durationMinutes }),
            ({ service }) => {
                setCatalogs(previous => previous?.map(catalog => catalog.id === service.catalogId
                    ? { ...catalog, services: [...catalog.services, service] }
                    : catalog) ?? []);
                if (selected) setSelectedId(service.catalogId);
            }, "Servicio creado.");
    }

    function saveDuration(event: FormEvent<HTMLFormElement>, serviceId: number) {
        event.preventDefault();
        const durationMinutes = Number(new FormData(event.currentTarget).get("durationMinutes"));
        void save(() => apiPut<{ service: Service }>(`/api/v1/service/${serviceId}`, { durationMinutes }),
            ({ service }) => setCatalogs(previous => previous?.map(catalog => catalog.id === service.catalogId
                ? { ...catalog, services: catalog.services.map(item => item.id === service.id ? service : item) }
                : catalog) ?? []), "Duración actualizada.");
    }

    const message = error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>;

    return (
        <section lang="es" aria-labelledby="catalog-panel-title" className="rounded-2xl border border-indigo-100 bg-[#f5f4fb] shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-indigo-100 bg-white px-4 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <span className="shrink-0 rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
                        <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M8 12h8m-8 3h5" />
                        </svg>
                    </span>
                    <div>
                        <h2 id="catalog-panel-title" className="text-lg font-bold text-slate-900">Catálogos y servicios</h2>
                        <p className="text-xs text-slate-600">Organiza lo que tus clientes pueden reservar.</p>
                    </div>
                </div>
                {!!catalogs?.length && (
                    <button type="button" className={primary} disabled={saving} aria-expanded={editor === "service"}
                        onClick={() => open(editor === "service" ? null : "service")}>
                        <span aria-hidden="true">+</span> Nuevo servicio
                    </button>
                )}
            </header>

            <div className="p-3 sm:p-4">
                {loadError && (
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-white p-4 text-sm text-rose-800">
                        <p>No se pudieron cargar los catálogos. {loadError}</p>
                        <button type="button" className={secondary} onClick={() => { setLoadError(""); setRetry(n => n + 1); }}>Reintentar</button>
                    </div>
                )}
                {!catalogs && !loadError && <p role="status" className="rounded-xl bg-white p-4 text-sm text-slate-600">Cargando catálogos…</p>}
                {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

                {catalogs && (
                    <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
                        <aside aria-label="Catálogos" className="min-w-0 rounded-xl border border-indigo-100 bg-white p-3 sm:p-4">
                            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
                                <h3 className="font-bold text-slate-900">Catálogos</h3>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{catalogs.length}</span>
                            </div>
                            {catalogs.length > 0 && (
                                <ul aria-label="Filtrar servicios por catálogo" className="space-y-1">
                                    {[{ id: null, name: "Todos los servicios", count: serviceCount }, ...catalogs.map(catalog => ({
                                        id: catalog.id, name: catalog.name, count: catalog.services.length
                                    }))].map(item => (
                                        <li key={item.id ?? "all"}>
                                            <button type="button" aria-pressed={selectedId === item.id} disabled={saving}
                                                onClick={() => selectCatalog(item.id)}
                                                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-indigo-700 ${selectedId === item.id
                                                    ? "border-indigo-100 bg-indigo-50 font-semibold text-indigo-900"
                                                    : "border-transparent text-slate-700 hover:bg-slate-50"}`}>
                                                <span className="min-w-0 break-words">{item.name}</span>
                                                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{item.count}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {editor === "catalog" ? (
                                <form onSubmit={addCatalog} className="mt-3 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                                    <Input id="new-catalog-name" name="name" label="Nombre del catálogo" placeholder="Ej. Cortes" autoFocus required disabled={saving} className="w-full bg-white text-sm" />
                                    {message}
                                    <div className="flex flex-wrap gap-2">
                                        <button type="submit" className={primary} disabled={saving}>{saving ? "Guardando…" : "Crear catálogo"}</button>
                                        <button type="button" className={secondary} disabled={saving} onClick={() => open(null)}>Cancelar</button>
                                    </div>
                                </form>
                            ) : (
                                <button type="button" className={`mt-3 w-full ${secondary}`} disabled={saving} onClick={() => open("catalog")}>
                                    <span aria-hidden="true">+</span> Nuevo catálogo
                                </button>
                            )}
                        </aside>

                        <section aria-labelledby="catalog-services-title" className="min-w-0 rounded-xl border border-indigo-100 bg-white">
                            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                                <h3 id="catalog-services-title" className="min-w-0 font-bold break-words text-slate-900">{selected?.name ?? "Todos los servicios"}</h3>
                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">{countLabel(visibleCount, "servicio", "servicios")}</span>
                            </header>

                            <div className="space-y-5 p-4 sm:p-5">
                                {editor === "service" && (
                                    <form onSubmit={addService} className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                                        <h4 className="text-sm font-bold text-slate-900">Nuevo servicio</h4>
                                        <Select id="new-service-catalog" name="catalogId" label="Catálogo"
                                            defaultValue={selected?.id ?? (catalogs.length === 1 ? catalogs[0].id : "")}
                                            options={[{ label: "Selecciona un catálogo", value: "" }, ...catalogs.map(catalog => ({ label: catalog.name, value: catalog.id }))]}
                                            autoFocus={!selected && catalogs.length > 1} required disabled={saving} className="w-full bg-white text-sm" />
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                                            <Input id="new-service-name" name="name" label="Nombre del servicio" placeholder="Ej. Corte clásico" autoFocus={!!selected || catalogs.length === 1} required disabled={saving} className="w-full bg-white text-sm" />
                                            <Input id="new-service-duration" name="durationMinutes" type="number" label="Duración (min)" min={1} max={maxDuration}
                                                defaultValue={defaultDuration} required disabled={saving} className="w-full bg-white text-sm" />
                                        </div>
                                        {message}
                                        <div className="flex flex-wrap gap-2">
                                            <button type="submit" className={primary} disabled={saving}>{saving ? "Guardando…" : "Crear servicio"}</button>
                                            <button type="button" className={secondary} disabled={saving} onClick={() => open(null)}>Cancelar</button>
                                        </div>
                                    </form>
                                )}

                                {visibleCount === 0 && (
                                    <div className="rounded-xl border border-dashed border-indigo-200 bg-slate-50 px-4 py-7 text-center">
                                        <p className="text-sm font-semibold text-slate-900">{catalogs.length ? "Aún no hay servicios aquí" : "Crea tu primer catálogo"}</p>
                                        <p className="mt-1 text-sm text-slate-600">{catalogs.length ? "Agrega un servicio para que aparezca en esta lista." : "Un catálogo reúne servicios relacionados, como cortes o tratamientos."}</p>
                                    </div>
                                )}

                                {visible.filter(catalog => catalog.services.length > 0).map(catalog => (
                                    <section key={catalog.id} aria-label={catalog.name}>
                                        {!selected && <h4 className="mb-2 text-xs font-bold tracking-wide text-slate-600 uppercase">{catalog.name}</h4>}
                                        <ul className="space-y-2">
                                            {catalog.services.map(service => (
                                                <li key={service.id} className="rounded-xl border border-slate-200 px-3.5 py-3">
                                                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="max-w-full font-semibold break-words text-slate-900">{service.name}</p>
                                                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-800">{service.durationMinutes} min</span>
                                                            </div>
                                                            <Link href={`/services/${service.id}`} aria-label={`Ver página de reserva de ${service.name}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline">
                                                                Ver página de reserva <span aria-hidden="true">↗</span>
                                                            </Link>
                                                        </div>
                                                        <button type="button" className={secondary} aria-expanded={editor === service.id} disabled={saving}
                                                            aria-label={`Editar duración de ${service.name}`}
                                                            onClick={() => open(editor === service.id ? null : service.id)}>
                                                            Editar duración
                                                        </button>
                                                    </div>
                                                    {editor === service.id && (
                                                        <form onSubmit={event => saveDuration(event, service.id)} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                                                            <div className="flex flex-wrap items-end gap-2">
                                                                <Input id={`duration-${service.id}`} name="durationMinutes" type="number" label="Duración (min)"
                                                                    min={1} max={maxDuration} defaultValue={service.durationMinutes} autoFocus required disabled={saving}
                                                                    className="w-28 text-sm" />
                                                                <button type="submit" className={primary} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
                                                                <button type="button" className={secondary} disabled={saving} onClick={() => open(null)}>Cancelar</button>
                                                            </div>
                                                            {message}
                                                        </form>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </section>
    );
}

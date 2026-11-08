"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import AppLayout from "@/app/components/layout/AppLayout";
import BusinessLocation, { LocationFields } from "@/app/components/dashboard/BusinessLocation";
import BusinessModeration from "@/app/components/dashboard/BusinessModeration";
import BusinessAvailability from "@/app/components/dashboard/BusinessAvailability";
import AppointmentCalendar from "@/app/components/dashboard/AppointmentCalendar";
import CatalogsServices from "@/app/components/dashboard/CatalogsServices";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Select from "@/app/components/ui/Select";
import { apiGet, apiPost } from "@/app/lib/api/client";
import { User } from "@/app/types/types";

interface Business {
    id: number;
    name: string;
    description: string;
    cantonCode: number | null;
    ownerId: number | null;
    state: boolean;
}
interface Service {
    id: number;
    name: string;
    catalogId: number;
    durationMinutes: number;
    state: boolean;
}
interface Catalog {
    id: number;
    name: string;
    businessId: number;
    state: boolean;
    services: Service[];
}
interface Appointment {
    id: number;
    userId: number;
    user?: { name: string; last_name: string };
    serviceId: number;
    status: string;
    dueDate: string;
    state: boolean;
    service: Service & { catalog: { businessId: number } };
}
type Tab =
    | "overview"
    | "catalogs"
    | "availability"
    | "appointments"
    | "moderation"
    | "location";

const tabs: { id: Tab; label: string }[] = [
    { id: "appointments", label: "Agenda" },
    { id: "overview", label: "Resumen" },
    { id: "catalogs", label: "Catálogos y servicios" },
    { id: "availability", label: "Disponibilidad" },
    { id: "location", label: "Ubicación" },
    { id: "moderation", label: "Moderación" }
];

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [selectedBusiness, setSelectedBusiness] = useState<number | null>(
        null
    );
    const [tab, setTab] = useState<Tab>("appointments");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadCount, setReloadCount] = useState(0);
    const [creating, setCreating] = useState(false);
    // Element id to focus after the next render; the button or form being left unmounts with the focus.
    const pendingFocus = useRef<string | null>(null);

    useEffect(() => {
        if (!pendingFocus.current) return;
        document.getElementById(pendingFocus.current)?.focus();
        pendingFocus.current = null;
    });

    function openCreate() {
        setCreating(true);
        window.scrollTo(0, 0);
    }

    function cancelCreate() {
        setCreating(false);
        pendingFocus.current = "new-business-button";
        window.scrollTo(0, 0);
    }

    function businessCreated(created: Business) {
        // Show the new business now; the reload then replaces the list with the server's.
        setBusinesses(list => list.some(b => b.id === created.id) ? list : [...list, created]);
        setSelectedBusiness(created.id);
        setCreating(false);
        setReloadCount(c => c + 1);
        pendingFocus.current = "business-title";
    }

    useEffect(() => {
        let active = true;
        apiGet<User>("/api/v1/auth/me")
            .then(me => {
                if (!active) return;
                if (!me.ok) {
                    setError(me.message);
                    setUser(null);
                    return null;
                }
                setUser(me.data);
                return apiGet<{ businesses: Business[] }>(
                    `/api/v1/business?ownerId=${me.data.id}&state=true&limit=100`
                ).then(result => {
                    if (!active) return;
                    if (!result.ok) {
                        setError(result.message);
                        return;
                    }
                    const list = result.data.businesses;
                    setBusinesses(list);
                    setSelectedBusiness(
                        prev => prev ?? list[0]?.id ?? null
                    );
                });
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [reloadCount]);

    if (loading) {
        return (
            <AppLayout>
                <p className="text-gray-500">Loading...</p>
            </AppLayout>
        );
    }

    if (!user) {
        return (
            <AppLayout>
                <p className="text-gray-500">
                    Could not load user. Please sign in again.
                </p>
            </AppLayout>
        );
    }

    if (businesses.length === 0 || creating) {
        return (
            <AppLayout>
                {error && (
                    <p className="mb-4 text-sm text-red-600">
                        {error}
                    </p>
                )}

                <BusinessOnboarding
                    onCreated={businessCreated}
                    onCancel={businesses.length > 0 ? cancelCreate : undefined}
                />
            </AppLayout>
        );
    }

    const business =
        businesses.find(b => b.id === selectedBusiness) ?? businesses[0];

    return (
        <AppLayout>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 id="business-title" tabIndex={-1} className="text-2xl font-bold text-gray-900 outline-none">
                        {business.name}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {business.description}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {businesses.length > 1 && (
                        <Select
                            aria-label="Seleccionar negocio"
                            value={business.id}
                            onChange={e =>
                                setSelectedBusiness(Number(e.target.value))
                            }
                            options={businesses.map(b => ({
                                label: b.name,
                                value: b.id
                            }))}
                        />
                    )}
                    <Button id="new-business-button" type="button" variant="secondary" onClick={openCreate}>
                        Nuevo negocio
                    </Button>
                </div>
            </div>

            {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

            <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
                {tabs.map(t => (
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

            {tab === "overview" && (
                <Overview
                    businessId={business.id}
                    ownerId={business.ownerId}
                />
            )}
            {tab === "catalogs" && (
                <CatalogsServices key={business.id} businessId={business.id} />
            )}
            {tab === "availability" && (
                <BusinessAvailability key={business.id} businessId={business.id} />
            )}
            {tab === "appointments" && (
                <AppointmentCalendar
                    mode="business"
                    key={business.id}
                    ownerId={user.id}
                    businessId={business.id}
                    onManageAvailability={() => setTab("availability")}
                />
            )}
            {tab === "location" && (
                <BusinessLocation key={business.id} businessId={business.id} cantonCode={business.cantonCode}
                    onSave={cantonCode => setBusinesses(previous => previous.map(item => item.id === business.id ? { ...item, cantonCode } : item))} />
            )}
            {tab === "moderation" && (
                <BusinessModeration key={business.id} businessId={business.id} businessName={business.name} />
            )}
        </AppLayout>
    );
}

function BusinessOnboarding({ onCreated, onCancel }: { onCreated: (business: Business) => void; onCancel?: () => void }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    // State lags a render behind; a ref blocks a second submit in the same tick.
    const submitting = useRef(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setError(null);
        setLoading(true);
        const result = await apiPost<{ business: Business }>("/api/v1/business", {
            name,
            description,
            cantonCode: Number(new FormData(e.currentTarget).get("cantonCode")) || null
        });
        setLoading(false);
        submitting.current = false;
        const created = result.ok ? result.data?.business : undefined;
        if (!created) {
            setError((!result.ok && result.message) || "No se pudo crear el negocio.");
            return;
        }
        onCreated(created);
    }

    return (
        <div className="mx-auto max-w-lg">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
                {onCancel ? "Nuevo negocio" : "Crea tu negocio"}
            </h1>
            <p className="mb-6 text-sm text-gray-500">
                {onCancel
                    ? "Después podrás agregar sus catálogos, servicios y horarios."
                    : "Empieza por crear tu negocio. Después podrás agregar catálogos, servicios y horarios."}
            </p>

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6"
            >
                <Input
                    id="name"
                    name="name"
                    label="Nombre del negocio"
                    autoFocus={!!onCancel}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />
                <Input
                    id="description"
                    name="description"
                    label="Descripción"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                />

                {error && (
                    <p role="alert" className="text-sm text-red-600">{error}</p>
                )}

                <LocationFields />

                <Button type="submit" disabled={loading}>
                    {loading ? "Creando…" : "Crear negocio"}
                </Button>

                {onCancel ? (
                    <Button type="button" variant="secondary" disabled={loading} onClick={onCancel}>
                        Cancelar
                    </Button>
                ) : (
                <p className="text-center text-sm text-gray-500">
                    ¿Solo quieres reservar servicios?{" "}
                    <Link
                        href="/explore"
                        className="font-medium text-blue-600 hover:underline"
                    >
                        Explora como cliente
                    </Link>
                </p>
                )}
            </form>
        </div>
    );
}

function Overview({
    businessId,
    ownerId
}: {
    businessId: number;
    ownerId: number | null;
}) {
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<{ catalogs: Catalog[] }>(
            `/api/v1/catalog?businessId=${businessId}&state=true&service=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setLoadError(result.message);
                return;
            }
            setCatalogs(result.data.catalogs);
        });
    }, [businessId]);

    useEffect(() => {
        // The appointment route scopes by `ownerId`, which is the owner
        // *user* id, not the business id.
        if (ownerId === null) return;

        apiGet<{ appointments: Appointment[] }>(
            `/api/v1/appointment?ownerId=${ownerId}&businessId=${businessId}&state=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setLoadError(result.message);
                return;
            }
            setAppointments(result.data.appointments);
        });
    }, [ownerId, businessId]);

    const error =
        ownerId === null
            ? "This business has no owner to load appointments by."
            : loadError;

    const totalServices = catalogs.reduce(
        (sum, c) => sum + c.services.length,
        0
    );
    const pending = appointments.filter(a => a.status === "pending").length;

    const stats = [
        { label: "Catalogs", value: catalogs.length },
        { label: "Services", value: totalServices },
        { label: "Pending appointments", value: pending },
        { label: "Total appointments", value: appointments.length }
    ];

    return (
        <div className="space-y-4">
            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(s => (
                    <div
                        key={s.label}
                        className="rounded-xl border border-gray-200 bg-white p-6"
                    >
                        <p className="text-sm text-gray-500">{s.label}</p>
                        <p className="mt-1 text-3xl font-bold text-gray-900">
                            {s.value}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

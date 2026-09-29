"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import AppLayout from "@/app/components/layout/AppLayout";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";
import Select from "@/app/components/ui/Select";
import { apiGet, apiPost, apiPut } from "@/app/lib/api/client";
import { User } from "@/app/types/types";

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
interface Appointment {
    id: number;
    userId: number;
    serviceId: number;
    status: string;
    dueDate: string;
    state: boolean;
    service: Service & { catalog: { businessId: number } };
}
interface Moderation {
    id: number;
    userId: number;
    businessId: number;
    status: string;
    state: boolean;
    user: { id: number; name: string; email: string };
}
interface Availability {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    serviceId: number;
    state: boolean;
}
interface WorkingHours {
    id: number;
    weekDay: string;
    startTime: string;
    endTime: string;
    serviceId: number;
    state: boolean;
}

type Tab =
    | "overview"
    | "catalogs"
    | "availability"
    | "appointments"
    | "moderation";

const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "catalogs", label: "Catalogs & Services" },
    { id: "availability", label: "Availability" },
    { id: "appointments", label: "Appointments" },
    { id: "moderation", label: "Moderation" }
];

const weekDays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

export default function DashboardPage() {
    const [user, setUser] = useState<User | null>(null);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [selectedBusiness, setSelectedBusiness] = useState<number | null>(
        null
    );
    const [tab, setTab] = useState<Tab>("overview");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadCount, setReloadCount] = useState(0);

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

    if (businesses.length === 0) {
        return (
            <AppLayout>
                {error && (
                    <p className="mb-4 text-sm text-red-600">
                        {error}
                    </p>
                )}

                <BusinessOnboarding
                    userId={user.id}
                    onCreated={() => setReloadCount(c => c + 1)}
                />
            </AppLayout>
        );
    }

    const business =
        businesses.find(b => b.id === selectedBusiness) ?? businesses[0];

    return (
        <AppLayout>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {business.name}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {business.description}
                    </p>
                </div>

                {businesses.length > 1 && (
                    <Select
                        aria-label="Select business"
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
            </div>

            {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

            <div className="mb-6 flex gap-2 border-b border-gray-200">
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
                <Overview businessId={business.id} />
            )}
            {tab === "catalogs" && (
                <CatalogsServices
                    businessId={business.id}
                />
            )}
            {tab === "availability" && (
                <Availability businessId={business.id} />
            )}
            {tab === "appointments" && (
                <Appointments businessId={business.id} />
            )}
            {tab === "moderation" && (
                <Moderation businessId={business.id} />
            )}
        </AppLayout>
    );
}

function BusinessOnboarding({
    userId,
    onCreated
}: {
    userId: number;
    onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const result = await apiPost("/api/v1/business", {
            name,
            description,
            ownerId: userId
        });
        setLoading(false);
        if (!result.ok) {
            setError(result.message || "Could not create business");
            return;
        }
        onCreated();
    }

    return (
        <div className="mx-auto max-w-lg">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
                Create your business
            </h1>
            <p className="mb-6 text-sm text-gray-500">
                Start by creating your business. You can add catalogs, services
                and availability next.
            </p>

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6"
            >
                <Input
                    id="name"
                    name="name"
                    label="Business name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                />
                <Input
                    id="description"
                    name="description"
                    label="Description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                />

                {error && (
                    <p className="text-sm text-red-600">{error}</p>
                )}

                <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create business"}
                </Button>

                <p className="text-center text-sm text-gray-500">
                    Just want to book services?{" "}
                    <Link
                        href="/explore"
                        className="font-medium text-blue-600 hover:underline"
                    >
                        Explore as a client
                    </Link>
                </p>
            </form>
        </div>
    );
}

function Overview({ businessId }: { businessId: number }) {
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiGet<{ catalogs: Catalog[] }>(
            `/api/v1/catalog?businessId=${businessId}&state=true&service=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setCatalogs(result.data.catalogs);
        });
        apiGet<{ appointments: Appointment[] }>(
            `/api/v1/appointment?ownerId=${businessId}&state=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setAppointments(result.data.appointments);
        });
    }, [businessId]);

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

function CatalogsServices({ businessId }: { businessId: number }) {
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [catalogName, setCatalogName] = useState("");
    const [serviceName, setServiceName] = useState("");
    const [selectedCatalog, setSelectedCatalog] = useState<number | "">("");
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        apiGet<{ catalogs: Catalog[] }>(
            `/api/v1/catalog?businessId=${businessId}&state=true&service=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setCatalogs(result.data.catalogs);
        });
    }, [businessId]);

    useEffect(() => {
        load();
    }, [load]);

    async function createCatalog(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const r = await apiPost("/api/v1/catalog", {
            name: catalogName,
            businessId
        });
        if (!r.ok) {
            setError(r.message || "Could not create catalog");
            return;
        }
        setCatalogName("");
        load();
    }

    async function createService(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!selectedCatalog) {
            setError("Select a catalog first");
            return;
        }
        const r = await apiPost("/api/v1/service", {
            name: serviceName,
            catalogId: selectedCatalog
        });
        if (!r.ok) {
            setError(r.message || "Could not create service");
            return;
        }
        setServiceName("");
        load();
    }

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Catalogs
                </h2>
                <form
                    onSubmit={createCatalog}
                    className="mb-4 flex flex-col gap-3"
                >
                    <Input
                        id="catalogName"
                        name="catalogName"
                        label="New catalog name"
                        value={catalogName}
                        onChange={e => setCatalogName(e.target.value)}
                        required
                    />
                    <Button type="submit">Add catalog</Button>
                </form>

                <ul className="space-y-2">
                    {catalogs.map(c => (
                        <li
                            key={c.id}
                            className="rounded-md border border-gray-200 p-3"
                        >
                            <p className="font-medium text-gray-900">
                                {c.name}
                            </p>
                            <p className="text-sm text-gray-500">
                                {c.services.length} service(s)
                            </p>
                        </li>
                    ))}
                    {catalogs.length === 0 && (
                        <li className="text-sm text-gray-500">
                            No catalogs yet.
                        </li>
                    )}
                </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Services
                </h2>
                <form
                    onSubmit={createService}
                    className="flex flex-col gap-3"
                >
                    <Select
                        id="catalogSelect"
                        label="Catalog"
                        value={selectedCatalog}
                        onChange={e =>
                            setSelectedCatalog(
                                e.target.value
                                    ? Number(e.target.value)
                                    : ""
                            )
                        }
                        options={catalogs.map(c => ({
                            label: c.name,
                            value: c.id
                        }))}
                    />
                    <Input
                        id="serviceName"
                        name="serviceName"
                        label="New service name"
                        value={serviceName}
                        onChange={e => setServiceName(e.target.value)}
                        required
                    />
                    <Button type="submit">Add service</Button>
                </form>

                {error && (
                    <p className="mt-3 text-sm text-red-600">{error}</p>
                )}
            </div>
        </div>
    );
}

function Availability({ businessId }: { businessId: number }) {
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [selectedService, setSelectedService] = useState<number | "">("");
    const [slots, setSlots] = useState<Availability[]>([]);
    const [hours, setHours] = useState<WorkingHours[]>([]);
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [weekDay, setWeekDay] = useState(weekDays[0]);
    const [whStart, setWhStart] = useState("");
    const [whEnd, setWhEnd] = useState("");
    const [error, setError] = useState<string | null>(null);

    const services = catalogs.flatMap(c => c.services);

    const load = useCallback(() => {
        apiGet<{ catalogs: Catalog[] }>(
            `/api/v1/catalog?businessId=${businessId}&state=true&service=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setCatalogs(result.data.catalogs);
        });
    }, [businessId]);

    useEffect(() => {
        load();
    }, [load]);

    const loadSlots = useCallback((serviceId: number) => {
        apiGet<{ availabilities: Availability[] }>(
            `/api/v1/availability?serviceId=${serviceId}&state=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setSlots(result.data.availabilities);
        });
    }, []);

    const loadHours = useCallback((serviceId: number) => {
        apiGet<{ workingHours: WorkingHours[] }>(
            `/api/v1/workingHours?serviceId=${serviceId}&state=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setHours(result.data.workingHours);
        });
    }, []);

    useEffect(() => {
        if (!selectedService) return;
        loadSlots(selectedService);
        loadHours(selectedService);
    }, [selectedService, loadSlots, loadHours]);

    async function addSlot(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!selectedService) {
            setError("Select a service first");
            return;
        }
        const r = await apiPost("/api/v1/availability", {
            date,
            startTime,
            endTime,
            serviceId: selectedService
        });
        if (!r.ok) {
            setError(r.message || "Could not add availability");
            return;
        }
        setDate("");
        setStartTime("");
        setEndTime("");
        loadSlots(selectedService);
    }

    async function addHours(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!selectedService) {
            setError("Select a service first");
            return;
        }
        const r = await apiPost("/api/v1/workingHours", {
            weekDay,
            startTime: whStart,
            endTime: whEnd,
            serviceId: selectedService
        });
        if (!r.ok) {
            setError(r.message || "Could not add working hours");
            return;
        }
        setWhStart("");
        setWhEnd("");
        loadHours(selectedService);
    }

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                    Service
                </label>
                <Select
                    id="serviceSelect"
                    value={selectedService}
                    onChange={e =>
                        setSelectedService(
                            e.target.value ? Number(e.target.value) : ""
                        )
                    }
                    options={services.map(s => ({
                        label: s.name,
                        value: s.id
                    }))}
                />
            </div>

            {selectedService && (
                <>
                    <div className="rounded-xl border border-gray-200 bg-white p-6">
                        <h2 className="mb-4 text-lg font-semibold text-gray-900">
                            Working hours
                        </h2>
                        <form
                            onSubmit={addHours}
                            className="mb-4 flex flex-wrap items-end gap-3"
                        >
                            <Select
                                id="weekDay"
                                label="Day"
                                value={weekDay}
                                onChange={e => setWeekDay(e.target.value)}
                                options={weekDays.map(d => ({
                                    label: d,
                                    value: d
                                }))}
                            />
                            <Input
                                id="whStart"
                                name="whStart"
                                type="time"
                                label="Start"
                                value={whStart}
                                onChange={e => setWhStart(e.target.value)}
                                required
                            />
                            <Input
                                id="whEnd"
                                name="whEnd"
                                type="time"
                                label="End"
                                value={whEnd}
                                onChange={e => setWhEnd(e.target.value)}
                                required
                            />
                            <Button type="submit">Add</Button>
                        </form>
                        <ul className="space-y-1">
                            {hours.map(h => (
                                <li
                                    key={h.id}
                                    className="text-sm text-gray-700"
                                >
                                    {h.weekDay}: {h.startTime} – {h.endTime}
                                </li>
                            ))}
                            {hours.length === 0 && (
                                <li className="text-sm text-gray-500">
                                    No working hours yet.
                                </li>
                            )}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-6">
                        <h2 className="mb-4 text-lg font-semibold text-gray-900">
                            Availability slots
                        </h2>
                        <form
                            onSubmit={addSlot}
                            className="mb-4 flex flex-wrap items-end gap-3"
                        >
                            <Input
                                id="date"
                                name="date"
                                type="date"
                                label="Date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                            <Input
                                id="startTime"
                                name="startTime"
                                type="time"
                                label="Start"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                required
                            />
                            <Input
                                id="endTime"
                                name="endTime"
                                type="time"
                                label="End"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                required
                            />
                            <Button type="submit">Add</Button>
                        </form>
                        {error && (
                            <p className="mb-3 text-sm text-red-600">
                                {error}
                            </p>
                        )}
                        <ul className="space-y-1">
                            {slots.map(s => (
                                <li
                                    key={s.id}
                                    className="flex items-center gap-2 text-sm text-gray-700"
                                >
                                    <span>
                                        {s.date} {s.startTime} – {s.endTime}
                                    </span>
                                    <Badge
                                        variant={
                                            s.status === "available"
                                                ? "success"
                                                : "default"
                                        }
                                    >
                                        {s.status}
                                    </Badge>
                                </li>
                            ))}
                            {slots.length === 0 && (
                                <li className="text-sm text-gray-500">
                                    No availability slots yet.
                                </li>
                            )}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}

function Appointments({ businessId }: { businessId: number }) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        apiGet<{ appointments: Appointment[] }>(
            `/api/v1/appointment?ownerId=${businessId}&state=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setAppointments(result.data.appointments);
        });
    }, [businessId]);

    useEffect(() => {
        load();
    }, [load]);

    async function updateStatus(id: number, status: string) {
        setError(null);
        const r = await apiPut(`/api/v1/appointment/${id}`, { status });
        if (!r.ok) {
            setError(r.message || "Could not update appointment");
            return;
        }
        load();
    }

    const statusVariant = (s: string) =>
        s === "confirmed"
            ? "success"
            : s === "rejected"
                ? "danger"
                : "warning";

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            {error && (
                <p className="mb-3 text-sm text-red-600">{error}</p>
            )}
            <ul className="space-y-3">
                {appointments.map(a => (
                    <li
                        key={a.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                    >
                        <div>
                            <p className="font-medium text-gray-900">
                                {a.service?.name ?? `Service #${a.serviceId}`}
                            </p>
                            <p className="text-sm text-gray-500">
                                User #{a.userId} ·{" "}
                                {new Date(a.dueDate).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={statusVariant(a.status)}>
                                {a.status}
                            </Badge>
                            {a.status === "pending" && (
                                <>
                                    <Button
                                        onClick={() =>
                                            updateStatus(a.id, "confirmed")
                                        }
                                    >
                                        Confirm
                                    </Button>
                                    <Button
                                        variant="danger"
                                        onClick={() =>
                                            updateStatus(a.id, "rejected")
                                        }
                                    >
                                        Reject
                                    </Button>
                                </>
                            )}
                        </div>
                    </li>
                ))}
                {appointments.length === 0 && (
                    <li className="text-sm text-gray-500">
                        No appointments yet.
                    </li>
                )}
            </ul>
        </div>
    );
}

function Moderation({ businessId }: { businessId: number }) {
    const [moderations, setModerations] = useState<Moderation[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        apiGet<{ moderations: Moderation[] }>(
            `/api/v1/moderation?state=true&limit=100`
        ).then(result => {
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setModerations(result.data.moderations);
        });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function setStatus(userId: number, status: string) {
        setError(null);
        const r = await apiPost("/api/v1/moderation", {
            userId,
            businessId,
            status
        });
        if (!r.ok) {
            setError(r.message || "Could not update moderation");
            return;
        }
        load();
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="mb-4 text-sm text-gray-500">
                Banned users can still view your services but cannot book
                appointments.
            </p>
            {error && (
                <p className="mb-3 text-sm text-red-600">{error}</p>
            )}
            <ul className="space-y-3">
                {moderations.map(m => (
                    <li
                        key={m.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                    >
                        <div>
                            <p className="font-medium text-gray-900">
                                {m.user.name}
                            </p>
                            <p className="text-sm text-gray-500">
                                {m.user.email}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={
                                    m.status === "banned"
                                        ? "danger"
                                        : "default"
                                }
                            >
                                {m.status}
                            </Badge>
                            {m.status === "banned" ? (
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        setStatus(m.userId, "active")
                                    }
                                >
                                    Unban
                                </Button>
                            ) : (
                                <Button
                                    variant="danger"
                                    onClick={() =>
                                        setStatus(m.userId, "banned")
                                    }
                                >
                                    Ban
                                </Button>
                            )}
                        </div>
                    </li>
                ))}
                {moderations.length === 0 && (
                    <li className="text-sm text-gray-500">
                        No moderated users yet.
                    </li>
                )}
            </ul>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppLayout from "@/app/components/layout/AppLayout";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Badge from "@/app/components/ui/Badge";
import { apiGet, apiPost } from "@/app/lib/api/client";

interface Service {
    id: number;
    name: string;
    catalogId: number;
    state: boolean;
    catalog: { id: number; name: string; businessId: number };
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

export default function ServiceDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);

    const [service, setService] = useState<Service | null>(null);
    const [slots, setSlots] = useState<Availability[]>([]);
    const [hours, setHours] = useState<WorkingHours[]>([]);
    const [loading, setLoading] = useState(true);

    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!id) return;
        Promise.all([
            apiGet<{ service: Service }>(`/api/v1/service/${id}`),
            apiGet<{ availabilities: Availability[] }>(
                `/api/v1/availability?serviceId=${id}&state=true&limit=100`
            ),
            apiGet<{ workingHours: WorkingHours[] }>(
                `/api/v1/workingHours?serviceId=${id}&state=true&limit=100`
            )
        ]).then(([s, a, w]) => {
            if (!s.ok) {
                setLoadError(s.message);
                return;
            }
            if (!a.ok) {
                setLoadError(a.message);
                return;
            }
            if (!w.ok) {
                setLoadError(w.message);
                return;
            }
            setService(s.data.service);
            setSlots(a.data.availabilities);
            setHours(w.data.workingHours);
        }).finally(() => setLoading(false));
    }, [id]);

    async function handleBook(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSubmitting(true);

        const r = await apiPost("/api/v1/appointment", {
            serviceId: id,
            dueDate: new Date(`${date}T${time}`).toISOString()
        });
        setSubmitting(false);

        if (!r.ok) {
            setError(r.message || "Could not book appointment");
            return;
        }
        setSuccess("Appointment booked! The business will confirm it soon.");
        setDate("");
        setTime("");
    }

    if (loading) {
        return (
            <AppLayout>
                <p className="text-gray-500">Loading...</p>
            </AppLayout>
        );
    }

    if (!service) {
        return (
            <AppLayout>
                <p className={loadError ? "text-red-600" : "text-gray-500"}>
                    {loadError ?? "Service not found."}
                </p>
            </AppLayout>
        );
    }

    const availableSlots = slots.filter(s => s.status === "available");

    return (
        <AppLayout>
            <Link
                href="/explore"
                className="mb-4 inline-block text-sm text-blue-600 hover:underline"
            >
                ← Back to explore
            </Link>

            <h1 className="mb-1 text-2xl font-bold text-gray-900">
                {service.name}
            </h1>
            <p className="mb-8 text-gray-500">
                Catalog: {service.catalog?.name}
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">
                        Working hours
                    </h2>
                    <ul className="space-y-1">
                        {hours.map(h => (
                            <li key={h.id} className="text-sm text-gray-700">
                                {h.weekDay}: {h.startTime} – {h.endTime}
                            </li>
                        ))}
                        {hours.length === 0 && (
                            <li className="text-sm text-gray-500">
                                No working hours defined.
                            </li>
                        )}
                    </ul>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6">
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">
                        Available slots
                    </h2>
                    <ul className="space-y-2">
                        {availableSlots.map(s => (
                            <li
                                key={s.id}
                                className="flex items-center gap-2 text-sm text-gray-700"
                            >
                                <span>
                                    {s.date} {s.startTime} – {s.endTime}
                                </span>
                                <Badge variant="success">{s.status}</Badge>
                            </li>
                        ))}
                        {availableSlots.length === 0 && (
                            <li className="text-sm text-gray-500">
                                No available slots right now.
                            </li>
                        )}
                    </ul>
                </div>
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Book an appointment
                </h2>
                <form
                    onSubmit={handleBook}
                    className="flex flex-wrap items-end gap-3"
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
                        id="time"
                        name="time"
                        type="time"
                        label="Time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        required
                    />
                    <Button type="submit" disabled={submitting}>
                        {submitting ? "Booking..." : "Book"}
                    </Button>
                </form>

                {error && (
                    <p className="mt-3 text-sm text-red-600">{error}</p>
                )}
                {success && (
                    <p className="mt-3 text-sm text-green-600">
                        {success}
                    </p>
                )}
            </div>
        </AppLayout>
    );
}

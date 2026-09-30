"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppLayout from "@/app/components/layout/AppLayout";
import Badge from "@/app/components/ui/Badge";
import { apiGet } from "@/app/lib/api/client";
import { User } from "@/app/types/types";

interface Appointment {
    id: number;
    userId: number;
    serviceId: number;
    status: string;
    dueDate: string;
    state: boolean;
    service: { id: number; name: string; catalogId: number };
}

export default function MyAppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet<User>("/api/v1/auth/me")
            .then(me => {
                if (!me.ok) {
                    setError(me.message);
                    return null;
                }
                return apiGet<{ appointments: Appointment[] }>(
                    `/api/v1/appointment?userId=${me.data.id}&state=true&limit=100`
                );
            })
            .then(result => {
                if (!result) return;
                if (!result.ok) {
                    setError(result.message);
                    return;
                }
                setAppointments(result.data.appointments);
            })
            .finally(() => setLoading(false));
    }, []);

    const statusVariant = (s: string) =>
        s === "confirmed"
            ? "success"
            : s === "rejected"
                ? "danger"
                : "warning";

    if (loading) {
        return (
            <AppLayout>
                <p className="text-gray-500">Loading...</p>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <h1 className="mb-6 text-2xl font-bold text-gray-900">
                My appointments
            </h1>

            {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <ul className="space-y-3">
                    {appointments.map(a => (
                        <li
                            key={a.id}
                            className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                        >
                            <div>
                                <Link
                                    href={`/services/${a.serviceId}`}
                                    className="font-medium text-gray-900 hover:text-blue-600"
                                >
                                    {a.service?.name ??
                                        `Service #${a.serviceId}`}
                                </Link>
                                <p className="text-sm text-gray-500">
                                    {new Date(a.dueDate).toLocaleString()}
                                </p>
                            </div>
                            <Badge variant={statusVariant(a.status)}>
                                {a.status}
                            </Badge>
                        </li>
                    ))}
                    {appointments.length === 0 && (
                        <li className="text-sm text-gray-500">
                            You have no appointments yet.{" "}
                            <Link
                                href="/explore"
                                className="text-blue-600 hover:underline"
                            >
                                Explore services
                            </Link>
                            .
                        </li>
                    )}
                </ul>
            </div>
        </AppLayout>
    );
}

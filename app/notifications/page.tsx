"use client";

import { useEffect, useState } from "react";

import AppLayout from "@/app/components/layout/AppLayout";
import { apiGet } from "@/app/lib/api/client";
import { User } from "@/app/types/types";

interface Notification {
    id: number;
    createTime: string;
    title: string;
    content: string;
    appointmentId: number;
    state: boolean;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet<User>("/api/v1/auth/me")
            .then(async me => {
                if (!me.ok) {
                    setError(me.message);
                    return;
                }
                // Clients see notifications for their appointments;
                // owners see notifications for their services.
                const [asClient, asOwner] = await Promise.all([
                    apiGet<{ notifications: Notification[] }>(
                        `/api/v1/notification?userId=${me.data.id}&state=true&limit=100`
                    ),
                    apiGet<{ notifications: Notification[] }>(
                        `/api/v1/notification?ownerId=${me.data.id}&state=true&limit=100`
                    )
                ]);

                if (!asClient.ok) {
                    setError(asClient.message);
                    return;
                }
                if (!asOwner.ok) {
                    setError(asOwner.message);
                    return;
                }

                const merged = new Map<number, Notification>();
                for (const n of [
                    ...asClient.data.notifications,
                    ...asOwner.data.notifications
                ]) {
                    merged.set(n.id, n);
                }
                setNotifications(
                    Array.from(merged.values()).sort(
                        (a, b) =>
                            new Date(b.createTime).getTime() -
                            new Date(a.createTime).getTime()
                    )
                );
            })
            .finally(() => setLoading(false));
    }, []);

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
                Notifications
            </h1>

            {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

            <div className="rounded-xl border border-gray-200 bg-white p-6">
                <ul className="space-y-3">
                    {notifications.map(n => (
                        <li
                            key={n.id}
                            className="rounded-md border border-gray-200 p-4"
                        >
                            <p className="font-medium text-gray-900">
                                {n.title}
                            </p>
                            <p className="text-sm text-gray-600">
                                {n.content}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                                {new Date(n.createTime).toLocaleString()}
                            </p>
                        </li>
                    ))}
                    {notifications.length === 0 && (
                        <li className="text-sm text-gray-500">
                            No notifications yet.
                        </li>
                    )}
                </ul>
            </div>
        </AppLayout>
    );
}

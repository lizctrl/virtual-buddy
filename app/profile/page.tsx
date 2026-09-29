"use client";

import { useEffect, useState } from "react";

import AppLayout from "@/app/components/layout/AppLayout";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { User } from "@/app/types/types";

interface Profile {
    id: number;
    createTime: string;
    picture: string;
    userId: number;
    state: boolean;
}

async function apiGet<T>(url: string): Promise<T | null> {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

async function apiPost(
    url: string,
    body: unknown
): Promise<{ ok: boolean; message?: string }> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message };
}

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [picture, setPicture] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet<User>("/api/v1/auth/me").then(async me => {
            setUser(me);
            if (me) {
                const data = await apiGet<{ profiles: Profile[] }>(
                    `/api/v1/profile?userId=${me.id}&state=true&limit=1`
                );
                const p = data?.profiles?.[0] ?? null;
                setProfile(p);
                setPicture(p?.picture ?? "");
            }
        }).finally(() => setLoading(false));
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);
        if (!user) return;
        const r = await apiPost("/api/v1/profile", {
            userId: user.id,
            picture
        });
        if (!r.ok) {
            setMessage(r.message ?? "Could not save profile");
            return;
        }
        setMessage("Profile saved.");
    }

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
                Profile
            </h1>

            <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-4">
                    {profile?.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={profile.picture}
                            alt="Profile"
                            className="h-16 w-16 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                            {user?.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-gray-900">
                            {user?.name} {user?.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                            {user?.email}
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <Input
                        id="picture"
                        name="picture"
                        label="Picture URL"
                        value={picture}
                        onChange={e => setPicture(e.target.value)}
                        placeholder="https://..."
                    />
                    <Button type="submit">Save profile</Button>
                    {message && (
                        <p className="text-sm text-green-600">{message}</p>
                    )}
                </form>
            </div>
        </AppLayout>
    );
}

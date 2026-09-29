"use client";

import { useEffect, useState } from "react";

import AppLayout from "@/app/components/layout/AppLayout";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { apiGet, apiPost } from "@/app/lib/api/client";
import { User } from "@/app/types/types";

interface Profile {
    id: number;
    createTime: string;
    picture: string;
    userId: number;
    state: boolean;
}

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [picture, setPicture] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet<User>("/api/v1/auth/me")
            .then(async me => {
                if (!me.ok) {
                    setError(me.message);
                    return;
                }
                setUser(me.data);

                const result = await apiGet<{ profiles: Profile[] }>(
                    `/api/v1/profile?userId=${me.data.id}&state=true&limit=1`
                );
                if (!result.ok) {
                    setError(result.message);
                    return;
                }
                const p = result.data.profiles?.[0] ?? null;
                setProfile(p);
                setPicture(p?.picture ?? "");
            })
            .finally(() => setLoading(false));
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setMessage(null);
        setSaveError(null);
        if (!user) return;
        const r = await apiPost("/api/v1/profile", {
            userId: user.id,
            picture
        });
        if (!r.ok) {
            setSaveError(r.message || "Could not save profile");
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

            {error && (
                <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

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
                    {saveError && (
                        <p className="text-sm text-red-600">
                            {saveError}
                        </p>
                    )}
                </form>
            </div>
        </AppLayout>
    );
}

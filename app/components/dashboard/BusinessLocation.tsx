"use client";

import { useState, type FormEvent } from "react";
import Select from "@/app/components/ui/Select";
import { apiPatch } from "@/app/lib/api/client";
import { businessLocation, provinces } from "@/app/lib/costa-rica-locations";
import { panelPrimary } from "./panel-styles";

export function LocationFields({ initialCode = null }: { initialCode?: number | null }) {
    const location = businessLocation(initialCode);
    const [provinceCode, setProvinceCode] = useState<number>(location?.provinceCode ?? 0);
    const [cantonCode, setCantonCode] = useState<number>(location?.cantonCode ?? 0);
    const province = provinces.find(item => item.code === provinceCode);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <Select id="business-province" label="Provincia" value={provinceCode}
                onChange={event => { setProvinceCode(Number(event.target.value)); setCantonCode(0); }}
                options={[{ label: "Sin ubicación", value: 0 }, ...provinces.map(item => ({ label: item.name, value: item.code }))]}
                className="min-w-0 w-full bg-white text-sm" />
            <Select id="business-canton" name="cantonCode" label="Cantón" value={cantonCode || ""}
                disabled={!province} required={!!province} onChange={event => setCantonCode(Number(event.target.value))}
                options={[{ label: "Selecciona un cantón", value: "" }, ...(province?.cantons ?? []).map(([value, label]) => ({ value, label }))]}
                className="min-w-0 w-full bg-white text-sm disabled:bg-slate-100" />
        </div>
    );
}

export default function BusinessLocation({ businessId, cantonCode, onSave }: {
    businessId: number;
    cantonCode: number | null;
    onSave: (code: number | null) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        const code = Number(new FormData(event.currentTarget).get("cantonCode")) || null;
        setSaving(true);
        setError("");
        setNotice("");
        const result = await apiPatch<{ cantonCode: number | null }>(`/api/v1/business/${businessId}`, { cantonCode: code });
        setSaving(false);
        if (result.ok) {
            onSave(result.data.cantonCode);
            setNotice("Ubicación guardada.");
        } else setError(result.message);
    }

    return (
        <section className="rounded-2xl border border-indigo-100 bg-[#f5f4fb] p-4 sm:p-5">
            <form onSubmit={save} className="max-w-2xl space-y-4 rounded-xl border border-indigo-100 bg-white p-4 sm:p-5">
                <div>
                    <h2 className="font-bold text-slate-900">Ubicación del negocio</h2>
                    <p className="mt-1 text-sm text-slate-600">Publica la provincia y el cantón donde atiendes para que te encuentren en Explorar.</p>
                </div>
                <fieldset disabled={saving}><LocationFields initialCode={cantonCode} /></fieldset>
                <button type="submit" className={panelPrimary} disabled={saving}>{saving ? "Guardando…" : "Guardar ubicación"}</button>
                {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
                {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
            </form>
        </section>
    );
}

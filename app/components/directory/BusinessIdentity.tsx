const palettes = [
    { cover: "bg-indigo-100 text-indigo-800", badge: "bg-indigo-700 text-white" },
    { cover: "bg-teal-100 text-teal-900", badge: "bg-teal-800 text-white" },
    { cover: "bg-fuchsia-100 text-fuchsia-900", badge: "bg-fuchsia-800 text-white" },
    { cover: "bg-amber-100 text-amber-950", badge: "bg-amber-800 text-white" }
];

export default function BusinessIdentity({ id, name, cover = false }: { id: number; name: string; cover?: boolean }) {
    const palette = palettes[id % palettes.length];
    const initials = name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? "").join("").toLocaleUpperCase("es-CR");
    const badge = (
        <span aria-hidden="true" className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-wide ${palette.badge}`}>
            {initials || "•"}
        </span>
    );
    if (!cover) return badge;
    return (
        <div className={`relative flex h-24 items-center overflow-hidden px-5 ${palette.cover}`}>
            <svg aria-hidden="true" viewBox="0 0 220 96" className="absolute inset-y-0 right-0 h-full opacity-25" fill="none" stroke="currentColor">
                <path d="M83 96V57a36 36 0 0 1 72 0v39m-58 0V57a22 22 0 0 1 44 0v39m-30 0V57a8 8 0 0 1 16 0v39M168 0v25a36 36 0 0 0 36 36h16M182 0v25a22 22 0 0 0 22 22h16M196 0v25a8 8 0 0 0 8 8h16" strokeWidth="2" />
                <circle cx="58" cy="27" r="8" /><path d="M17 66h16m-8-8v16m163 8h16m-8-8v16" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {badge}
        </div>
    );
}

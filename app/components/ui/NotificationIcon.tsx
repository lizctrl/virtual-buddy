export type NotificationKind = "bell" | "booking" | "confirmed" | "cancelled" | "updated";

const paths: Record<NotificationKind, string> = {
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
    booking: "M7 3v4m10-4v4M4 10h16M8 15h4m-2-2v4",
    confirmed: "m5 12 4 4L19 6",
    cancelled: "m7 7 10 10M17 7 7 17",
    updated: "M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3"
};

export default function NotificationIcon({ kind = "bell", className = "size-5" }: {
    kind?: NotificationKind;
    className?: string;
}) {
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {kind === "booking" && <rect x="4" y="5" width="16" height="15" rx="3" />}
            <path d={paths[kind]} />
        </svg>
    );
}

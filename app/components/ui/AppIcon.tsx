import NotificationIcon from "./NotificationIcon";

const paths = {
    panel: "M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v5H3zM14 15h7v5h-7z",
    explore: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-2.5 5.5L8 16l2.5-5.5L16 8Z",
    calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2-2v4m10-4v4M3 10h18m-13 5h2m4 0h2",
    profile: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2",
    logout: "M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m5-4 4-4-4-4m-6 4h10",
    login: "M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5m-7-4 4-4-4-4m-4 4h8"
};

export type AppIconName = keyof typeof paths | "notifications";

export default function AppIcon({ name, className = "size-5" }: { name: AppIconName; className?: string }) {
    if (name === "notifications") return <NotificationIcon className={className} />;
    return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d={paths[name]} />
        </svg>
    );
}

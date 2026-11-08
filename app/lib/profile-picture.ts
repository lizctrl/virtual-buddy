export function parseProfilePicture(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const picture = value.trim();
    if (!picture) return "";

    try {
        const url = new URL(picture);
        return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
            ? picture
            : null;
    } catch {
        return null;
    }
}

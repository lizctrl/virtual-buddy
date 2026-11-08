export async function sendBookingConfirmation(
    id: number,
    recipients: string[],
    text: string
): Promise<"accepted" | "unconfigured" | "failed"> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.BOOKING_EMAIL_FROM;
    if (!key || !from) return "unconfigured";

    const messages = [...new Set(recipients)].map(email => ({
        from,
        to: [email],
        subject: `Cita confirmada · Reserva #${id}`,
        text
    }));

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await fetch("https://api.resend.com/emails/batch", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                    "Idempotency-Key": `booking-confirmation/${id}`
                },
                body: JSON.stringify(messages),
                signal: AbortSignal.timeout(3500)
            });
            if (result.ok) return "accepted";
            console.error("Booking email rejected", { id, status: result.status });
            if (result.status < 500) break;
        } catch {
            console.error("Booking email request failed", { id });
        }
    }
    return "failed";
}

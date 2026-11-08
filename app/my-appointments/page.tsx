import AppLayout from "@/app/components/layout/AppLayout";
import AppointmentCalendar from "@/app/components/dashboard/AppointmentCalendar";

export default function MyAppointmentsPage() {
    return (
        <AppLayout>
            <AppointmentCalendar mode="personal" />
        </AppLayout>
    );
}

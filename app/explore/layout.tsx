import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Explorar negocios",
    description: "Busca negocios activos en Costa Rica, mira sus servicios y reserva una cita en línea.",
    alternates: { canonical: "/explore" }
};

export default function ExploreLayout({ children }: LayoutProps<"/explore">) {
    return children;
}

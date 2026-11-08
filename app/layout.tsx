import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteUrl } from "./lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Encuentra negocios de Costa Rica y agenda tu cita en línea. Para negocios: agenda, servicios y horarios en un solo lugar.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Virtual Buddy",
  title: { default: "Virtual Buddy · Agenda citas en Costa Rica", template: "%s · Virtual Buddy" },
  description,
  openGraph: {
    type: "website",
    locale: "es_CR",
    siteName: "Virtual Buddy",
    title: "Virtual Buddy · Agenda citas en Costa Rica",
    description,
  },
  twitter: { card: "summary_large_image", title: "Virtual Buddy · Agenda citas en Costa Rica", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { ServiceWorkerRegistration } from "@/components/layout/service-worker-registration";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Habitat Docházka",
    template: "%s | Habitat Docházka",
  },
  description: "Systém docházky a omluvenek pro Habitat Zbraslav",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Habitat Docházka",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#D4A84B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" style={{ backgroundColor: "#FDF8F3" }}>
      <body
        style={{ backgroundColor: "#FDF8F3" }}
        className={`${nunito.variable} ${geistMono.variable} antialiased min-h-screen bg-cream`}
      >
        <AuthKitProvider>
          <ServiceWorkerRegistration />
          {children}
        </AuthKitProvider>
      </body>
    </html>
  );
}

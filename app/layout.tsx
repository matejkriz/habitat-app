import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import { Nunito, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { getIosStartupImage, IOS_STARTUP_IMAGE_SCRIPT, IOS_STARTUP_PROFILE_COOKIE } from "@/app/pwa-startup-images";
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
  // iOS launch images still require the Apple tag; Next emits only the generic one.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#D4A84B",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const startupImage = getIosStartupImage(
    cookieStore.get(IOS_STARTUP_PROFILE_COOKIE)?.value,
  );
  return (
    <html lang="cs" style={{ backgroundColor: "#FDF8F3" }}>
      <head>
        {startupImage && (
          <link rel="apple-touch-startup-image" href={startupImage.url} />
        )}
      </head>
      <Script id="habitat-ios-startup-selection" strategy="beforeInteractive">
        {IOS_STARTUP_IMAGE_SCRIPT}
      </Script>
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

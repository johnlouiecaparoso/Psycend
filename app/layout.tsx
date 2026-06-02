import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope } from "next/font/google";
import "./globals.css";
import { OfflineSupport } from "@/components/offline-support";
import { PwaRegistrar } from "@/components/pwa-registrar";
import { AuthProvider } from "@/lib/auth-context";
import { APP_NAME } from "@/lib/constants";

const manrope = Manrope({
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Modern board exam review platform for psychology students and admins.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#21a692"
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.className}>
        <AuthProvider>
          <PwaRegistrar />
          <OfflineSupport />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

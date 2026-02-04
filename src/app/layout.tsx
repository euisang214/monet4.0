import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DevLinkProvider } from "@/devlink/DevLinkProvider";
import { SessionProvider } from "next-auth/react";
import { AuthNavbar } from "@/components/layout/AuthNavbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monet - Professional Networking",
  description: "Connect with professionals for mock interviews and career advice",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SessionProvider>
          <DevLinkProvider>
            <AuthNavbar />
            {children}
          </DevLinkProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { DevLinkProvider } from "@/devlink/DevLinkProvider";
import { SessionProvider } from "next-auth/react";
import { AuthNavbar } from "@/components/layout/AuthNavbar";

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const displayFont = Space_Grotesk({
  variable: "--font-display",
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
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
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

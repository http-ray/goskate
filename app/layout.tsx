import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Set NEXT_PUBLIC_SITE_URL to your production domain in Vercel so
// absolute OG/canonical URLs resolve correctly. Falls back to localhost
// in development.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GoSkate — Find & Share Skate Spots",
  description:
    "Discover skateparks and street spots near you, add your own, follow other skaters, and share your clips — all on one map.",
  applicationName: "GoSkate",
  openGraph: {
    title: "GoSkate — Find & Share Skate Spots",
    description:
      "Discover skateparks and street spots near you, add your own, follow other skaters, and share your clips — all on one map.",
    url: siteUrl,
    siteName: "GoSkate",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GoSkate — Find & Share Skate Spots",
    description:
      "Discover skateparks and street spots near you. The map built for skaters.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-base text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

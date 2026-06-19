import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Blue Bomber OS",
  description: "Operations command center for Blue Bomber Logistics",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    title: "Blue Bomber OS",
    description: "Operations command center for Blue Bomber Logistics",
    images: [
      {
        url: "/blue-bomber-og.png",
        width: 1200,
        height: 630,
        alt: "Blue Bomber Logistics"
      }
    ]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

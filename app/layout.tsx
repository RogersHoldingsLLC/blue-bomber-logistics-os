import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue Bomber Logistics OS",
  description: "Task-first operating system for Blue Bomber Logistics"
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

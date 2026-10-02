import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE-END Control Plane",
  description:
    "Private operational dashboard and deterministic compiler for standalone EIP-1193 transaction clients.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE-END Operator Console",
  description: "Private dashboard for compiling standalone backend-routed EIP-712 transaction clients.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

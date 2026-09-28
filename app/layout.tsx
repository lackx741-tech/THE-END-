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
    </html>
  );
}

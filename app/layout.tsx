import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE-END- Operator Console",
  description: "Private dashboard for compiling standalone backend-routed EIP-712 transaction clients.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

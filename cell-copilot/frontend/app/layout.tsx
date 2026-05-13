import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cell Co-Pilot | Northgate Insurance",
  description: "AI-powered broker workstation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased font-sans">{children}</body>
    </html>
  );
}

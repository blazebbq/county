import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jewellery Design Studio",
  description: "Design your perfect custom ring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-stone-950 text-stone-100 min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}

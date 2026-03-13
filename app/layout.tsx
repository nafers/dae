import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DAE — Does Anyone Else",
  description: "Discover you're not alone in the things you think and do.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-stone-50 text-stone-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}

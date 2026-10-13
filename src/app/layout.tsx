import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { env } from "~/env";

// Read the deployment's theme at request time, including with a prebuilt Docker image.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gift Card Manager",
  description: "Manage your gift cards by category",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme={env.APP_THEME ?? "default"} className={`${geist.variable}`}>
      <body className="bg-canvas text-foreground">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}

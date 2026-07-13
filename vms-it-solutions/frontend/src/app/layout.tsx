import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { publicGet } from "@/lib/api";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

interface BrandingLogo { kind: string; url: string }

// Favicon and social-share image are admin-controlled via Branding settings; this re-resolves
// on the same revalidate window as the rest of the public site (see app/page.tsx).
export async function generateMetadata(): Promise<Metadata> {
  const branding = await publicGet<{ logos: BrandingLogo[] }>("/settings/branding", { logos: [] }, 60);
  const favicon = branding.logos.find((l) => l.kind === "favicon")?.url;
  const ogImage = branding.logos.find((l) => l.kind === "og_image")?.url;

  return {
    title: {
      default: "VMS IT Solutions — ERP Consulting for Manufacturers & Distributors",
      template: "%s · VMS IT Solutions",
    },
    description:
      "ERPNext and SAP Business One implementation, customisation and managed support for mid-market manufacturing and distribution companies in India.",
    icons: favicon ? { icon: favicon } : undefined,
    openGraph: {
      title: "VMS IT Solutions",
      description: "ERP consulting that ships. ERPNext & SAP Business One implementations in 8–16 weeks.",
      type: "website",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('theme')==='light'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* strategy="beforeInteractive" guarantees this runs before hydration/paint — a plain
            <script> JSX tag is not reliably synchronous under React 19's resource hoisting. */}
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script>
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable} bg-paper text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}

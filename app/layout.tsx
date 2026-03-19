import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Dashboard de Entrenamientos",
  description: "Visualiza y analiza tus entrenamientos del Polar RCX5",
};

const themeInitScript = `
(function(){
  var t=localStorage.getItem("theme");
  var d=window.matchMedia("(prefers-color-scheme: dark)").matches;
  var isDark=t==="dark"||(!t&&d);
  document.documentElement.classList.toggle("dark",!!isDark);
})();
`;

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: Promise<Record<string, string | string[]>>;
}) {
  if (params) await params;
  return (
    <html lang="es" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <div className="relative min-h-screen">{children}</div>
      </body>
    </html>
  );
}

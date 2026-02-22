import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
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

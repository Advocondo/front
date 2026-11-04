import type { Metadata } from "next";
import { Cinzel, JetBrains_Mono, Playfair_Display, Poppins } from "next/font/google";
import "edson-alexandre-design-system/styles.css";
import "./globals.css";

// As fontes do design system. O @import do ui-kit não chega ao navegador porque, no CSS
// final do Next, ele não fica no início do arquivo. Ver globals.css.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Advocondo",
  description: "Gestão de acordos extrajudiciais para condomínios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${playfair.variable} ${cinzel.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

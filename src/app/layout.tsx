import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import ServiceWorker from "@/components/ServiceWorker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Collabbs — La plateforme qui connecte créateurs & marques",
  description:
    "Collabbs est la marketplace 100% française qui connecte créateurs et marques. Affiliation 1 clic, deals vidéo, contrats automatiques, paiement sécurisé.",
  // iOS ne lit pas le manifeste : sans ces deux blocs, l'icône ajoutée à
  // l'écran d'accueil serait une capture de la page et l'application
  // s'ouvrirait dans Safari, barre d'adresse comprise.
  appleWebApp: {
    capable: true,
    title: "Collabbs",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  // Pas de `viewport-fit: cover` : il ferait passer le contenu SOUS l'encoche
  // de l'iPhone, et aucune page ne gère aujourd'hui les marges de sécurité.
  // Par défaut, iOS insère l'application sous la barre d'état — moins joli,
  // mais rien n'est masqué.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}

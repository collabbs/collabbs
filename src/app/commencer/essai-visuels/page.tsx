import type { Metadata } from "next";
import Banc from "./Banc";

/** Outil de travail : à retirer une fois la couverture jugée suffisante. */
export const metadata: Metadata = {
  title: "Banc d'essai des visuels — Collabbs",
  robots: { index: false, follow: false },
};

export default function PageBanc() {
  return (
    <div className="min-h-dvh bg-[#FCFAFB]">
      <Banc />
    </div>
  );
}

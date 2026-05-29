import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-display text-6xl font-black text-zinc-200">404</p>
      <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-ink">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-sm text-zinc-500">
        Cette page n&apos;existe pas ou n&apos;est plus disponible. Elle a peut-être été
        déplacée ou supprimée.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}

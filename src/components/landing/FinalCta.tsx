import Link from "next/link";

export default function FinalCta() {
  return (
    <section className="px-6 py-20 sm:px-8 lg:px-12">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_45%,#ec4899_100%)] px-8 py-16 text-center sm:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <h2 className="font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
          Lancez votre première collaboration
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          Trouvez le créateur idéal ou recevez vos premières opportunités — en
          quelques minutes, sans engagement.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/creators"
            className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-ink transition hover:bg-zinc-100"
          >
            Trouver un créateur
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20"
          >
            Devenir créateur — gratuit
          </Link>
        </div>
      </div>
    </section>
  );
}

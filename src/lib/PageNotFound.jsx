import { Activity, ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-emerald-300/15 blur-3xl dark:bg-emerald-700/10" />
        <svg className="h-full w-full opacity-[0.055] dark:opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="map-grid" width="88" height="88" patternUnits="userSpaceOnUse">
              <path d="M0 22h88M22 0v88M66 0v88M0 66h88" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M0 44h35l18-18h35M44 0v34l20 20v34" fill="none" stroke="currentColor" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />
        </svg>
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-border/70 bg-card/85 px-6 py-8 text-center shadow-2xl shadow-emerald-950/10 backdrop-blur-xl sm:px-12 sm:py-12">
          <div className="mb-7 flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-px w-10 bg-border" />
            Error 404
            <span className="h-px w-10 bg-border" />
          </div>

          <div className="group relative mx-auto w-full max-w-md">
            <div className="absolute -inset-3 rotate-2 rounded-[1.75rem] bg-primary/10 transition-transform duration-500 group-hover:rotate-3" aria-hidden="true" />
            <div className="relative -rotate-1 overflow-hidden rounded-2xl border border-border/80 bg-white p-2 shadow-xl transition-transform duration-500 group-hover:rotate-0 group-hover:scale-[1.01] dark:bg-slate-100">
              <img
                src="/spotfinder-404.png"
                alt="Three stick figures confused by a 404 sign"
                className="h-auto w-full rounded-xl object-contain"
              />
            </div>
            <span className="absolute -right-3 -top-4 grid h-14 w-14 rotate-6 place-items-center rounded-2xl border border-white/70 bg-white/95 text-3xl shadow-lg dark:border-white/10 dark:bg-slate-900" role="img" aria-label="Broken heart">
              💔
            </span>
          </div>

          <div className="mx-auto mt-9 max-w-xl">
            <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
              This spot doesn&apos;t exist.
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              We searched the whole map, but this page is nowhere to be found.
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground/70">
              here isnt anything special bro
            </p>

            <div className="mx-auto mt-5 w-fit max-w-full rounded-full border border-border bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground">
              <span className="break-all">{location.pathname || '/unknown-location'}</span>
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to map
              </Link>
              <Link
                to="/Status"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Activity className="h-4 w-4 text-primary" />
                View status
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

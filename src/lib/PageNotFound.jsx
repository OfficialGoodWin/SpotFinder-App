import { ArrowLeft, Home, MapPin } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();

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

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl md:grid-cols-[0.95fr_1.05fr]">
          <div className="relative flex min-h-[310px] items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500 to-green-700 p-8 sm:min-h-[370px]">
            <div className="absolute inset-0 opacity-20" aria-hidden="true">
              <svg className="h-full w-full" viewBox="0 0 500 500" fill="none">
                <path d="M-40 120C65 73 142 166 232 117s172-68 310-25M-30 355c92-66 191-33 262 11s177 24 297-53M109-30c-7 89 68 122 39 211S75 330 117 540M390-20c-68 97-23 157 32 220s31 181-24 320" stroke="white" strokeWidth="3" />
                <circle cx="148" cy="181" r="7" fill="white" />
                <circle cx="421" cy="200" r="7" fill="white" />
                <circle cx="232" cy="366" r="7" fill="white" />
              </svg>
            </div>

            <div className="relative text-center text-white">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/30 bg-white/15 shadow-xl backdrop-blur-sm sm:h-28 sm:w-28">
                <MapPin className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={1.7} />
              </div>
              <div className="text-[5.5rem] font-black leading-none tracking-[-0.08em] drop-shadow-sm sm:text-8xl">
                404
              </div>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-50/90">
                Lost coordinates
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Off the map
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Nothing to spot here.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
              The page you’re looking for wandered off the map or never existed.
            </p>
            <p className="mt-2 text-sm font-medium text-foreground/75">
              here isnt anything special bro
            </p>

            <div className="mt-6 max-w-full overflow-hidden rounded-xl border border-border bg-muted/40 px-4 py-3 font-mono text-xs text-muted-foreground">
              <span className="mr-2 text-primary">/</span>
              <span className="break-all">{location.pathname.slice(1) || 'unknown-location'}</span>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Home className="h-4 w-4" />
                Back to the map
              </Link>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

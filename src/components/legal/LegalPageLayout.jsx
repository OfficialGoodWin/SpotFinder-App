import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LegalPageLayout({ title, lastUpdated, children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-white dark:bg-background">
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-background/95 backdrop-blur-sm border-b border-gray-100 dark:border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-accent flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-foreground">{title}</h1>
      </div>
      <div className="max-w-2xl mx-auto px-5 py-6 pb-16">
        {lastUpdated && (
          <p className="text-xs text-gray-400 dark:text-muted-foreground mb-6">Last updated: {lastUpdated}</p>
        )}
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// Small manually-styled content helpers (no Tailwind typography plugin is
// installed in this project, so we style headings/paragraphs/lists
// explicitly instead of relying on `prose` classes).
export function LegalH2({ children }) {
  return <h2 className="text-base font-bold text-gray-900 dark:text-foreground mt-6 mb-2">{children}</h2>;
}
export function LegalP({ children }) {
  return <p className="text-sm text-gray-700 dark:text-muted-foreground leading-relaxed">{children}</p>;
}
export function LegalUl({ children }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-700 dark:text-muted-foreground leading-relaxed">{children}</ul>;
}
export function LegalStrong({ children }) {
  return <strong className="font-semibold text-gray-900 dark:text-foreground">{children}</strong>;
}
export function LegalNote({ children }) {
  return (
    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
      {children}
    </div>
  );
}

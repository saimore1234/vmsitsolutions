"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Next.js only renders this for errors thrown by the root layout itself (outside every route
// group's own error.tsx), so it must render a full <html>/<body> — there's no parent layout left.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">Please try again, or head back to the homepage.</p>
          <button onClick={() => reset()} className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

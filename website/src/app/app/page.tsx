"use client";

import { useEffect } from "react";

export default function AppRootRedirect() {
  useEffect(() => {
    window.location.replace("/fr/app/");
  }, []);
  return (
    <main className="grid min-h-screen place-items-center bg-ink text-ivory">
      <p className="font-display text-2xl">PagneMarket…</p>
    </main>
  );
}

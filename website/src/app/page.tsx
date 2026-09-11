"use client";

import { useEffect } from "react";

export default function RootPage() {
  useEffect(() => {
    window.location.replace("/fr/");
  }, []);
  return (
    <main className="grid min-h-screen place-items-center bg-ivory text-ink">
      <p className="font-display text-2xl">PagneMarket…</p>
    </main>
  );
}

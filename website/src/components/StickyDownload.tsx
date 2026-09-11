"use client";

import { TrackLink } from "@/components/Cta";
import type { Dictionary } from "@/lib/content";

export function StickyDownload({ t }: { t: Dictionary }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-sand bg-ivory/95 p-3 backdrop-blur-md md:hidden">
      <TrackLink
        event="app_download_click"
        className="flex w-full items-center justify-center rounded-full bg-ink py-3.5 text-sm font-medium text-ivory"
      >
        {t.sticky.download}
      </TrackLink>
    </div>
  );
}

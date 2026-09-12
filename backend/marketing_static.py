"""Serve the marketing site from /public when Vercel routes all traffic to FastAPI."""
from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, RedirectResponse, Response

PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

# Paths that belong to the marketing site (never rewrite to /api/…)
STATIC_EXACT = {
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/file.svg",
    "/globe.svg",
    "/next.svg",
    "/vercel.svg",
    "/window.svg",
}

STATIC_PREFIXES = (
    "/fr",
    "/en",
    "/app",
    "/_next",
    "/404",
)


def is_marketing_path(path: str) -> bool:
    if path in STATIC_EXACT:
        return True
    if path == "/":
        return True
    return any(path == p or path.startswith(p + "/") for p in STATIC_PREFIXES)


def _safe_join(root: Path, rel: str) -> Path | None:
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    return candidate


def resolve_public_file(path: str) -> Path | None:
    if not PUBLIC_DIR.exists():
        return None
    rel = path.lstrip("/")
    if not rel:
        return None

    direct = _safe_join(PUBLIC_DIR, rel)
    if direct and direct.is_file():
        return direct

    as_index = _safe_join(PUBLIC_DIR, f"{rel.rstrip('/')}/index.html")
    if as_index and as_index.is_file():
        return as_index

    # Clean URLs without trailing slash → folder/index.html
    if not rel.endswith(".html"):
        nested = _safe_join(PUBLIC_DIR, f"{rel}/index.html")
        if nested and nested.is_file():
            return nested

    return None


async def maybe_serve_marketing(request: Request) -> Response | None:
    if request.method not in ("GET", "HEAD"):
        return None
    path = request.scope.get("path") or ""
    if not is_marketing_path(path):
        return None

    if path == "/":
        return RedirectResponse(url="/fr/", status_code=307)

    if path == "/app":
        return RedirectResponse(url="/fr/app/", status_code=307)

    file_path = resolve_public_file(path)
    if not file_path:
        # SPA-ish fallback for locale home
        if path in ("/fr", "/en", "/app", "/fr/app", "/en/app"):
            return RedirectResponse(url=path.rstrip("/") + "/", status_code=307)
        not_found = resolve_public_file("/404.html") or resolve_public_file("/404")
        if not_found:
            return FileResponse(not_found, status_code=404)
        return None

    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type)

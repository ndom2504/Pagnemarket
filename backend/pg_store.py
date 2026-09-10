"""Mongo-like async store on Neon / Vercel Postgres (JSONB)."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import asyncpg

DATE_KEYS = {"createdAt", "updatedAt", "lastViewedAt", "at"}


def normalize_dsn(url: str) -> str:
    u = (url or "").strip().replace("postgres://", "postgresql://", 1)
    parsed = urlparse(u)
    q = parse_qs(parsed.query)
    q.pop("channel_binding", None)
    if "sslmode" not in q:
        q["sslmode"] = ["require"]
    return urlunparse(parsed._replace(query=urlencode(q, doseq=True)))


def _json_default(o):
    if isinstance(o, datetime):
        if o.tzinfo is None:
            o = o.replace(tzinfo=timezone.utc)
        return o.isoformat()
    return str(o)


def dump(doc: dict) -> str:
    return json.dumps(doc, default=_json_default)


def _revive(key: str, value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _revive(k, v) for k, v in value.items()}
    if isinstance(value, list):
        return [_revive("at" if key in DATE_KEYS else key, v) for v in value]
    if (key in DATE_KEYS or key.endswith("At")) and isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    return value


def hydrate(data: Any) -> dict:
    if not isinstance(data, dict):
        data = json.loads(data) if isinstance(data, str) else {}
    doc = {k: _revive(k, v) for k, v in data.items()}
    if "id" in doc and "_id" not in doc:
        doc["_id"] = doc["id"]
    return doc


def _get(doc: dict, key: str):
    if key == "_id":
        return doc.get("_id") or doc.get("id")
    return doc.get(key)


def matches(doc: dict, query: Optional[dict]) -> bool:
    if not query:
        return True
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(doc, q) for q in expected):
                return False
            continue
        actual = _get(doc, key)
        if isinstance(expected, dict) and any(str(k).startswith("$") for k in expected):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$nin" in expected and actual in expected["$nin"]:
                return False
            if "$lt" in expected:
                if actual is None or actual >= expected["$lt"]:
                    return False
            if "$exists" in expected:
                exists = key in doc or (key == "_id" and ("id" in doc or "_id" in doc))
                if bool(expected["$exists"]) != exists:
                    return False
            if "$regex" in expected:
                flags = re.I if "i" in (expected.get("$options") or "") else 0
                pattern = expected["$regex"]
                if isinstance(actual, list):
                    if not any(re.search(pattern, str(x), flags) for x in actual):
                        return False
                elif not re.search(pattern, str(actual or ""), flags):
                    return False
            continue
        if isinstance(actual, list) and not isinstance(expected, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


def apply_update(doc: dict, update: dict) -> dict:
    out = dict(doc)
    if "$set" in update:
        for k, v in update["$set"].items():
            if k.endswith(".$"):
                field = k[:-2]
                arr = list(out.get(field) or [])
                out[field] = ["supplier" if x == "vendor" else x for x in arr]
            else:
                out[k] = v
    if "$inc" in update:
        for k, v in update["$inc"].items():
            out[k] = (out.get(k) or 0) + v
    if "$push" in update:
        for k, v in update["$push"].items():
            arr = list(out.get(k) or [])
            arr.append(v)
            out[k] = arr
    if "$rename" in update:
        for old, new in update["$rename"].items():
            if old in out:
                out[new] = out.pop(old)
    if not any(k.startswith("$") for k in update):
        out.update(update)
    if "id" in out and "_id" not in out:
        out["_id"] = out["id"]
    return out


def project(doc: dict, proj: Optional[dict]) -> dict:
    if not proj:
        out = dict(doc)
        out.pop("_id", None)
        return out
    inclusions = {k: v for k, v in proj.items() if k != "_id" and v}
    out = dict(doc)
    if inclusions:
        out = {k: doc[k] for k in inclusions if k in doc}
    if proj.get("_id", 0) == 0:
        out.pop("_id", None)
    return out


def _sort_key(doc: dict, field: str):
    val = doc.get(field)
    if val is None:
        return (1, "")
    if isinstance(val, datetime):
        return (0, val.isoformat())
    return (0, val)


class UpdateResult:
    def __init__(self, matched: int, modified: int = 0):
        self.matched_count = matched
        self.modified_count = modified


class DeleteResult:
    def __init__(self, deleted: int):
        self.deleted_count = deleted


class PgCursor:
    def __init__(self, store: "PgDatabase", coll: str, query: dict, proj: Optional[dict]):
        self.store = store
        self.coll = coll
        self.query = query or {}
        self.proj = proj
        self._sort = None
        self._limit = None

    def sort(self, field: str, direction: int = 1):
        self._sort = (field, direction)
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    async def _rows(self) -> list[dict]:
        items = [d for d in await self.store._load(self.coll) if matches(d, self.query)]
        if self._sort:
            field, direction = self._sort
            items.sort(key=lambda d: _sort_key(d, field), reverse=direction < 0)
        if self._limit is not None:
            items = items[: self._limit]
        return [project(d, self.proj) for d in items]

    async def to_list(self, n: int):
        self._limit = n if self._limit is None else min(self._limit, n)
        return await self._rows()

    def __aiter__(self):
        return self._iter()

    async def _iter(self):
        for item in await self._rows():
            yield item


class PgCollection:
    def __init__(self, store: "PgDatabase", name: str):
        self.store = store
        self.name = name

    def find(self, query: Optional[dict] = None, proj: Optional[dict] = None):
        return PgCursor(self.store, self.name, query or {}, proj)

    async def find_one(self, query: Optional[dict] = None, proj: Optional[dict] = None):
        items = await self.find(query, proj).limit(1).to_list(1)
        return items[0] if items else None

    async def count_documents(self, query: Optional[dict] = None):
        return len([d for d in await self.store._load(self.name) if matches(d, query or {})])

    async def insert_one(self, doc: dict):
        data = dict(doc)
        doc_id = str(data.get("id") or data.get("_id") or uuid.uuid4())
        data["id"] = doc_id
        data["_id"] = doc_id
        await self.store._upsert(self.name, doc_id, data)
        doc["_id"] = doc_id
        doc["id"] = data.get("id", doc_id)
        return SimpleNamespace(inserted_id=doc_id)

    async def insert_many(self, docs: list):
        for d in docs:
            await self.insert_one(d)
        return SimpleNamespace(inserted_ids=[d.get("id") for d in docs])

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        items = [d for d in await self.store._load(self.name) if matches(d, query)]
        if not items:
            if not upsert:
                return UpdateResult(0, 0)
            created = apply_update({k: v for k, v in query.items() if not str(k).startswith("$")}, update)
            await self.insert_one(created)
            return UpdateResult(1, 1)
        doc = apply_update(items[0], update)
        await self.store._upsert(self.name, str(doc.get("id") or doc.get("_id")), doc)
        return UpdateResult(1, 1)

    async def update_many(self, query: dict, update: dict):
        items = [d for d in await self.store._load(self.name) if matches(d, query)]
        for doc in items:
            await self.store._upsert(self.name, str(doc.get("id") or doc.get("_id")), apply_update(doc, update))
        return UpdateResult(len(items), len(items))

    async def delete_one(self, query: dict):
        items = [d for d in await self.store._load(self.name) if matches(d, query)]
        if not items:
            return DeleteResult(0)
        doc_id = str(items[0].get("id") or items[0].get("_id"))
        await self.store.pool.execute("DELETE FROM docs WHERE coll=$1 AND id=$2", self.name, doc_id)
        return DeleteResult(1)


class PgDatabase:
    def __init__(self, dsn: str):
        self.dsn = normalize_dsn(dsn)
        self.pool: Optional[asyncpg.Pool] = None

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        return PgCollection(self, name)

    async def ready(self):
        if self.pool:
            return
        self.pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=6, command_timeout=30)
        await self.pool.execute(
            """
            CREATE TABLE IF NOT EXISTS docs (
                coll TEXT NOT NULL,
                id TEXT NOT NULL,
                data JSONB NOT NULL,
                PRIMARY KEY (coll, id)
            )
            """
        )

    async def _load(self, coll: str) -> list[dict]:
        await self.ready()
        rows = await self.pool.fetch("SELECT data FROM docs WHERE coll=$1", coll)
        out = []
        for row in rows:
            raw = row["data"]
            out.append(hydrate(raw if isinstance(raw, dict) else json.loads(raw)))
        return out

    async def _upsert(self, coll: str, doc_id: str, doc: dict):
        await self.ready()
        payload = dict(doc)
        payload["id"] = doc_id
        await self.pool.execute(
            """
            INSERT INTO docs (coll, id, data) VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (coll, id) DO UPDATE SET data = EXCLUDED.data
            """,
            coll,
            doc_id,
            dump(payload),
        )

    def close(self):
        pass

    async def aclose(self):
        if self.pool:
            await self.pool.close()
            self.pool = None

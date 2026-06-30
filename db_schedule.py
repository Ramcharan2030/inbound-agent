from __future__ import annotations

import logging
import os
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger("db-schedule")

_IST = timezone(timedelta(hours=5, minutes=30))

_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

# Default schedule used when DB is not available (9-1, 4-7 Mon-Fri; 9-1 Sat; closed Sun)
_DEFAULT_SCHEDULE = [
    {"day_of_week": 0, "day_name": "Monday",    "morning_start": "09:00", "morning_end": "13:00", "afternoon_start": "16:00", "afternoon_end": "19:00", "is_active": True},
    {"day_of_week": 1, "day_name": "Tuesday",   "morning_start": "09:00", "morning_end": "13:00", "afternoon_start": "16:00", "afternoon_end": "19:00", "is_active": True},
    {"day_of_week": 2, "day_name": "Wednesday", "morning_start": "09:00", "morning_end": "13:00", "afternoon_start": "16:00", "afternoon_end": "19:00", "is_active": True},
    {"day_of_week": 3, "day_name": "Thursday",  "morning_start": "09:00", "morning_end": "13:00", "afternoon_start": "16:00", "afternoon_end": "19:00", "is_active": True},
    {"day_of_week": 4, "day_name": "Friday",    "morning_start": "09:00", "morning_end": "13:00", "afternoon_start": "16:00", "afternoon_end": "19:00", "is_active": True},
    {"day_of_week": 5, "day_name": "Saturday",  "morning_start": "09:00", "morning_end": "13:00", "afternoon_start": None,    "afternoon_end": None,    "is_active": True},
    {"day_of_week": 6, "day_name": "Sunday",    "morning_start": None,    "morning_end": None,    "afternoon_start": None,    "afternoon_end": None,    "is_active": False},
]

_MAX_RETRIES = 3
_RETRY_DELAYS = [1.0, 2.0, 4.0]


def _get_supabase():
    """Lazy import to avoid circular deps."""
    from db_backend import get_supabase
    return get_supabase()


def _is_retryable(err_str: str) -> bool:
    transient = ("525", "ssl", "timeout", "connection", "network", "502", "503", "504")
    return any(t in err_str.lower() for t in transient)


# ── Schedule CRUD ─────────────────────────────────────────────────────────────

def fetch_schedule() -> list[dict[str, Any]]:
    """Return all 7 days with their working hours. Falls back to defaults if DB unavailable."""
    supabase = _get_supabase()
    if not supabase:
        logger.warning("[SCHEDULE] Supabase not configured — using default schedule")
        return list(_DEFAULT_SCHEDULE)
    try:
        res = supabase.table("doctor_schedule").select("*").order("day_of_week").execute()
        rows = res.data or []
        if not rows:
            return list(_DEFAULT_SCHEDULE)
        # Ensure all 7 days present, filling gaps with defaults
        by_day = {row["day_of_week"]: row for row in rows}
        result = []
        for default in _DEFAULT_SCHEDULE:
            result.append(by_day.get(default["day_of_week"], default))
        return result
    except Exception as exc:
        logger.error("[SCHEDULE] fetch_schedule failed: %s", exc)
        return list(_DEFAULT_SCHEDULE)


def update_schedule_day(day_of_week: int, payload: dict[str, Any]) -> dict[str, Any]:
    """Update working hours for a specific day (0=Monday … 6=Sunday)."""
    supabase = _get_supabase()
    if not supabase:
        raise RuntimeError("Supabase not configured.")
    allowed = {"morning_start", "morning_end", "afternoon_start", "afternoon_end", "is_active"}
    data = {k: v for k, v in payload.items() if k in allowed}
    try:
        res = (
            supabase.table("doctor_schedule")
            .update(data)
            .eq("day_of_week", day_of_week)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise RuntimeError(f"No schedule row found for day_of_week={day_of_week}")
        return rows[0]
    except Exception as exc:
        logger.error("[SCHEDULE] update_schedule_day failed: %s", exc)
        raise


# ── Blocked Days CRUD ─────────────────────────────────────────────────────────

def fetch_blocked_days(year: int | None = None, month: int | None = None) -> list[dict[str, Any]]:
    """List all blocked days, optionally filtered to a specific month."""
    supabase = _get_supabase()
    if not supabase:
        return []
    try:
        query = supabase.table("doctor_blocked_days").select("*").order("blocked_date")
        if year and month:
            start_date = date(year, month, 1)
            if month == 12:
                end_date = date(year + 1, 1, 1)
            else:
                end_date = date(year, month + 1, 1)
            query = query.gte("blocked_date", start_date.isoformat())
            query = query.lt("blocked_date", end_date.isoformat())
        res = query.execute()
        return res.data or []
    except Exception as exc:
        logger.error("[SCHEDULE] fetch_blocked_days failed: %s", exc)
        return []


def block_day(blocked_date: str, reason: str = "", blocked_by: str = "doctor") -> dict[str, Any]:
    """Block a specific date. blocked_date must be 'YYYY-MM-DD'."""
    supabase = _get_supabase()
    if not supabase:
        raise RuntimeError("Supabase not configured.")
    try:
        # Validate date format
        datetime.strptime(blocked_date, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date format: {blocked_date}. Use YYYY-MM-DD.")
    try:
        res = supabase.table("doctor_blocked_days").upsert({
            "blocked_date": blocked_date,
            "reason": reason or "",
            "blocked_by": blocked_by or "doctor",
        }, on_conflict="blocked_date").execute()
        rows = res.data or []
        return rows[0] if rows else {"blocked_date": blocked_date, "reason": reason}
    except Exception as exc:
        logger.error("[SCHEDULE] block_day failed: %s", exc)
        raise


def unblock_day(blocked_date: str) -> bool:
    """Remove a blocked date. Returns True if deleted."""
    supabase = _get_supabase()
    if not supabase:
        raise RuntimeError("Supabase not configured.")
    try:
        supabase.table("doctor_blocked_days").delete().eq("blocked_date", blocked_date).execute()
        return True
    except Exception as exc:
        logger.error("[SCHEDULE] unblock_day failed: %s", exc)
        raise


def is_day_blocked(check_date: date | str) -> bool:
    """Return True if the given date is blocked. Used by the agent."""
    supabase = _get_supabase()
    if not supabase:
        return False
    try:
        date_str = check_date.isoformat() if isinstance(check_date, date) else str(check_date)
        res = (
            supabase.table("doctor_blocked_days")
            .select("id")
            .eq("blocked_date", date_str)
            .execute()
        )
        return bool(res.data)
    except Exception as exc:
        logger.warning("[SCHEDULE] is_day_blocked check failed: %s", exc)
        return False


def get_active_sessions(check_date: date) -> list[tuple[str, str]]:
    """
    Return list of (start_time, end_time) strings for the given date based on schedule.
    Returns empty list if the doctor is off that day or it's blocked.
    e.g. [("09:00", "13:00"), ("16:00", "19:00")]
    """
    if is_day_blocked(check_date):
        return []

    weekday = check_date.weekday()  # 0=Monday, 6=Sunday
    schedule = fetch_schedule()
    day_cfg = next((s for s in schedule if s["day_of_week"] == weekday), None)

    if not day_cfg or not day_cfg.get("is_active"):
        return []

    sessions = []
    if day_cfg.get("morning_start") and day_cfg.get("morning_end"):
        sessions.append((day_cfg["morning_start"][:5], day_cfg["morning_end"][:5]))
    if day_cfg.get("afternoon_start") and day_cfg.get("afternoon_end"):
        sessions.append((day_cfg["afternoon_start"][:5], day_cfg["afternoon_end"][:5]))
    return sessions

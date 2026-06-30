import asyncio
import logging
from datetime import date, datetime, time, timedelta

import pytz

from backend_events import handle_appointment_cancelled, handle_booking_confirmed
from db import (
    AppointmentConflictError,
    AppointmentError,
    AppointmentValidationError,
    cancel_appointment,
    create_appointment,
    fetch_appointments,
)

logger = logging.getLogger("calendar-tools")

IST = pytz.timezone("Asia/Kolkata")
SLOT_MINUTES = 30


class CalendarValidationError(ValueError):
    """Raised when a requested slot violates planner rules."""


def _parse_iso_datetime(value: str) -> datetime:
    clean = value.strip()
    if clean.endswith("Z"):
        clean = clean[:-1] + "+00:00"
    dt = datetime.fromisoformat(clean)
    if dt.tzinfo is None:
        dt = IST.localize(dt)
    return dt.astimezone(IST)


def _format_slot_label(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


def _time_str_to_datetime(day: date, time_str: str) -> datetime:
    """Convert 'HH:MM' string + date into a timezone-aware IST datetime."""
    h, m = map(int, time_str.split(":"))
    return IST.localize(datetime.combine(day, time(hour=h, minute=m)))


def _get_sessions_for_day(day: date) -> list[tuple[datetime, datetime]]:
    """
    Return list of (session_start_dt, session_end_dt) for the given date.
    Reads from doctor_schedule DB with fallback to hardcoded defaults.
    Returns empty list if doctor is off or date is blocked.
    """
    try:
        import db_schedule
        sessions_raw = db_schedule.get_active_sessions(day)
        if not sessions_raw:
            return []
        return [
            (_time_str_to_datetime(day, start), _time_str_to_datetime(day, end))
            for start, end in sessions_raw
        ]
    except Exception as exc:
        logger.warning("[CAL] db_schedule unavailable, using hardcoded fallback: %s", exc)
        # Hardcoded fallback: Mon-Fri 9-13 + 16-19, Sat 9-13, Sun closed
        weekday = day.weekday()
        if weekday == 6:
            return []
        sessions = [(_time_str_to_datetime(day, "09:00"), _time_str_to_datetime(day, "13:00"))]
        if weekday < 5:  # Mon-Fri get afternoon session
            sessions.append((_time_str_to_datetime(day, "16:00"), _time_str_to_datetime(day, "19:00")))
        return sessions


def _business_window(day: date) -> tuple[datetime, datetime] | tuple[None, None]:
    """Return the overall open/close window for the day (first session start → last session end)."""
    sessions = _get_sessions_for_day(day)
    if not sessions:
        return None, None
    return sessions[0][0], sessions[-1][1]


def validate_appointment_window(start_dt: datetime, end_dt: datetime) -> None:
    start_dt = start_dt.astimezone(IST)
    end_dt = end_dt.astimezone(IST)

    if end_dt <= start_dt:
        raise CalendarValidationError("Appointment end time must be after the start time.")
    if start_dt.date() != end_dt.date():
        raise CalendarValidationError("Appointments must start and end on the same day.")
    if start_dt.second or start_dt.microsecond or end_dt.second or end_dt.microsecond:
        raise CalendarValidationError("Appointments must align to 30-minute increments.")
    if start_dt.minute not in (0, 30) or end_dt.minute not in (0, 30):
        raise CalendarValidationError("Appointments must align to 30-minute increments.")
    if (end_dt - start_dt).total_seconds() % (SLOT_MINUTES * 60) != 0:
        raise CalendarValidationError("Appointments must use 30-minute increments.")

    sessions = _get_sessions_for_day(start_dt.date())
    if not sessions:
        try:
            import db_schedule
            if db_schedule.is_day_blocked(start_dt.date()):
                raise CalendarValidationError("The doctor is not available on this date.")
        except ImportError:
            pass
        raise CalendarValidationError("The doctor is not available on this day.")

    # Slot must fall within at least one session
    slot_ok = any(
        sess_start <= start_dt and end_dt <= sess_end
        for sess_start, sess_end in sessions
    )
    if not slot_ok:
        session_labels = " or ".join(
            f"{_format_slot_label(s)} to {_format_slot_label(e)}" for s, e in sessions
        )
        raise CalendarValidationError(
            f"Appointments must be within working hours: {session_labels} IST."
        )


async def get_available_slots(date_str: str) -> list:
    """
    Fetch open slots for a given date from the internal appointments calendar.
    date_str: "YYYY-MM-DD"
    """
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        logger.error(f"[CAL] Invalid availability date: {date_str}")
        return []

    sessions = await asyncio.to_thread(_get_sessions_for_day, target_date)
    if not sessions:
        logger.info(f"[CAL] No sessions available for {date_str} (blocked or day off)")
        return []

    # Fetch all booked appointments across all sessions for this day
    open_dt = sessions[0][0]
    close_dt = sessions[-1][1]

    try:
        booked = await asyncio.to_thread(
            fetch_appointments,
            start_iso=open_dt.isoformat(),
            end_iso=close_dt.isoformat(),
            statuses=["scheduled"],
            limit=200,
        )
    except AppointmentError as exc:
        logger.error(f"[CAL] Failed to fetch appointments for availability: {exc}")
        raise

    busy_ranges = [
        (
            _parse_iso_datetime(appointment["scheduled_start"]),
            _parse_iso_datetime(appointment["scheduled_end"]),
        )
        for appointment in booked
    ]

    free_slots = []
    for sess_start, sess_end in sessions:
        slot = sess_start
        while slot < sess_end:
            slot_end = slot + timedelta(minutes=SLOT_MINUTES)
            overlaps = any(start < slot_end and end > slot for start, end in busy_ranges)
            if not overlaps:
                iso_value = slot.isoformat()
                free_slots.append(
                    {
                        "time": iso_value,
                        "start_time": iso_value,
                        "label": _format_slot_label(slot),
                    }
                )
            slot = slot_end

    logger.info(f"[CAL] {len(free_slots)} free slots for {date_str}")
    return free_slots


def create_booking(
    start_time: str,
    caller_name: str,
    caller_phone: str,
    notes: str = "",
) -> dict:
    """Synchronous wrapper around async_create_booking."""
    try:
        return asyncio.get_event_loop().run_until_complete(
            async_create_booking(start_time, caller_name, caller_phone, notes)
        )
    except RuntimeError:
        return asyncio.run(async_create_booking(start_time, caller_name, caller_phone, notes))


async def async_create_booking(
    start_time: str,
    caller_name: str,
    caller_phone: str,
    notes: str = "",
) -> dict:
    """
    Create an internal appointment row.
    start_time: ISO 8601 with IST offset e.g. "2026-02-24T10:00:00+05:30"
    Returns: {"success": bool, "booking_id": str|None, "message": str}
    """
    try:
        start_dt = _parse_iso_datetime(start_time)
        end_dt = start_dt + timedelta(minutes=SLOT_MINUTES)
        await asyncio.to_thread(validate_appointment_window, start_dt, end_dt)

        appointment = await asyncio.to_thread(
            create_appointment,
            {
                "title": "Appointment",
                "contact_name": caller_name or "Unknown Caller",
                "contact_phone": caller_phone,
                "scheduled_start": start_dt.isoformat(),
                "scheduled_end": end_dt.isoformat(),
                "timezone": "Asia/Kolkata",
                "status": "scheduled",
                "notes": notes or f"Booked via AI voice agent. Phone: {caller_phone}",
                "source": "voice_agent",
            }
        )
        booking_id = str(appointment["id"])
        logger.info(f"[CAL] Internal appointment created: id={booking_id}")
        handle_booking_confirmed(
            appointment=appointment,
            caller_name=caller_name,
            phone_number=caller_phone,
            notes=notes,
        )
        return {
            "success": True,
            "booking_id": booking_id,
            "message": "Booking confirmed",
            "appointment": appointment,
        }
    except CalendarValidationError as exc:
        logger.warning(f"[CAL] Booking validation failed: {exc}")
        return {"success": False, "booking_id": None, "message": str(exc)}
    except AppointmentConflictError as exc:
        logger.warning(f"[CAL] Booking conflict: {exc}")
        return {"success": False, "booking_id": None, "message": str(exc)}
    except AppointmentValidationError as exc:
        logger.error(f"[CAL] Booking validation error: {exc}")
        return {"success": False, "booking_id": None, "message": str(exc)}
    except AppointmentError as exc:
        logger.error(f"[CAL] Booking error: {exc}")
        return {"success": False, "booking_id": None, "message": str(exc)}
    except Exception as exc:
        logger.error(f"[CAL] Unexpected booking error: {exc}")
        return {"success": False, "booking_id": None, "message": str(exc)}


def cancel_booking(booking_id: str, reason: str = "Cancelled by caller") -> dict:
    """Cancel an internal appointment by id."""
    try:
        appointment = cancel_appointment(booking_id, reason=reason)
        handle_appointment_cancelled(appointment, reason=reason)
        logger.info(f"[CAL] Appointment cancelled: {booking_id}")
        return {"success": True, "message": "Cancelled successfully"}
    except AppointmentError as exc:
        logger.error(f"[CAL] cancel_booking error: {exc}")
        return {"success": False, "message": str(exc)}

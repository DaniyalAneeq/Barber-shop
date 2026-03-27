"""
Seed script for appointment booking tables.
Run from the backend/ directory:
    python seed_appointments.py
"""
import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal


SERVICES = [
    ("Classic Haircut",        "Traditional scissor cut with hot towel finish and styling. Clean, timeless look for any occasion.", 30, "35.00"),
    ("Precision Fade",         "Expert skin or taper fade with crisp lines. Customized to your preferred fade height and blend.",    45, "45.00"),
    ("Beard Trim & Shape",     "Full beard sculpting, edging, and conditioning. Defined lines and a polished finish.",               20, "25.00"),
    ("Hot Towel Shave",        "Classic straight-razor shave with pre-shave oil, hot towel, and aftershave balm.",                  30, "40.00"),
    ("Haircut + Beard Combo",  "Full haircut paired with beard trim and shape. Best value for the complete look.",                   60, "65.00"),
    ("Kids Cut (Under 12)",    "Gentle, patient service for children 12 and under. Scissor or clipper cut with a fun finish.",      20, "20.00"),
]

BARBERS = [
    ("Marcus Williams", "marcus@theshop.com", '["skin_fade","taper","high_top","line_ups"]'),
    ("Carlos Rivera",   "carlos@theshop.com", '["beard","hot_towel_shave","classic_cuts","scissor_work"]'),
    ("Jordan Davis",    "jordan@theshop.com", '["fade","beard","kids_cuts","hair_designs","braids"]'),
]

# (barber_index, day_of_week, start_time, end_time, is_available)
# day_of_week: 0=Mon … 6=Sun
SCHEDULES = [
    # Marcus — off Sunday
    (0, 0, "09:00", "18:00", True),
    (0, 1, "09:00", "18:00", True),
    (0, 2, "09:00", "18:00", True),
    (0, 3, "09:00", "18:00", True),
    (0, 4, "09:00", "18:00", True),
    (0, 5, "09:00", "17:00", True),
    (0, 6, "00:00", "00:00", False),
    # Carlos — off Monday
    (1, 0, "00:00", "00:00", False),
    (1, 1, "10:00", "19:00", True),
    (1, 2, "10:00", "19:00", True),
    (1, 3, "10:00", "19:00", True),
    (1, 4, "10:00", "19:00", True),
    (1, 5, "09:00", "18:00", True),
    (1, 6, "11:00", "17:00", True),
    # Jordan — open all week, early Saturday
    (2, 0, "09:00", "18:00", True),
    (2, 1, "09:00", "18:00", True),
    (2, 2, "09:00", "18:00", True),
    (2, 3, "09:00", "18:00", True),
    (2, 4, "09:00", "18:00", True),
    (2, 5, "08:00", "18:00", True),
    (2, 6, "11:00", "16:00", True),
]


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        # Clear existing seed data (idempotent re-run)
        await session.execute(text("DELETE FROM barber_schedules"))
        await session.execute(text("DELETE FROM barbers"))
        await session.execute(text("DELETE FROM services"))

        # Insert services
        for name, description, duration, price in SERVICES:
            await session.execute(
                text(
                    "INSERT INTO services (name, description, duration_minutes, price) "
                    "VALUES (:name, :desc, :dur, :price)"
                ),
                {"name": name, "desc": description, "dur": duration, "price": price},
            )

        # Insert barbers and collect their IDs
        barber_ids: list[int] = []
        for name, email, specialties in BARBERS:
            result = await session.execute(
                text(
                    "INSERT INTO barbers (name, email, specialties) "
                    "VALUES (:name, :email, :spec::jsonb) RETURNING id"
                ),
                {"name": name, "email": email, "spec": specialties},
            )
            barber_ids.append(result.scalar_one())

        # Insert schedules
        for barber_idx, dow, start, end, available in SCHEDULES:
            await session.execute(
                text(
                    "INSERT INTO barber_schedules "
                    "(barber_id, day_of_week, start_time, end_time, is_available) "
                    "VALUES (:bid, :dow, :start, :end, :avail)"
                ),
                {
                    "bid": barber_ids[barber_idx],
                    "dow": dow,
                    "start": start,
                    "end": end,
                    "avail": available,
                },
            )

        await session.commit()
        print(f"Seeded {len(SERVICES)} services, {len(BARBERS)} barbers, {len(SCHEDULES)} schedule rows.")


if __name__ == "__main__":
    asyncio.run(seed())

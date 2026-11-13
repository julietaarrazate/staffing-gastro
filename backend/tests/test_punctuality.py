"""Regla de puntualidad: llegar antes es ser puntual (U019)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.modules.shift.domain.punctuality import arrived_on_time

START = datetime(2026, 11, 13, 20, 0, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("minutes_after_start", "expected"),
    [(-24, True), (-14, True), (-30, True), (0, True), (15, True), (16, False)],
)
def test_arrived_on_time(minutes_after_start: int, expected: bool):
    assert arrived_on_time(START + timedelta(minutes=minutes_after_start), START) is expected


def test_without_check_in_is_not_punctual():
    assert arrived_on_time(None, START) is False


def test_naive_and_aware_datetimes_compare():
    assert arrived_on_time(datetime(2026, 11, 13, 19, 36), START) is True


def test_fifteen_minutes_and_one_second_is_late():
    assert arrived_on_time(START + timedelta(minutes=15, seconds=1), START) is False

"""Small deterministic metrics shared by the data baker and validation tools."""

from __future__ import annotations

from collections.abc import Iterable


def slope_suitability_score(slope_deg: float) -> float:
    """Blueprint slope score: clip(100 - 5*slope, 0, 100)."""
    if slope_deg < 0:
        raise ValueError("slope must be nonnegative")
    return max(0.0, min(100.0, 100.0 - 5.0 * slope_deg))


def weighted_suitability_score(sun_percent: float, earth_percent: float, terrain_score: float,
                               weights: tuple[float, float, float] = (0.5, 0.3, 0.2)) -> float:
    values = (sun_percent, earth_percent, terrain_score, *weights)
    if any(not 0 <= v <= 100 for v in values[:3]):
        raise ValueError("scores must be in [0, 100]")
    if any(v < 0 for v in weights) or abs(sum(weights) - 1.0) > 1e-9:
        raise ValueError("weights must be nonnegative and sum to 1")
    return weights[0] * sun_percent + weights[1] * earth_percent + weights[2] * terrain_score


def longest_false_run(values: Iterable[bool]) -> int:
    longest = current = 0
    for value in values:
        if value:
            current = 0
        else:
            current += 1
            longest = max(longest, current)
    return longest


def angular_difference_deg(a: float, b: float) -> float:
    """Smallest unsigned difference between two angles, accounting for wrap."""
    return abs((a - b + 180.0) % 360.0 - 180.0)

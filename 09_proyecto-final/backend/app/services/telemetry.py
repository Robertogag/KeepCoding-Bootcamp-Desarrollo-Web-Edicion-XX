"""Read-only Modbus decoding. Missing and invalid signals never become numeric zero."""

import math
import struct

CORE_UNITS = {
    "state": "enum",
    "good_count": "pieces",
    "reject_count": "pieces",
    "alarm_code": "code",
    "cycle_time_s": "s",
    "heartbeat": "count",
    "ideal_cycle_s": "s",
}
CORE_FIELDS = {
    "state": "state",
    "good_count": "good_count",
    "reject_count": "reject_count",
    "alarm_code": "alarm_code",
    "cycle_time_s": "last_cycle_ds",
    "heartbeat": "heartbeat",
    "ideal_cycle_s": "ideal_cycle_ds",
}


def mapping_data(variable):
    return {
        name: getattr(variable, name)
        for name in (
            "id",
            "code",
            "unit",
            "address",
            "data_type",
            "word_order",
            "byte_order",
            "scale",
            "offset",
            "map_version",
        )
    }


def decode_variable(words, mapping):
    count = 1 if mapping["data_type"] in {"uint16", "int16"} else 2
    if len(words) != count or any(
        type(word) is not int or not 0 <= word <= 65535 for word in words
    ):
        raise ValueError("Invalid Modbus register block")
    ordered = words[::-1] if mapping["word_order"] == "little" else words
    raw = b"".join(word.to_bytes(2, mapping["byte_order"]) for word in ordered)
    formats = {"uint16": ">H", "int16": ">h", "uint32": ">I", "int32": ">i", "float32": ">f"}
    value = (
        struct.unpack(formats[mapping["data_type"]], raw)[0] * mapping["scale"] + mapping["offset"]
    )
    if not math.isfinite(value):
        raise ValueError("Non-finite telemetry")
    return value


def register_blocks(mappings):
    """Read only configured contiguous ranges, with Modbus's 125-register limit."""
    blocks = []
    for mapping in sorted(mappings, key=lambda item: item["address"]):
        start = mapping["address"]
        end = start + (1 if mapping["data_type"] in {"uint16", "int16"} else 2)
        if blocks and start <= blocks[-1][1] and max(end, blocks[-1][1]) - blocks[-1][0] <= 125:
            left, right, variables = blocks[-1]
            blocks[-1] = (left, max(right, end), [*variables, mapping])
        else:
            blocks.append((start, end, [mapping]))
    return blocks


def measurement(mapping, words=None):
    result = {
        "value": None,
        "unit": mapping["unit"],
        "quality": "bad",
        "raw": words,
        "mapping": mapping,
    }
    if words is not None:
        try:
            result.update(value=decode_variable(words, mapping), quality="good")
        except (ValueError, TypeError, KeyError, OverflowError, struct.error):
            pass
    return result


def base_measurements(registers, *, stale=False):
    values = {}
    for code, unit in CORE_UNITS.items():
        raw = getattr(registers, CORE_FIELDS[code]) if registers is not None else None
        value = raw / 10 if raw is not None and code in {"cycle_time_s", "ideal_cycle_s"} else raw
        quality = "bad" if registers is None else "stale" if stale else "good"
        if code in {"cycle_time_s", "ideal_cycle_s"} and raw == 0:
            value, quality = None, "unavailable"
        values[code] = {
            "value": value,
            "unit": unit,
            "quality": quality,
            "raw": raw,
            "map_version": "oee-base-v1",
        }
    return values

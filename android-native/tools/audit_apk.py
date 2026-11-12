#!/usr/bin/env python3
"""Compare real APKs by entry hash, compressed byte count and ABI; never infer feature health."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def category(name):
    if name.startswith("lib/"):
        return "/".join(name.split("/")[:2])
    if name.startswith("assets/"):
        return "assets"
    if name.startswith("res/"):
        return "resources"
    if name.endswith(".dex"):
        return "DEX"
    return "metadata/other"


def inventory(path):
    rows = {}
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, "Corrupt APK archive"
        for entry in archive.infolist():
            if not entry.is_dir():
                rows[entry.filename] = {
                    "bytes": entry.file_size, "compressed": entry.compress_size,
                    "compression": entry.compress_type,
                    "sha256": hashlib.sha256(archive.read(entry)).hexdigest(),
                }
    return rows


def compare(reference, candidate):
    a, b = inventory(reference), inventory(candidate)
    def summary(path, entries):
        categories = {}
        for group in sorted({category(name) for name in entries}):
            members = [v for n, v in entries.items() if category(n) == group]
            categories[group] = {"entries": len(members), **{
                key: sum(row[key] for row in members) for key in ("bytes", "compressed")}}
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        return {"name": path.name, "apk_bytes": path.stat().st_size,
                "sha256": digest,
                "categories": categories,
                "archive_overhead_bytes": path.stat().st_size - sum(v["compressed"] for v in entries.values())}
    result = {
        "reference": summary(reference, a), "candidate": summary(candidate, b),
        "removed": [{"name": n, **a[n]} for n in sorted(a.keys() - b.keys())],
        "added": [{"name": n, **b[n]} for n in sorted(b.keys() - a.keys())],
        "changed": [{"name": n, "reference": a[n], "candidate": b[n]}
                    for n in sorted(a.keys() & b.keys()) if a[n]["sha256"] != b[n]["sha256"]],
        "unchanged_entries": sum(a[n]["sha256"] == b[n]["sha256"] for n in a.keys() & b.keys()),
        "inventories": {"reference": a, "candidate": b},
    }
    # Byte accounting includes ZIP headers, alignment and APK signature block.
    for side in ("reference", "candidate"):
        info = result[side]
        assert sum(g["compressed"] for g in info["categories"].values()) + info["archive_overhead_bytes"] == info["apk_bytes"]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("candidate", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = compare(args.reference, args.candidate)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({key: result[key] for key in ("reference", "candidate", "unchanged_entries")}, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Validate bundled Aksara Local knowledge against real Android Native source modules.

Run in CI: python3 android-native/tools/sync_local_knowledge.py --check
Without --check, writes a reproducible module index into Android assets.
This indexes source presence, NOT runtime availability or operational health.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "android-native/app/src/main"
ASSETS = APP / "assets"
SOURCE = APP / "java/my/aksara/nativeapp"
MODULES = {
    "chat_engine": "feature/chat/ChatViewModel.kt",
    "context_manager": "feature/chat/ContextPolicy.kt",
    "local_knowledge": "feature/chat/LocalKnowledgeEngine.kt",
    "voice": "feature/voice",
    "studio": "feature/studio",
    "today": "feature/today",
    "privacy": "feature/chat/AksaraPrivacyDataControl.kt",
    "history": "feature/chat/UnifiedHistory.kt",
    "chess": "feature/chess",
    "liquid_glass": "core/design/AksaraDesign.kt",
}
def generate():
    corpus = json.loads((ASSETS / "aksara_local_knowledge_v2.json").read_text())
    journey = json.loads((ASSETS / "journey.json").read_text())
    assert corpus["schema_version"] == 1
    assert len(journey) >= 30
    assert len({x["question"] for x in journey}) == len(journey)
    ids = [e["id"] for e in corpus["entries"]]
    assert len(ids) == len(set(ids))
    for e in corpus["entries"]:
        assert e["title"] and e["facts"] and e["aliases"]
    return {"schema_version": 1, "scope": "source_inventory_only",
            "runtime_status": "not_verified",
            "knowledge_schema": corpus["schema_version"],
            "curated_questions": len(journey),
            "modules": [{"id": k, "source_path": str(Path("android-native/app/src/main/java/my/aksara/nativeapp") / p),
                         "source_present": (SOURCE / p).exists()} for k,p in sorted(MODULES.items())]}
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = ASSETS / "aksara_local_module_index.json"
    rendered = json.dumps(generate(), indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if not output.exists() or output.read_text() != rendered:
            raise SystemExit("Aksara Local module index stale: run sync_local_knowledge.py")
        print("Aksara Local module index current")
    else:
        output.write_text(rendered)
        print("Wrote", output)
if __name__ == "__main__":
    main()

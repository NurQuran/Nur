"""Build Warsh-specific tajweed spans from Quranpedia + quranic-phonemizer.

Install quranic-phonemizer (MIT) and run this script from the repository root.
The generated text is checked against Quranpedia's official Warsh mushaf dump;
the reader checks it again against the live verse before using the spans.
"""

import argparse
import difflib
import gzip
import json
import sys
import urllib.request
from pathlib import Path


def color_for_rule(rule):
    if rule.startswith("madd_tabii"):
        return "madda_normal"
    if rule.startswith("madd_lazim"):
        return "madda_necessary"
    if rule.startswith("madd_"):
        return "madda_permissible"
    if rule.startswith("qalqala"):
        return "qlq"
    if rule.startswith("ghunnah"):
        return "ghn"
    if rule.startswith("ikhfa"):
        return "ikhf"
    if rule.startswith("iqlab"):
        return "iqlb"
    if rule.startswith("idgham"):
        return "idgh_ghn"
    if rule.startswith("taqlil"):
        return "warsh_taqlil"
    if rule.startswith("naql"):
        return "warsh_naql"
    return None


def spans_for_verse(result, display_text):
    source_text = result.text()
    rules = {item.id.value: item.rule_id.value for item in result.rule_occurrences}
    source_classes = [None] * len(source_text)
    for unit in result.source().units:
        matching = [color_for_rule(rules[item.value]) for item in unit.rule_occurrence_ids]
        color = next((item for item in matching if item), None)
        if not color:
            continue
        for start, end in unit.ranges:
            for position in range(start, min(end, len(source_text))):
                source_classes[position] = color
    # Only identical codepoints receive a source annotation. Changed glyphs,
    # vowel marks and adjacent insertions retain Quranpedia's plain text.
    classes = [None] * len(display_text)
    matcher = difflib.SequenceMatcher(None, source_text, display_text, autojunk=False)
    matching = sum(block.size for block in matcher.get_matching_blocks())
    if matching / max(len(source_text), len(display_text), 1) < 0.97:
        return None
    for block in matcher.get_matching_blocks():
        for offset in range(block.size):
            classes[block.b + offset] = source_classes[block.a + offset]
    spans = []
    start = 0
    while start < len(classes):
        color = classes[start]
        end = start + 1
        while end < len(classes) and classes[end] == color:
            end += 1
        if color:
            spans.append([start, end, color])
        start = end
    return spans


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--package-dir", help="Directory containing quranic_phonemizer")
    args = parser.parse_args()
    if args.package_dir:
        sys.path.insert(0, args.package_dir)
    from quranic_phonemizer import Phonemizer

    url = "https://api.quranpedia.net/dumps/mushafs-4.json.gz"
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://api.quranpedia.net/dumps?lang=en",
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        dump = json.loads(gzip.decompress(response.read()))
    phonemizer = Phonemizer(riwayah="warsh")
    output = Path(__file__).resolve().parents[1] / "public" / "data" / "warsh-tajweed"
    output.mkdir(parents=True, exist_ok=True)
    matches = 0
    mismatches = []
    colored = 0
    for surah in dump["data"]["surahs"]:
        number = surah["id"]
        verses = {}
        for ayah in surah["ayahs"]:
            reference = f'{number}:{ayah["number"]}'
            result = phonemizer.analyse(reference)
            text = ayah["text"]
            spans = spans_for_verse(result, text)
            if spans is None:
                mismatches.append(reference)
                continue
            matches += 1
            colored += bool(spans)
            verses[str(ayah["number"])] = [text, spans]
        (output / f"{number:03}.json").write_text(
            json.dumps(verses, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    print(f"Matched: {matches}; colored: {colored}; mismatches: {len(mismatches)}")
    if mismatches:
        print("Mismatched references:", ", ".join(mismatches[:30]))


if __name__ == "__main__":
    main()

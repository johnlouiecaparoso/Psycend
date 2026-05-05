from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from parse_psychological_assessment_ch1_ch2_pdf import build_rows as build_rows_ch1_ch2
from parse_psychological_assessment_ch3_pdf import build_rows as build_rows_ch3


CH1_CH2_TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-chapter-1-2-from-pdf.txt")
CH3_TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-chapter-3-from-pdf.txt")
CSV_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-special-import-from-pdf.csv")
REPORT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-special-import-report.txt")

TOPIC = "special"
EXPECTED_CHAPTER_COUNTS = {
    "Chapter 1": 19,
    "Chapter 2": 21,
    "Chapter 3": 40,
}


def load_rows() -> list[list[str | int]]:
    text_1_2 = CH1_CH2_TEXT_PATH.read_text(encoding="utf-8", errors="replace")
    text_3 = CH3_TEXT_PATH.read_text(encoding="utf-8", errors="replace")

    rows_1_2 = build_rows_ch1_ch2(text_1_2)
    rows_3 = build_rows_ch3(text_3)
    rows = rows_1_2 + rows_3

    for row in rows:
        row[10] = TOPIC

    return rows


def validate_rows(rows: list[list[str | int]]) -> None:
    if len(rows) != sum(EXPECTED_CHAPTER_COUNTS.values()):
        raise ValueError(f"Unexpected total row count. Expected 80, got {len(rows)}.")

    chapter_counts = Counter(str(row[9]) for row in rows)
    if dict(chapter_counts) != EXPECTED_CHAPTER_COUNTS:
        raise ValueError(f"Chapter counts mismatch. Expected {EXPECTED_CHAPTER_COUNTS}, got {dict(chapter_counts)}.")

    seen_keys: set[tuple[str, str]] = set()
    for row in rows:
        question = str(row[0]).strip()
        chapter = str(row[9]).strip()
        topic = str(row[10]).strip()
        if not question or not chapter:
            raise ValueError(f"Found incomplete row: {row}")
        if topic != TOPIC:
            raise ValueError(f"Topic mismatch: expected '{TOPIC}', got '{topic}'.")

        key = (chapter, question)
        if key in seen_keys:
            raise ValueError(f"Duplicate chapter/question pair detected: {key}")
        seen_keys.add(key)


def write_csv(rows: list[list[str | int]]) -> None:
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "Question",
                "Choice 1",
                "Choice 2",
                "Choice 3",
                "Choice 4",
                "Correct Answer (1-4)",
                "Explanation",
                "Difficulty",
                "Subject",
                "Chapter",
                "Topic",
            ]
        )
        writer.writerows(rows)


def write_report(rows: list[list[str | int]]) -> None:
    chapter_counts = Counter(str(row[9]) for row in rows)
    lines = [
        "Psychological Assessment special import report",
        f"Total exported rows: {len(rows)}",
        "",
    ]
    for chapter in ["Chapter 1", "Chapter 2", "Chapter 3"]:
        lines.append(f"{chapter}: {chapter_counts[chapter]} questions | topic `{TOPIC}`")
    lines.append("Topic was forced to `special` for all rows as requested.")
    lines.append("Validated no duplicate chapter/question pairs and no missing questions based on expected chapter counts.")
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    rows = load_rows()
    validate_rows(rows)
    write_csv(rows)
    write_report(rows)
    print(f"Wrote {len(rows)} rows to {CSV_PATH}")
    print(f"Report saved to {REPORT_PATH}")


if __name__ == "__main__":
    main()

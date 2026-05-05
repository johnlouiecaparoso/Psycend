from __future__ import annotations

import csv
import re
from pathlib import Path


TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\developmental-psychology-quiz-from-pdf.txt")
CSV_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\developmental-psychology-quiz-import-from-pdf.csv")
REPORT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\developmental-psychology-quiz-import-report.txt")

SUBJECT = "Developmental Psychology"
EXPECTED_COUNTS = {
    1: 40,
    2: 40,
    3: 35,
    4: 35,
    5: 35,
    6: 40,
    7: 35,
    8: 40,
    9: 40,
    10: 40,
    11: 40,
    12: 40,
    13: 40,
    14: 40,
    15: 40,
    16: 40,
    17: 40,
    18: 40,
    19: 40,
}


def clean_text(value: str) -> str:
    value = (
        value.replace("\u00ad", "")
        .replace("\ufffd", "")
        .replace("­", "")
        .replace("\f", " ")
    )
    return re.sub(r"\s+", " ", value).strip()


def clean_choice_text(value: str) -> str:
    cleaned = clean_text(value)
    return re.sub(r"^[A-D]\.\s*", "", cleaned)


def slugify(value: str) -> str:
    lowered = clean_text(value).lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    return lowered.strip("-")


def chapter_markers(text: str) -> list[re.Match[str]]:
    matches = list(re.finditer(r"(?:(?<=\f)|^)CHAPTER\s+(\d+)\s*\f", text))
    return [match for match in matches if int(match.group(1)) in EXPECTED_COUNTS]


def chapter_blocks(text: str) -> dict[int, str]:
    blocks: dict[int, str] = {}
    markers = chapter_markers(text)
    for index, marker in enumerate(markers):
        start = marker.end()
        end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        blocks[int(marker.group(1))] = text[start:end]
    return blocks


def chapter_one_block(text: str) -> str:
    start = text.find("Chapter 1: Theory and Research")
    end = text.lower().find("chapter 2")
    if start < 0 or end < 0:
        raise ValueError("Unable to isolate Chapter 1 block.")
    return text[start:end]


def chapter_two_block(text: str) -> str:
    start = text.lower().find("chapter 2")
    end = text.find("CHAPTER 3")
    if start < 0 or end < 0:
        raise ValueError("Unable to isolate Chapter 2 block.")
    return text[start:end]


def chapter_title(chapter_number: int, block: str) -> str:
    if chapter_number in {1, 2}:
        return "Theory and Research"

    match = re.search(rf"Chapter\s+{chapter_number}[: ]\s*(.+)", block)
    if not match:
        raise ValueError(f"Missing title for Chapter {chapter_number}.")

    title = clean_text(match.group(1))
    if chapter_number == 6 and title == "Psychosocial Development during the First":
        return "Psychosocial Development during the First Three Years"
    return title


def validate_sequence(chapter_number: int, rows: list[dict[str, str | int]]) -> None:
    expected_numbers = list(range(1, EXPECTED_COUNTS[chapter_number] + 1))
    actual_numbers = [int(row["number"]) for row in rows]
    if actual_numbers != expected_numbers:
        raise ValueError(
            f"Chapter {chapter_number} numbering mismatch. Expected {expected_numbers}, got {actual_numbers}."
        )


def parse_chapter_one(block: str) -> list[dict[str, str | int]]:
    pattern = re.compile(
        r"Question\s+(\d+):\s*(.*?)\s*Choices:\s*"
        r"A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*D\.\s*(.*?)\s*"
        r"Correct Answer:\s*([A-D])\.\s*(.*?)\s*Rationale:\s*"
        r"Correct Answer Explanation:\s*(.*?)\s*Incorrect Answers Explanation:\s*.*?"
        r"High-Yield Concept:\s*(.*?)(?=Question\s+\d+:|\Z)",
        flags=re.DOTALL | re.IGNORECASE,
    )

    rows: list[dict[str, str | int]] = []
    for match in pattern.finditer(block):
        rows.append(
            {
                "number": int(match.group(1)),
                "question": clean_text(match.group(2)),
                "choice_1": clean_choice_text(match.group(3)),
                "choice_2": clean_choice_text(match.group(4)),
                "choice_3": clean_choice_text(match.group(5)),
                "choice_4": clean_choice_text(match.group(6)),
                "correct": {"A": 1, "B": 2, "C": 3, "D": 4}[match.group(7)],
                "explanation": clean_text(match.group(9)),
            }
        )
    validate_sequence(1, rows)
    return rows


def parse_chapter_two(block: str) -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    for question_number, question_block in split_standard_questions(block):
        cleaned = question_block.replace("\f", "\n")
        cleaned = re.sub(r"\nSHORT QUIZ.*?\n", "\n", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\nchapter\s+2\s*\n", "\n", cleaned, flags=re.IGNORECASE)

        match = re.search(
            rf"^\s*{question_number}\.\s*(.*?)\s+([A-D])\.\s*(.*?)\n\s*A\.\s*(.*?)\n\s*B\.\s*(.*?)\n\s*C\.\s*(.*?)\n\s*D\.\s*(.*?)\n\s*Rationale:\s*(.*)$",
            cleaned,
            flags=re.DOTALL,
        )
        if not match:
            raise ValueError(f"Unable to parse Chapter 2 question {question_number}.")

        rows.append(
            {
                "number": question_number,
                "question": clean_text(match.group(1)),
                "choice_1": clean_choice_text(match.group(4)),
                "choice_2": clean_choice_text(match.group(5)),
                "choice_3": clean_choice_text(match.group(6)),
                "choice_4": clean_choice_text(match.group(7)),
                "correct": {"A": 1, "B": 2, "C": 3, "D": 4}[match.group(2)],
                "explanation": clean_text(match.group(8)),
            }
        )
    validate_sequence(2, rows)
    return rows


def split_standard_questions(block: str) -> list[tuple[int, str]]:
    matches = list(re.finditer(r"(?:(?<=^)|(?<=\n)|(?<=\f))\s*(\d+)\.\s*", block))
    question_blocks: list[tuple[int, str]] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        question_blocks.append((int(match.group(1)), block[start:end]))
    return question_blocks


def parse_standard_question(question_number: int, block: str) -> dict[str, str | int]:
    cleaned = block.replace("\f", "\n")
    cleaned = re.sub(r"\nCHAPTER\s+\d+\s*\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nSHORT QUIZ.*?\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nChapter\s+\d+[: ].*?\n", "\n", cleaned, flags=re.IGNORECASE)

    match = re.search(
        rf"^\s*{question_number}\.\s*(.*?)\n\s*A\.\s*(.*?)\n\s*B\.\s*(.*?)\n\s*C\.\s*(.*?)\n\s*D\.\s*(.*?)\n\s*(?:✅\s*)?Answer:\s*([A-D])\.\s*(.*?)\n\s*Rationale:\s*(.*)$",
        cleaned,
        flags=re.DOTALL,
    )
    if not match:
        raise ValueError(f"Unable to parse Chapter question {question_number}.")

    return {
        "number": question_number,
        "question": clean_text(match.group(1)),
        "choice_1": clean_choice_text(match.group(2)),
        "choice_2": clean_choice_text(match.group(3)),
        "choice_3": clean_choice_text(match.group(4)),
        "choice_4": clean_choice_text(match.group(5)),
        "correct": {"A": 1, "B": 2, "C": 3, "D": 4}[match.group(6)],
        "explanation": clean_text(match.group(8)),
    }


def parse_standard_chapter(chapter_number: int, block: str) -> list[dict[str, str | int]]:
    rows = [parse_standard_question(question_number, question_block) for question_number, question_block in split_standard_questions(block)]
    validate_sequence(chapter_number, rows)
    return rows


def build_csv_rows(text: str) -> tuple[list[list[str | int]], list[str]]:
    rows: list[list[str | int]] = []
    report: list[str] = []

    chapter_1 = chapter_one_block(text)
    chapter_2 = chapter_two_block(text)
    later_blocks = chapter_blocks(text)

    all_parsed: dict[int, tuple[str, list[dict[str, str | int]]]] = {
        1: (chapter_title(1, chapter_1), parse_chapter_one(chapter_1)),
        2: (chapter_title(2, chapter_2), parse_chapter_two(chapter_2)),
    }

    for chapter_number in sorted(later_blocks):
        title = chapter_title(chapter_number, later_blocks[chapter_number])
        parsed = parse_standard_chapter(chapter_number, later_blocks[chapter_number])
        all_parsed[chapter_number] = (title, parsed)

    for chapter_number in sorted(all_parsed):
        title, parsed_rows = all_parsed[chapter_number]
        topic = title
        for row in parsed_rows:
            rows.append(
                [
                    row["question"],
                    row["choice_1"],
                    row["choice_2"],
                    row["choice_3"],
                    row["choice_4"],
                    row["correct"],
                    row["explanation"],
                    "Medium",
                    SUBJECT,
                    f"Chapter {chapter_number}",
                    topic,
                ]
            )
        report.append(f"Chapter {chapter_number}: {len(parsed_rows)} questions | topic `{topic}`")

    report.append("Skipped trailing Chapter 20 marker because it contained no recoverable quiz content.")
    report.append("Chapter 6 topic was normalized to `Psychosocial Development during the First Three Years` because the extracted heading was truncated.")
    return rows, report


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


def write_report(lines: list[str], total_rows: int) -> None:
    content = ["Developmental Psychology PDF import report", f"Total exported rows: {total_rows}", ""]
    content.extend(lines)
    REPORT_PATH.write_text("\n".join(content), encoding="utf-8")


def main() -> None:
    text = TEXT_PATH.read_text(encoding="utf-8", errors="replace")
    rows, report = build_csv_rows(text)
    write_csv(rows)
    write_report(report, len(rows))
    print(f"Wrote {len(rows)} rows to {CSV_PATH}")
    print(f"Report saved to {REPORT_PATH}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import re
from pathlib import Path


TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\abnormal-psychology-short-quiz-from-pdf.txt")
CSV_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\abnormal-psychology-quiz-import-from-pdf.csv")
REPORT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\abnormal-psychology-quiz-import-report.txt")

SUBJECT = "Abnormal Psychology"
CHAPTER_ONE_TOPIC = "Chapter 1 Overview"
EXPECTED_COUNTS = {
    1: 40,
    2: 35,
    3: 35,
    5: 35,
    6: 35,
    7: 35,
    8: 35,
    9: 35,
    10: 35,
    11: 35,
    12: 35,
    13: 35,
    14: 35,
    15: 35,
    16: 35,
}


def clean_text(value: str) -> str:
    value = value.replace("\f", " ").replace("\ufffd", "").replace("\xad", "")
    value = value.replace("â€“", "-").replace("â€”", "-")
    return re.sub(r"\s+", " ", value).strip()


def clean_choice_text(value: str) -> str:
    return re.sub(r"^[A-D]\.\s*", "", clean_text(value))


def chapter_anchors(text: str) -> list[tuple[int, int]]:
    anchors = [(1, text.find("SHORT QUIZ: ABNORMAL PSYCHOLOGY CHAPTER 1"))]
    for match in re.finditer(r"CHAPTER\s+(\d+):", text, re.IGNORECASE):
        number = int(match.group(1))
        if number in EXPECTED_COUNTS and number != 1:
            anchors.append((number, match.start()))

    ordered: list[tuple[int, int]] = []
    seen: set[int] = set()
    for number, position in sorted(anchors, key=lambda item: item[1]):
        if position < 0 or number in seen:
            continue
        seen.add(number)
        ordered.append((number, position))
    return ordered


def chapter_blocks(text: str) -> dict[int, str]:
    anchors = chapter_anchors(text)
    blocks: dict[int, str] = {}
    for index, (number, position) in enumerate(anchors):
        end = anchors[index + 1][1] if index + 1 < len(anchors) else len(text)
        blocks[number] = text[position:end]
    return blocks


def chapter_title(chapter_number: int, block: str) -> str:
    if chapter_number == 1:
        return "Chapter 1 Overview"

    lines = [line.replace("\f", "").strip() for line in block.splitlines()]
    lines = [line for line in lines if line]

    title_parts: list[str] = []
    capture = False
    for line in lines:
        if re.match(rf"^CHAPTER\s+{chapter_number}:\s*", line, re.IGNORECASE):
            capture = True
            title_parts.append(re.sub(rf"^CHAPTER\s+{chapter_number}:\s*", "", line, flags=re.IGNORECASE))
            continue
        if capture:
            if re.match(r"^(?:Question\s+)?(?:[1-9]|[1-3][0-9]|40)[\.:]", line):
                break
            if re.match(r"^[A-D]\.", line) or line.startswith("Answer:") or line.startswith("Rationale:"):
                break
            if line.upper().startswith("SHORT QUIZ"):
                continue
            title_parts.append(line)

    title = clean_text(" ".join(title_parts))
    if not title:
        raise ValueError(f"Missing title for Chapter {chapter_number}.")
    return title


def validate_sequence(chapter_number: int, rows: list[dict[str, str | int]]) -> None:
    expected = list(range(1, EXPECTED_COUNTS[chapter_number] + 1))
    actual = [int(row["number"]) for row in rows]
    if actual != expected:
        raise ValueError(f"Chapter {chapter_number} numbering mismatch. Expected {expected}, got {actual}.")


def parse_chapter_one(block: str) -> list[dict[str, str | int]]:
    pattern = re.compile(
        r"Question\s+(\d+):\s*(.*?)\s*\(Answer:\s*([A-D])\.\s*(.*?)\)\s*"
        r"A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*D\.\s*(.*?)\s*"
        r"Rationale:\s*(.*?)(?=(?:\f)?Question\s+\d+:|\Z)",
        flags=re.DOTALL | re.IGNORECASE,
    )

    rows: list[dict[str, str | int]] = []
    for match in pattern.finditer(block):
        rows.append(
            {
                "number": int(match.group(1)),
                "question": clean_text(match.group(2)),
                "choice_1": clean_choice_text(match.group(5)),
                "choice_2": clean_choice_text(match.group(6)),
                "choice_3": clean_choice_text(match.group(7)),
                "choice_4": clean_choice_text(match.group(8)),
                "correct": {"A": 1, "B": 2, "C": 3, "D": 4}[match.group(3).upper()],
                "explanation": clean_text(match.group(9)),
            }
        )
    validate_sequence(1, rows)
    return rows


def split_standard_questions(block: str) -> list[tuple[int, str]]:
    matches = list(re.finditer(r"(?:(?<=^)|(?<=\n)|(?<=\f))\s*((?:[1-9]|[1-3][0-9]|40))\.\s*", block))
    question_blocks: list[tuple[int, str]] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        question_blocks.append((int(match.group(1)), block[start:end]))
    return question_blocks


def parse_standard_question(question_number: int, block: str) -> dict[str, str | int]:
    cleaned = block.replace("\f", "\n")
    cleaned = re.sub(r"\nSHORT QUIZ.*?\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nCHAPTER\s+\d+\s*\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nCHAPTER\s+\d+:\s*.*?(?:\n|$)", "\n", cleaned, flags=re.IGNORECASE)

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
    rows = [parse_standard_question(number, question_block) for number, question_block in split_standard_questions(block)]
    validate_sequence(chapter_number, rows)
    return rows


def build_csv_rows(text: str) -> tuple[list[list[str | int]], list[str]]:
    blocks = chapter_blocks(text)
    rows: list[list[str | int]] = []
    report: list[str] = []

    for chapter_number in sorted(EXPECTED_COUNTS):
        block = blocks[chapter_number]
        title = chapter_title(chapter_number, block)
        topic = CHAPTER_ONE_TOPIC if chapter_number == 1 else title
        parsed_rows = parse_chapter_one(block) if chapter_number == 1 else parse_standard_chapter(chapter_number, block)

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

    report.append("Skipped Chapter 4 because no recoverable chapter content was present in the extracted PDF text.")
    report.append("Chapter 1 topic was set to `Chapter 1 Overview` because the extracted PDF text did not expose a visible subtitle for that chapter.")
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
    content = ["Abnormal Psychology PDF import report", f"Total exported rows: {total_rows}", ""]
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

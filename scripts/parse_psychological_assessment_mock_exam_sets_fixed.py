from __future__ import annotations

import csv
import re
from pathlib import Path


TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-mock-exam-from-pdf.txt")
CSV_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-mock-exam-import-exam-sets.csv")
REPORT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-mock-exam-import-exam-sets-report.txt")

SUBJECT = "Psychological Assessment"
EXPECTED_EXAMS = list(range(1, 14))
EXPECTED_QUESTIONS_PER_EXAM = 100


def clean_text(value: str) -> str:
    value = value.replace("\f", " ").replace("\ufffd", "").replace("\xad", "")
    value = value.replace("â€“", "-").replace("â€”", "-")
    return re.sub(r"\s+", " ", value).strip()


def clean_choice_text(value: str) -> str:
    return re.sub(r"^[A-D]\.\s*", "", clean_text(value))


def exam_anchors(text: str) -> list[tuple[int, int, int]]:
    anchors: list[tuple[int, int, int]] = []
    seen: set[int] = set()
    for match in re.finditer(r"(?:(?<=^)|(?<=\n)|(?<=\f))\s*ASSESSMENT EXAM\s+(\d+)\s*(?=\f|\n|$)", text, re.IGNORECASE):
        exam_number = int(match.group(1))
        if exam_number in EXPECTED_EXAMS and exam_number not in seen:
            anchors.append((exam_number, match.start(), match.end()))
            seen.add(exam_number)
    return anchors


def exam_blocks(text: str) -> dict[int, str]:
    anchors = exam_anchors(text)
    blocks: dict[int, str] = {}
    for index, (exam_number, _start, end_marker) in enumerate(anchors):
        end = anchors[index + 1][1] if index + 1 < len(anchors) else len(text)
        blocks[exam_number] = text[end_marker:end]
    return blocks


def split_question_blocks(block: str) -> list[tuple[int, str]]:
    matches = list(re.finditer(r"(?:(?<=^)|(?<=\n)|(?<=\f))\s*((?:[1-9]|[1-9]\d|100))\.\s*", block))
    question_blocks: list[tuple[int, str]] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        question_blocks.append((int(match.group(1)), block[start:end]))
    return question_blocks


def parse_question(question_number: int, block: str) -> dict[str, str | int]:
    cleaned = block.replace("\f", "\n")
    cleaned = re.sub(r"\nMOCK EXAM- PSYCHOLOGICAL ASSESSMENT EXAM \d+\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nMOCK EXAM- PSYCHOLOGICAL\s*\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nASSESSMENT EXAM \d+\s*\n", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\nEXAM \d+\s*\n", "\n", cleaned, flags=re.IGNORECASE)
    match = re.search(
        rf"^\s*{question_number}\.\s*(.*?)\n\s*A\.\s*(.*?)\n\s*B\.\s*(.*?)\n\s*C\.\s*(.*?)\n\s*D\.\s*(.*?)\n\s*(?:✅\s*)?Answer:\s*([A-D])\.\s*(.*?)\n\s*Rationale:\s*(.*)$",
        cleaned,
        flags=re.DOTALL,
    )
    if not match:
        raise ValueError(f"Unable to parse question {question_number}.")

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


def parse_exam(exam_number: int, block: str) -> list[dict[str, str | int]]:
    rows: list[dict[str, str | int]] = []
    seen_numbers: set[int] = set()

    for number, question_block in split_question_blocks(block):
        if number in seen_numbers:
            raise ValueError(f"Duplicate question number {number} in Exam {exam_number}.")
        rows.append(parse_question(number, question_block))
        seen_numbers.add(number)

    actual_numbers = [int(row["number"]) for row in rows]
    expected_numbers = list(range(1, EXPECTED_QUESTIONS_PER_EXAM + 1))
    if actual_numbers != expected_numbers:
        raise ValueError(f"Exam {exam_number} numbering mismatch. Expected 1-100, got {actual_numbers}.")
    return rows


def build_rows(text: str) -> tuple[list[list[str | int]], list[str]]:
    blocks = exam_blocks(text)
    missing = [exam for exam in EXPECTED_EXAMS if exam not in blocks]
    if missing:
        raise ValueError(f"Missing exam blocks: {missing}")

    rows: list[list[str | int]] = []
    report: list[str] = []
    seen_exam_labels: set[str] = set()
    seen_exam_question_keys: set[tuple[int, int]] = set()

    for exam_number in EXPECTED_EXAMS:
        parsed_rows = parse_exam(exam_number, blocks[exam_number])
        exam_label = f"Exam {exam_number}"
        if exam_label in seen_exam_labels:
            raise ValueError(f"Duplicate exam set label detected: {exam_label}")
        seen_exam_labels.add(exam_label)

        for row in parsed_rows:
            key = (exam_number, int(row["number"]))
            if key in seen_exam_question_keys:
                raise ValueError(f"Duplicate exam/question pair detected: {key}")
            seen_exam_question_keys.add(key)

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
                    exam_label,
                    exam_label,
                ]
            )
        report.append(f"{exam_label}: {len(parsed_rows)} questions")

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
    content = ["Psychological Assessment mock exam PDF import report", f"Total exported rows: {total_rows}", ""]
    content.extend(lines)
    content.append("Chapter and Topic were both set to `Exam N` because this import is organized by exam set, not by subtopic.")
    REPORT_PATH.write_text("\n".join(content), encoding="utf-8")


def main() -> None:
    text = TEXT_PATH.read_text(encoding="utf-8", errors="replace")
    rows, report = build_rows(text)
    write_csv(rows)
    write_report(report, len(rows))
    print(f"Wrote {len(rows)} rows to {CSV_PATH}")
    print(f"Report saved to {REPORT_PATH}")


if __name__ == "__main__":
    main()

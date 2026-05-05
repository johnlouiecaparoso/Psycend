from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path


CH1_CH2_TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-chapter-1-2-from-pdf.txt")
CH3_TEXT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-chapter-3-from-pdf.txt")
CSV_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-special-import-from-pdf.csv")
REPORT_PATH = Path(r"C:\Users\Louie\Desktop\pyschprep\psychological-assessment-special-import-report.txt")

SUBJECT = "Psychological Assessment"
TOPIC = "special"
EXPECTED_CHAPTER_COUNTS = {
    "Chapter 1": 19,
    "Chapter 2": 21,
    "Chapter 3": 40,
}


def clean_text(value: str) -> str:
    value = value.replace("\f", " ").replace("\xad", "").replace("Â­", "")
    value = value.replace("â€“", "-").replace("â€”", "-")
    return re.sub(r"\s+", " ", value).strip()


def clean_choice_text(value: str) -> str:
    return re.sub(r"^[A-D]\.\s*", "", clean_text(value))


def split_numbered_blocks(text: str) -> list[tuple[int, str]]:
    matches = list(re.finditer(r"(?:(?<=^)|(?<=\n)|(?<=\f))\s*(\d+)\.\s*", text))
    blocks: list[tuple[int, str]] = []
    for index, match in enumerate(matches):
        number = int(match.group(1))
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append((number, text[start:end]))
    return blocks


def parse_mcq_block(number: int, block: str) -> dict[str, str]:
    normalized = block.replace("\f", "\n")
    match = re.search(
        rf"^\s*{number}\.\s*(.*?)\n\s*A\.\s*(.*?)\n\s*B\.\s*(.*?)\n\s*C\.\s*(.*?)\n\s*D\.\s*(.*)$",
        normalized,
        flags=re.DOTALL,
    )
    if not match:
        raise ValueError(f"Unable to parse question {number}.")
    return {
        "question": clean_text(match.group(1)),
        "choice_1": clean_choice_text(match.group(2)),
        "choice_2": clean_choice_text(match.group(3)),
        "choice_3": clean_choice_text(match.group(4)),
        "choice_4": clean_choice_text(match.group(5)),
    }


def chapter_for_question(number: int) -> str:
    return "Chapter 1" if number <= 19 else "Chapter 2"


def parse_ch1_ch2_questions(text: str) -> list[dict[str, str]]:
    question_section = text.split("PART 2: ANSWER KEY", 1)[0]
    rows: list[dict[str, str]] = []
    for number, block in split_numbered_blocks(question_section):
        parsed = parse_mcq_block(number, block)
        rows.append({"number": str(number), **parsed})

    expected = [str(i) for i in range(1, 41)]
    actual = [row["number"] for row in rows]
    if actual != expected:
        raise ValueError(f"Question numbering mismatch for Chapter 1-2 PDF. Expected 1-40, got {actual}.")
    return rows


def parse_ch1_ch2_answer_key(text: str) -> dict[int, str]:
    if "PART 2: ANSWER KEY" not in text:
        raise ValueError("Answer key section not found for Chapter 1-2 PDF.")
    section = text.split("PART 2: ANSWER KEY", 1)[1].split("PART 3: RATIONALE", 1)[0]
    answers = {int(n): a for n, a in re.findall(r"(\d+)\.\s*([A-D])", section)}
    if sorted(answers) != list(range(1, 41)):
        raise ValueError(f"Answer key incomplete for Chapter 1-2 PDF. Parsed {sorted(answers)}")
    return answers


def parse_ch1_ch2_rationales(text: str) -> dict[int, str]:
    if "PART 3: RATIONALE" not in text:
        raise ValueError("Rationale section not found for Chapter 1-2 PDF.")
    section = text.split("PART 3: RATIONALE", 1)[1]
    matches = list(re.finditer(r"(\d+)\.\s*Correct Answer:\s*([A-D])", section))
    rationales: dict[int, str] = {}
    for index, match in enumerate(matches):
        number = int(match.group(1))
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(section)
        block = section[start:end]
        rationale_match = re.search(r"Rationale:\s*(.*?)(?=(?:Incorrect Choices:|High-Yield Concept:|$))", block, flags=re.DOTALL)
        if not rationale_match:
            raise ValueError(f"Missing rationale for question {number} in Chapter 1-2 PDF.")
        rationales[number] = clean_text(rationale_match.group(1))
    if sorted(rationales) != list(range(1, 41)):
        raise ValueError(f"Rationales incomplete for Chapter 1-2 PDF. Parsed {sorted(rationales)}")
    return rationales


def build_ch1_ch2_rows(text: str) -> list[list[str | int]]:
    questions = parse_ch1_ch2_questions(text)
    answers = parse_ch1_ch2_answer_key(text)
    rationales = parse_ch1_ch2_rationales(text)

    rows: list[list[str | int]] = []
    for question in questions:
        number = int(question["number"])
        rows.append(
            [
                question["question"],
                question["choice_1"],
                question["choice_2"],
                question["choice_3"],
                question["choice_4"],
                {"A": 1, "B": 2, "C": 3, "D": 4}[answers[number]],
                rationales[number],
                "Medium",
                SUBJECT,
                chapter_for_question(number),
                TOPIC,
            ]
        )
    return rows


def parse_ch3_questions(text: str) -> list[dict[str, str]]:
    question_section = text.split("PART 2: ANSWER KEY", 1)[0]
    rows: list[dict[str, str]] = []
    for number, block in split_numbered_blocks(question_section):
        parsed = parse_mcq_block(number, block)
        rows.append({"number": str(number), **parsed})

    expected = [str(i) for i in range(1, 41)]
    actual = [row["number"] for row in rows]
    if actual != expected:
        raise ValueError(f"Question numbering mismatch for Chapter 3 PDF. Expected 1-40, got {actual}.")
    return rows


def parse_ch3_answer_key(text: str) -> dict[int, str]:
    if "PART 2: ANSWER KEY" not in text:
        raise ValueError("Answer key section not found for Chapter 3 PDF.")
    section = text.split("PART 2: ANSWER KEY", 1)[1]
    answers = {int(number): letter for number, letter in re.findall(r"(\d+)\.\s*([A-D])", section)}
    if sorted(answers) != list(range(1, 41)):
        answers = {int(number): letter for number, letter in re.findall(r"(?m)^\s*(\d+)\.\s*Correct Answer:\s*([A-D])\s*$", text)}
    if sorted(answers) != list(range(1, 41)):
        raise ValueError(f"Answer key incomplete for Chapter 3 PDF. Parsed {sorted(answers)}")
    return answers


def parse_ch3_rationales(text: str) -> dict[int, str]:
    matches = list(re.finditer(r"(\d+)\.\s*Correct Answer:\s*([A-D])", text))
    rationales: dict[int, str] = {}
    for index, match in enumerate(matches):
        number = int(match.group(1))
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[start:end]
        rationale_match = re.search(r"Rationale:\s*(.*?)(?=(?:Incorrect:|High-Yield Concept:|$))", block, flags=re.DOTALL)
        if not rationale_match:
            raise ValueError(f"Missing rationale for question {number} in Chapter 3 PDF.")
        rationales[number] = clean_text(rationale_match.group(1))
    if sorted(rationales) != list(range(1, 41)):
        raise ValueError(f"Rationales incomplete for Chapter 3 PDF. Parsed {sorted(rationales)}")
    return rationales


def build_ch3_rows(text: str) -> list[list[str | int]]:
    questions = parse_ch3_questions(text)
    answers = parse_ch3_answer_key(text)
    rationales = parse_ch3_rationales(text)

    rows: list[list[str | int]] = []
    for question in questions:
        number = int(question["number"])
        rows.append(
            [
                question["question"],
                question["choice_1"],
                question["choice_2"],
                question["choice_3"],
                question["choice_4"],
                {"A": 1, "B": 2, "C": 3, "D": 4}[answers[number]],
                rationales[number],
                "Medium",
                SUBJECT,
                "Chapter 3",
                TOPIC,
            ]
        )
    return rows


def validate_combined(rows: list[list[str | int]]) -> None:
    if len(rows) != 80:
        raise ValueError(f"Unexpected total row count. Expected 80, got {len(rows)}.")

    chapter_counts = Counter(str(row[9]) for row in rows)
    if dict(chapter_counts) != EXPECTED_CHAPTER_COUNTS:
        raise ValueError(f"Chapter counts mismatch. Expected {EXPECTED_CHAPTER_COUNTS}, got {dict(chapter_counts)}.")

    seen_keys: set[tuple[str, str]] = set()
    for row in rows:
        chapter = str(row[9]).strip()
        question = str(row[0]).strip()
        topic = str(row[10]).strip()
        if not question or not chapter or not topic:
            raise ValueError(f"Incomplete row detected: {row}")
        if topic != TOPIC:
            raise ValueError(f"Topic mismatch. Expected `{TOPIC}`, got `{topic}`")
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
        f"Chapter 1: {chapter_counts['Chapter 1']} questions | topic `{TOPIC}`",
        f"Chapter 2: {chapter_counts['Chapter 2']} questions | topic `{TOPIC}`",
        f"Chapter 3: {chapter_counts['Chapter 3']} questions | topic `{TOPIC}`",
        "Topic was replaced with `special` for all rows as requested.",
        "Validated no duplicate chapter/question pairs and no missing questions based on expected chapter counts.",
    ]
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    text_1_2 = CH1_CH2_TEXT_PATH.read_text(encoding="utf-8", errors="replace")
    text_3 = CH3_TEXT_PATH.read_text(encoding="utf-8", errors="replace")

    rows = build_ch1_ch2_rows(text_1_2) + build_ch3_rows(text_3)
    validate_combined(rows)
    write_csv(rows)
    write_report(rows)
    print(f"Wrote {len(rows)} rows to {CSV_PATH}")
    print(f"Report saved to {REPORT_PATH}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import fitz


SUBJECT_NAME = "Industrial/Organizational Psychology"

# Chapter 1's visible title is incomplete in the PDF text layer, so we use a
# normalized chapter title based on the chapter's content.
FALLBACK_CHAPTER_TITLES = {
    1: "Foundations and History of Industrial/Organizational Psychology",
}


@dataclass
class ChapterSection:
    chapter_number: int
    title: str
    quiz_title: str
    text: str
    skipped_reason: str = ""


def normalize_text(value: str) -> str:
    value = value.replace("\u200b", " ")
    value = value.replace("\u2013", "-")
    value = value.replace("\u2014", "-")
    value = value.replace("\u2018", "'").replace("\u2019", "'")
    value = value.replace("\u201c", '"').replace("\u201d", '"')
    value = value.replace("\xa0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\r\n?", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def get_page_texts(pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    return [normalize_text(page.get_text("text")) for page in doc]


def find_chapter_separator_pages(page_texts: list[str]) -> list[tuple[int, int]]:
    separators: list[tuple[int, int]] = []
    for index, text in enumerate(page_texts):
        match = re.fullmatch(r"CHAPTER\s+(\d+)", text.strip(), re.IGNORECASE)
        if match:
            separators.append((index, int(match.group(1))))
    if not separators:
        raise ValueError("No chapter separator pages were found in the PDF.")
    return separators


def extract_chapter_title(chapter_number: int, chapter_text: str) -> str:
    patterns = [
        rf"SHORT QUIZ:\s*Industrial/Organizational Psychology\s*-\s*Chapter\s*{chapter_number}\s*:\s*(.+?)(?=\n\s*(?:Question\s+1:|1\.)|\Z)",
        rf"SHORT QUIZ:\s*INDUSTRIAL/ORGANIZATIONAL PSYCHOLOGY\s*CHAPTER\s*{chapter_number}\s*:?(.+?)(?=\n\s*(?:Question\s+1:|1\.)|\Z)",
        rf"Industrial/Organizational Psychology\s*-\s*Chapter\s*{chapter_number}\s*:\s*(.+?)(?=\n\s*(?:Question\s+1:|1\.)|\Z)",
    ]
    for pattern in patterns:
        match = re.search(pattern, chapter_text, re.IGNORECASE | re.DOTALL)
        if match:
            title = match.group(1).strip()
            title = re.sub(r"\s+", " ", title)
            if title and not title.lower().startswith("question 1:"):
                return title
    return FALLBACK_CHAPTER_TITLES.get(chapter_number, f"Chapter {chapter_number}")


def build_chapter_sections(page_texts: list[str]) -> list[ChapterSection]:
    separators = find_chapter_separator_pages(page_texts)
    sections: list[ChapterSection] = []

    for idx, (page_index, chapter_number) in enumerate(separators):
        next_page_index = separators[idx + 1][0] if idx + 1 < len(separators) else len(page_texts)
        chapter_pages = page_texts[page_index + 1 : next_page_index]
        chapter_text = normalize_text("\n\n".join(chapter_pages))
        chapter_text = re.sub(r"\(\s*Continuing\.\.\.\s*\)", "", chapter_text, flags=re.IGNORECASE)
        title = extract_chapter_title(chapter_number, chapter_text)
        quiz_title = f"{SUBJECT_NAME} - Chapter {chapter_number}: {title}"
        sections.append(
            ChapterSection(
                chapter_number=chapter_number,
                title=title,
                quiz_title=quiz_title,
                text=chapter_text,
            )
        )

    chapter_numbers = [section.chapter_number for section in sections]
    if len(chapter_numbers) != len(set(chapter_numbers)):
        raise ValueError("Duplicate chapters detected while building chapter sections.")
    return sections


def find_question_blocks(chapter_text: str) -> list[tuple[int, str]]:
    pattern = re.compile(
        r"(?m)^(?:Question\s+(\d+):|(\d+)\.\s)(.*?)(?=^(?:Question\s+\d+:|\d+\.\s)|\Z)",
        re.DOTALL,
    )
    blocks: list[tuple[int, str]] = []
    for match in pattern.finditer(chapter_text):
        number = int(match.group(1) or match.group(2))
        content = (match.group(0) or "").strip()
        blocks.append((number, content))
    return blocks


def collapse_ws(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_question_block(block: str) -> dict[str, str]:
    rationale_match = re.search(r"Rationale:\s*(.+)$", block, re.DOTALL | re.IGNORECASE)
    rationale = collapse_ws(rationale_match.group(1)) if rationale_match else ""
    if rationale_match:
        block = block[: rationale_match.start()].strip()

    answer_letter = ""
    answer_text = ""

    inline_answer = re.search(r"\(\s*Answer:\s*([A-D])\.\s*(.*?)\)", block, re.DOTALL | re.IGNORECASE)
    if inline_answer:
        answer_letter = inline_answer.group(1).upper()
        answer_text = collapse_ws(inline_answer.group(2))
        block = (block[: inline_answer.start()] + " " + block[inline_answer.end() :]).strip()
    else:
        answer_match = re.search(r"Answer:\s*([A-D])\.\s*(.+)$", block, re.DOTALL | re.IGNORECASE)
        if answer_match:
            answer_letter = answer_match.group(1).upper()
            answer_text = collapse_ws(answer_match.group(2))
            block = block[: answer_match.start()].strip()

    stem = re.sub(r"^(?:Question\s+\d+:|\d+\.)\s*", "", block).strip()
    option_pattern = re.compile(
        r"(?m)^\s*([A-D])\.\s*(.*?)(?=^\s*[A-D]\.\s|^\s*Answer:|\Z)",
        re.DOTALL,
    )
    options = {letter: "" for letter in "ABCD"}
    option_matches = list(option_pattern.finditer(stem))
    if not option_matches:
        raise ValueError(f"Could not find answer choices in question block: {block[:200]}")

    question_text = stem[: option_matches[0].start()].strip()
    for match in option_matches:
        letter = match.group(1).upper()
        options[letter] = collapse_ws(match.group(2))

    if not answer_text and answer_letter in options:
        answer_text = options[answer_letter]

    return {
        "question_text": collapse_ws(question_text),
        "option_a": options["A"],
        "option_b": options["B"],
        "option_c": options["C"],
        "option_d": options["D"],
        "correct_answer": answer_letter,
        "correct_answer_number": str({"A": 1, "B": 2, "C": 3, "D": 4}[answer_letter]) if answer_letter else "",
        "correct_answer_text": answer_text,
        "rationale": rationale,
    }


def rows_from_sections(sections: list[ChapterSection]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    for section in sections:
        blocks = find_question_blocks(section.text)
        if not blocks:
            section.skipped_reason = "No extractable questions found in the PDF for this chapter."
            continue

        seen_numbers: set[int] = set()
        for question_number, block in blocks:
            if question_number in seen_numbers:
                raise ValueError(
                    f"Duplicate question number {question_number} in chapter {section.chapter_number}."
                )
            seen_numbers.add(question_number)

            parsed = parse_question_block(block)
            row = {
                "subject": SUBJECT_NAME,
                "chapter_number": str(section.chapter_number),
                "chapter": f"Chapter {section.chapter_number}",
                "subtopic": section.title,
                "quiz_title": section.quiz_title,
                "question_number": str(question_number),
                **parsed,
            }
            rows.append(row)

    return rows


def validate_rows(rows: list[dict[str, str]]) -> None:
    if not rows:
        raise ValueError("The CSV would be empty.")

    chapter_titles: dict[str, str] = {}
    seen_keys: set[tuple[str, str]] = set()

    for row in rows:
        chapter = row["chapter"]
        subtopic = row["subtopic"]
        if not chapter or not subtopic or not row["quiz_title"]:
            raise ValueError(f"Missing chapter metadata on row: {row}")

        if chapter in chapter_titles and chapter_titles[chapter] != subtopic:
            raise ValueError(
                f"Inconsistent chapter title for {chapter}: '{chapter_titles[chapter]}' vs '{subtopic}'."
            )
        chapter_titles[chapter] = subtopic

        key = (row["chapter_number"], row["question_number"])
        if key in seen_keys:
            raise ValueError(f"Duplicate chapter/question pair detected: {key}")
        seen_keys.add(key)

        if not row["question_text"] or not row["correct_answer"]:
            raise ValueError(f"Incomplete question row detected: {row}")

        correct_text = row["correct_answer_text"]
        if not correct_text:
            raise ValueError(f"Missing correct answer text on row: {row}")


def validate_sections(sections: list[ChapterSection], rows: list[dict[str, str]]) -> None:
    included = {row["chapter_number"] for row in rows}
    for section in sections:
        if section.skipped_reason:
            continue
        if str(section.chapter_number) not in included:
            raise ValueError(f"Chapter {section.chapter_number} did not produce any rows.")


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
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
    with output_path.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "Question": row["question_text"],
                    "Choice 1": row["option_a"],
                    "Choice 2": row["option_b"],
                    "Choice 3": row["option_c"],
                    "Choice 4": row["option_d"],
                    "Correct Answer (1-4)": row["correct_answer_number"],
                    "Explanation": row["rationale"],
                    "Difficulty": "Medium",
                    "Subject": row["subject"],
                    "Chapter": row["chapter"],
                    "Topic": row["subtopic"],
                }
            )


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python scripts/convert_io_psych_quiz_pdf.py <input_pdf> <output_csv>")
        return 1

    input_pdf = Path(sys.argv[1])
    output_csv = Path(sys.argv[2])

    page_texts = get_page_texts(input_pdf)
    sections = build_chapter_sections(page_texts)
    rows = rows_from_sections(sections)
    validate_sections(sections, rows)
    validate_rows(rows)
    write_csv(rows, output_csv)

    print(f"Wrote {len(rows)} rows to {output_csv}")
    for section in sections:
        question_count = sum(1 for row in rows if row["chapter_number"] == str(section.chapter_number))
        if section.skipped_reason:
            print(f"Chapter {section.chapter_number}: {section.title} -> SKIPPED ({section.skipped_reason})")
        else:
            print(f"Chapter {section.chapter_number}: {section.title} -> {question_count} questions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

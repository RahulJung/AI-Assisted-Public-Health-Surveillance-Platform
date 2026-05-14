from __future__ import annotations

import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "technical_whitepaper.md"
OUTPUT = ROOT / "docs" / "AI_Assisted_Public_Health_Surveillance_Platform_Whitepaper.pdf"


def clean_inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font name='Courier'>\1</font>", text)
    return text


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(0.75 * inch, 0.45 * inch, "AI-Assisted Public Health Surveillance Platform Technical Whitepaper")
    canvas.drawRightString(7.75 * inch, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitlePage",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=24,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Subtitle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1Custom",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0f172a"),
            spaceBefore=18,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2Custom",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#0f766e"),
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyCustom",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#1e293b"),
            alignment=TA_LEFT,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletCustom",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#1e293b"),
            leftIndent=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="QuoteCustom",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=15,
            leftIndent=18,
            rightIndent=18,
            textColor=colors.HexColor("#475569"),
            borderColor=colors.HexColor("#0f766e"),
            borderWidth=1,
            borderPadding=8,
            spaceBefore=8,
            spaceAfter=10,
        )
    )
    return styles


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    index = start
    while index < len(lines) and lines[index].strip().startswith("|"):
        raw = lines[index].strip().strip("|")
        cells = [cell.strip() for cell in raw.split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            rows.append(cells)
        index += 1
    return rows, index


def append_paragraph(story, paragraph_lines, styles):
    if not paragraph_lines:
        return
    text = " ".join(line.strip() for line in paragraph_lines).strip()
    if text:
        story.append(Paragraph(clean_inline(text), styles["BodyCustom"]))


def markdown_to_story(markdown: str):
    styles = build_styles()
    story = []
    lines = markdown.splitlines()
    index = 0
    paragraph: list[str] = []

    title = lines[0].lstrip("# ").strip() if lines and lines[0].startswith("# ") else "Technical Whitepaper"
    story.append(Spacer(1, 1.45 * inch))
    story.append(Paragraph(clean_inline(title), styles["TitlePage"]))
    story.append(Paragraph("Research whitepaper for a synthetic AI/ML public health surveillance prototype", styles["Subtitle"]))
    story.append(Paragraph("Synthetic data only. Not for clinical or operational public health decision-making.", styles["Subtitle"]))
    story.append(PageBreak())
    index = 1 if lines and lines[0].startswith("# ") else 0

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if not stripped:
            append_paragraph(story, paragraph, styles)
            paragraph = []
            index += 1
            continue

        if stripped.startswith("```"):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            index += 1
            code_lines = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            index += 1
            story.append(Preformatted("\n".join(code_lines), styles["Code"]))
            story.append(Spacer(1, 8))
            continue

        if stripped.startswith("|"):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            rows, index = parse_table(lines, index)
            if rows:
                table_data = [[Paragraph(clean_inline(cell), styles["BodyCustom"]) for cell in row] for row in rows]
                table = Table(table_data, repeatRows=1, hAlign="LEFT")
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cbd5e1")),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 6),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                            ("TOPPADDING", (0, 0), (-1, -1), 5),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ]
                    )
                )
                story.append(table)
                story.append(Spacer(1, 10))
            continue

        if stripped.startswith("## "):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            story.append(Paragraph(clean_inline(stripped[3:]), styles["H1Custom"]))
            index += 1
            continue

        if stripped.startswith("### "):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            story.append(Paragraph(clean_inline(stripped[4:]), styles["H2Custom"]))
            index += 1
            continue

        if stripped.startswith("> "):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            story.append(Paragraph(clean_inline(stripped[2:]), styles["QuoteCustom"]))
            index += 1
            continue

        if stripped.startswith("- "):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            items = []
            while index < len(lines) and lines[index].strip().startswith("- "):
                item_text = clean_inline(lines[index].strip()[2:])
                items.append(ListItem(Paragraph(item_text, styles["BulletCustom"])))
                index += 1
            story.append(ListFlowable(items, bulletType="bullet", leftIndent=18))
            story.append(Spacer(1, 4))
            continue

        if re.match(r"^\d+\. ", stripped):
            append_paragraph(story, paragraph, styles)
            paragraph = []
            items = []
            while index < len(lines) and re.match(r"^\d+\. ", lines[index].strip()):
                item_text = re.sub(r"^\d+\. ", "", lines[index].strip())
                items.append(ListItem(Paragraph(clean_inline(item_text), styles["BulletCustom"])))
                index += 1
            story.append(ListFlowable(items, bulletType="1", leftIndent=18))
            story.append(Spacer(1, 4))
            continue

        if stripped.startswith("**") and stripped.endswith("**") and len(stripped) > 4:
            append_paragraph(story, paragraph, styles)
            paragraph = []
            story.append(Paragraph(clean_inline(stripped), styles["BodyCustom"]))
            index += 1
            continue

        paragraph.append(line)
        index += 1

    append_paragraph(story, paragraph, styles)
    return story


def main() -> int:
    if not SOURCE.exists():
        print(f"Missing source: {SOURCE}", file=sys.stderr)
        return 1
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    markdown = SOURCE.read_text(encoding="utf-8")
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.7 * inch,
        title="AI-Assisted Public Health Surveillance Platform Technical Whitepaper",
        author="AI-Assisted Public Health Surveillance Platform",
    )
    doc.build(markdown_to_story(markdown), onFirstPage=page_footer, onLaterPages=page_footer)
    print(OUTPUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

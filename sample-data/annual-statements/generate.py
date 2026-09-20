"""Generate entirely fictional annual-income-statement fixtures for Milestone 16B."""
from pathlib import Path
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).parent
ROOT.mkdir(parents=True, exist_ok=True)

BASE = [
    "ANNUAL INCOME STATEMENT v1",
    "Employer: Harbour Example Services",
    "Financial year: 2026-27",
    "Statement date: 2027-07-14",
    "Source reference: Harbour payroll A",
    "Status: Tax ready",
    "Gross income: 8250.00",
    "Tax withheld: 1315.00",
    "Allowances: 0.00",
    "Lump sums: none",
    "Reportable fringe benefits: none",
    "Reportable employer super: none",
    "Other employment payments: none",
    "FICTIONAL DATA ONLY",
]

def pdf(name, lines):
    path = ROOT / name
    c = canvas.Canvas(str(path), pagesize=(700, 760), invariant=1)
    y = 710
    for i, line in enumerate(lines):
        c.setFont("Helvetica-Bold" if i == 0 else "Helvetica", 14 if i == 0 else 11)
        c.drawString(45, y, line)
        y -= 42
    c.showPage()
    c.save()

def png(name, lines, poor=False):
    image = Image.new("RGB", (1400, 1500), "white")
    draw = ImageDraw.Draw(image)
    y = 80
    for line in lines:
        draw.text((80, y), line, fill=(35, 35, 35))
        y += 92
    if poor:
        image = image.resize((700, 750)).resize((1400, 1500)).filter(ImageFilter.GaussianBlur(1.4))
    image.save(ROOT / name)

pdf("supported-final.pdf", BASE)
png("supported-final.png", BASE)
pdf("ambiguous-gross.pdf", BASE + ["Gross income: 9000.00"])
pdf("invalid-date.pdf", [line if not line.startswith("Statement date:") else "Statement date: 2027-02-30" for line in BASE])
pdf("unsupported-extra.pdf", [line if not line.startswith("Allowances:") else "Allowances: 150.00" for line in BASE])
png("poor-ocr.png", BASE, poor=True)
print("Generated fictional Milestone 16B fixtures.")

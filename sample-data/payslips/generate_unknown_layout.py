"""One fictional payslip in a layout this app deliberately does not understand.

Every other sample here matches a documented format, which means none of them
can exercise the path that matters for the assisted reader: a real employer's
layout, which is to say one nobody wrote a parser for. This is that file.

It prints no format marker, uses its own wording, and lays the figures out in a
way none of the three parsers detect — so the app falls through to the assisted
reader exactly as it would for a payslip from an actual employer.

Invented employer, invented person, invented figures.

    python3 sample-data/payslips/generate_unknown_layout.py
"""
import base64, io, json, pathlib
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = pathlib.Path(__file__).parent

def build() -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    c.setTitle("Fictional payslip - unknown layout")
    width, height = A4
    y = height - 70

    c.setFont("Helvetica-Bold", 15)
    c.drawString(60, y, "Unknown Layout Example Pty Ltd"); y -= 18
    c.setFont("Helvetica", 9)
    c.drawString(60, y, "Remittance of wages - fictional sample, not a real payslip"); y -= 30

    c.setFont("Helvetica", 10)
    for label, value in [
        ("Paid to", "A. Example"),
        ("Covering", "01 Jul 2026 through 14 Jul 2026"),
        ("Banked on", "16 Jul 2026"),
    ]:
        c.drawString(60, y, f"{label}: {value}"); y -= 15
    y -= 12

    # Deliberately not a "This pay / Year to date" table and not one labelled
    # line per figure: a shape of its own, as a real employer's would be.
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, y, "Earnings and deductions"); y -= 16
    c.setFont("Helvetica", 10)
    for text in [
        "Ordinary time  64.00 units @ 31.2500 .......... 2,000.00",
        "Less PAYG instalment ......................... (300.00)",
        "Less other ....................................... (0.00)",
        "Amount banked ................................ 1,700.00",
        "Employer superannuation contribution ........... 230.00",
    ]:
        c.drawString(60, y, text); y -= 15
    y -= 12
    c.setFont("Helvetica", 8)
    c.drawString(60, y, "Fictional sample generated for testing. No real employer, employee or payment.")
    c.showPage(); c.save()
    return buffer.getvalue()


if __name__ == "__main__":
    pdf = build()
    (HERE / "unknown-layout-example.json").write_text(json.dumps({
        "name": "unknown-layout-example.pdf",
        "note": "A fictional payslip in no documented layout, for the assisted reader path.",
        "pdfBase64": base64.b64encode(pdf).decode(),
    }, indent=2) + "\n")
    print(f"wrote unknown-layout-example.json ({len(pdf)} bytes of PDF)")

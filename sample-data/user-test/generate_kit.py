"""Materials for the Milestone 18 user test. Entirely fictional, as every fixture here is.

The test asks whether someone who suspects they have been short-paid can turn
that suspicion into a specific, dated, arithmetic question, unaided, in one
sitting. It needs a contract stating a rate and a run of payslips, one of
which does not match it.

  Agreed rate   $32.50/hour from 1 July 2026, clause 4.1
  Payslip 1     60.00 h at 32.50 = 1,950.00
  Payslip 2     64.00 h at 32.50 = 2,080.00
  Payslip 3     58.00 h at 32.50 = 1,885.00
  Payslip 4     62.00 h at 30.75 = 1,906.50   <- the short one
                62.00 h at the agreed 32.50 would be 2,015.00, so $108.50 less

$1.75 an hour is chosen deliberately. It is small enough to be missed by
someone glancing at a net figure, and it does not make the payslip look
obviously wrong: payslip 4's own hours and rate multiply out correctly, so
only a comparison with the contract, or with the earlier payslips, finds it.

The materials are PAY ADVICE v3 so the reader fills in hours and rate without
retyping. That is the path a real user would take; testing manual entry is a
separate question.

Run: python3 generate_kit.py   (writes PDFs into files/)
"""
import io
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("KitSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("KitBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

out = Path(__file__).parent / "files"
out.mkdir(exist_ok=True)

EMPLOYER = "Kestrel Example Hospitality"
AGREED = "32.50"
INK, MUTED, RULE, BRAND = HexColor("#2b2338"), HexColor("#66616b"), HexColor("#e0dde6"), HexColor("#2f2673")

# Same geometry as the v3 fixtures: the heading anchors sit near the centres of
# the figures below them, because the reader matches a figure to a column by
# the centre of its text.
HOURS_RIGHT, RATE_RIGHT, CURRENT_RIGHT, YTD_RIGHT = 250, 330, 430, 545
HOURS_X, RATE_X, CURRENT_X, YTD_X = 214, 297, 399, 470
TOTALS_CURRENT_X, TOTALS_YTD_X = 360, 470


def banner(c, title, subtitle):
    c.setFillColor(BRAND); c.rect(0, 730, 595, 112, fill=1, stroke=0)
    c.setFillColor(HexColor("#ffffff")); c.setFont("KitBold", 22)
    c.drawString(44, 788, title)
    c.setFont("KitSans", 11)
    c.drawString(44, 758, subtitle)


def contract():
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(595, 842), invariant=1)
    c.setTitle("Fictional employment contract - TaxPrep AU user test")
    banner(c, "EMPLOYMENT CONTRACT", "FICTIONAL - created for a usability test. No real employer, employee or agreement.")

    c.setFillColor(INK); c.setFont("KitBold", 13)
    c.drawString(44, 686, f"Between {EMPLOYER} and the employee")
    c.setFont("KitSans", 11)
    c.drawString(44, 662, "Casual hospitality employee. Commencing 1 July 2026.")
    c.setStrokeColor(RULE); c.line(44, 646, 551, 646)

    y = 612
    clauses = [
        ("3. Hours", ["Hours are offered by roster and vary from week to week.",
                      "There is no guaranteed minimum number of hours."]),
        ("4. Pay", [f"4.1  The ordinary hourly rate is ${AGREED} per hour, effective 1 July 2026.",
                    "4.2  Pay is made fortnightly, in arrears, by bank transfer.",
                    "4.3  Overtime and penalty rates are set by the applicable award and",
                    "     are not stated in this document."]),
        ("5. Review", ["The ordinary rate is reviewed annually. Any change is confirmed in",
                       "writing before it takes effect."]),
    ]
    for heading, lines in clauses:
        c.setFont("KitBold", 12); c.drawString(44, y, heading); y -= 22
        c.setFont("KitSans", 11)
        for line in lines:
            c.drawString(44, y, line); y -= 18
        y -= 14

    c.setFillColor(MUTED); c.setFont("KitSans", 10)
    c.drawString(44, 150, "This document exists only to give a usability-test participant a rate to work from.")
    c.drawString(44, 132, "It is not a real contract and states no real terms of employment.")
    c.showPage(); c.save()
    (out / "contract.pdf").write_bytes(stream.getvalue())


def advice(number, start, end, paid, hours, rate, gross, withheld, net, ytd_ordinary, ytd_gross, ytd_withheld, ytd_net):
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(595, 842), invariant=1)
    c.setTitle("Fictional pay advice - TaxPrep AU user test")
    banner(c, "PAY ADVICE v3", "FICTIONAL - created for a usability test. No real employer or employee.")

    c.setFillColor(INK); c.setFont("KitSans", 12)
    c.drawString(44, 690, f"Employer: {EMPLOYER}")
    c.drawString(44, 666, f"Pay period: {start} to {end}")
    c.drawString(44, 642, f"Payment date: {paid}")

    c.setFont("KitBold", 11)
    c.drawString(44, 600, "Earnings")
    c.drawString(HOURS_X, 600, "Hours"); c.drawString(RATE_X, 600, "Rate")
    c.drawString(CURRENT_X, 600, "This pay"); c.drawString(YTD_X, 600, "Year to date")
    c.setStrokeColor(INK); c.line(44, 592, 551, 592)

    c.setFont("KitSans", 11)
    c.drawString(44, 570, "Ordinary hours")
    c.drawRightString(HOURS_RIGHT, 570, hours)
    c.drawRightString(RATE_RIGHT, 570, rate)
    c.drawRightString(CURRENT_RIGHT, 570, gross)
    c.drawRightString(YTD_RIGHT, 570, ytd_ordinary)
    c.setStrokeColor(RULE); c.line(44, 562, 551, 562)

    y = 510
    c.setFont("KitBold", 11)
    c.drawString(44, y, "Description")
    c.drawString(TOTALS_CURRENT_X, y, "This pay"); c.drawString(TOTALS_YTD_X, y, "Year to date")
    c.setStrokeColor(INK); c.line(44, y - 8, 551, y - 8)

    y -= 30
    c.setFont("KitSans", 11)
    for description, current, ytd in [("Gross earnings", gross, ytd_gross),
                                      ("PAYG withholding", withheld, ytd_withheld),
                                      ("Other deductions", "0.00", "0.00"),
                                      ("Net pay", net, ytd_net)]:
        c.drawString(44, y, description)
        c.drawRightString(CURRENT_RIGHT, y, current)
        c.drawRightString(YTD_RIGHT, y, ytd)
        c.setStrokeColor(RULE); c.line(44, y - 8, 551, y - 8)
        y -= 30

    c.setFillColor(MUTED); c.setFont("KitSans", 10)
    c.drawString(44, y - 20, "Year-to-date figures are cumulative and must not be summed across pay advices.")
    c.drawString(44, y - 40, "Superannuation is reported separately and is not shown on this advice.")
    c.drawString(44, y - 60, "Fictional document created for a usability test.")
    c.showPage(); c.save()
    (out / f"payslip-{number}.pdf").write_bytes(stream.getvalue())


contract()
# hours, rate, gross, withheld, net — and running year-to-date totals.
runs = [
    (1, "01/07/2026", "14/07/2026", "16/07/2026", "60.00", "32.50", "1,950.00", "285.00", "1,665.00"),
    (2, "15/07/2026", "28/07/2026", "30/07/2026", "64.00", "32.50", "2,080.00", "318.00", "1,762.00"),
    (3, "29/07/2026", "11/08/2026", "13/08/2026", "58.00", "32.50", "1,885.00", "270.00", "1,615.00"),
    # The short one. Its own hours and rate multiply out correctly; only the
    # rate itself is below what the contract states.
    (4, "12/08/2026", "25/08/2026", "27/08/2026", "62.00", "30.75", "1,906.50", "275.00", "1,631.50"),
]
money = lambda v: float(v.replace(",", ""))
fmt = lambda v: f"{v:,.2f}"
gross_ytd = withheld_ytd = net_ytd = 0.0
for number, start, end, paid, hours, rate, gross, withheld, net in runs:
    gross_ytd += money(gross); withheld_ytd += money(withheld); net_ytd += money(net)
    advice(number, start, end, paid, hours, rate, gross, withheld, net,
           fmt(gross_ytd), fmt(gross_ytd), fmt(withheld_ytd), fmt(net_ytd))
    assert abs(money(gross) - money(withheld) - money(net)) < 0.005, number
    assert abs(money(hours) * money(rate) - money(gross)) < 0.005, number

print(f"wrote {len(list(out.glob('*.pdf')))} fictional PDFs into {out}")

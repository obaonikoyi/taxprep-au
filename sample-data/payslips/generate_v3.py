"""Independent fictional PAY ADVICE v3 payslips. Never use private payroll data as fixtures.

v3 is the v2 tabular advice with an itemised earnings block above the totals,
so each line carries hours and a rate beside its amount. That block is the
only place TaxPrep can learn what rate a payslip claims to have paid.

The three files are built to exercise the three outcomes that matter:

  1. an advice whose ordinary line agrees with its own hours and rate;
  2. one paid at a lower rate than the agreed rate a user would record;
  3. one whose ordinary line does NOT agree with its own hours and rate, and
     which also carries an overtime line that must never be rate-checked.

Year-to-date figures are large and unrelated throughout, so a reader that
confused the columns would produce obviously wrong totals rather than
plausible ones.
"""
import base64
import io
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("SampleSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("SampleBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

root = Path(__file__).parent

# Right edges. Amounts are right-aligned, which is exactly why the reader
# matches a figure to a column by the centre of its text, not its left edge.
HOURS_RIGHT, RATE_RIGHT = 250, 330
CURRENT_RIGHT, YTD_RIGHT = 430, 545
# Header positions. The reader anchors on the centre of the FIRST word of each
# heading, so each heading is placed where that word's centre lands near the
# centres of the figures below it — not merely somewhere above the column. The
# earnings block therefore sits its "This pay" further right than the totals
# table below, whose narrower two-column layout keeps v2's tested geometry.
HOURS_X, RATE_X, CURRENT_X, YTD_X = 214, 297, 399, 470
TOTALS_CURRENT_X, TOTALS_YTD_X = 360, 470

TOTALS_YTD = ['48,912.00', '9,884.00', '640.00', '38,388.00', '5,624.00']

specs = [
    # 1 · Ordinary line agrees with its own hours and rate: 38.00 x 28.90.
    dict(name='Riverbend Example Cafe', start='01/07/2026', end='14/07/2026', paid='16/07/2026',
         earnings=[('Ordinary hours', '38.00', '28.90', '1,098.20', '32,946.00')],
         gross='1,098.20', withheld='152.00', deductions='20.00', net='926.20', superann='126.29'),
    # 2 · Internally consistent, but paid at 27.50 rather than an agreed 28.90.
    dict(name='Riverbend Example Cafe', start='15/07/2026', end='28/07/2026', paid='30/07/2026',
         earnings=[('Ordinary hours', '38.00', '27.50', '1,045.00', '33,991.00')],
         gross='1,045.00', withheld='138.00', deductions='20.00', net='887.00', superann='120.18'),
    # 3 · 38.00 x 28.90 is 1,098.20, but the ordinary line reads 1,080.00.
    #     The overtime line is deliberately correct on its own terms and must
    #     never be checked against an agreed ordinary rate.
    dict(name='Tallow Example Logistics', start='01/07/2026', end='14/07/2026', paid='16/07/2026',
         earnings=[('Ordinary hours', '38.00', '28.90', '1,080.00', '34,120.00'),
                   ('Overtime', '4.00', '43.35', '173.40', '4,120.00')],
         gross='1,253.40', withheld='196.00', deductions='25.00', net='1,032.40', superann='144.14'),
]

result = []
for number, spec in enumerate(specs, 1):
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(595, 842), invariant=1)
    c.setTitle('Fictional pay advice - TaxPrep AU')

    c.setFillColor(HexColor('#2f2673')); c.rect(0, 730, 595, 112, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('SampleBold', 22)
    c.drawString(44, 788, 'PAY ADVICE v3')
    c.setFont('SampleSans', 11)
    c.drawString(44, 758, 'Fictional example - no real employee or employer')

    c.setFillColor(HexColor('#2b2338')); c.setFont('SampleSans', 12)
    c.drawString(44, 690, f"Employer: {spec['name']}")
    c.drawString(44, 666, f"Pay period: {spec['start']} to {spec['end']}")
    c.drawString(44, 642, f"Payment date: {spec['paid']}")

    # Earnings block. Its header is what tells the reader where hours and rate
    # live; the reader requires all four column words before it reads anything.
    c.setFont('SampleBold', 11)
    c.drawString(44, 600, 'Earnings')
    c.drawString(HOURS_X, 600, 'Hours')
    c.drawString(RATE_X, 600, 'Rate')
    c.drawString(CURRENT_X, 600, 'This pay')
    c.drawString(YTD_X, 600, 'Year to date')
    c.setStrokeColor(HexColor('#2b2338')); c.line(44, 592, 551, 592)

    y = 570
    c.setFont('SampleSans', 11)
    for description, hours, rate, amount, ytd in spec['earnings']:
        c.drawString(44, y, description)
        c.drawRightString(HOURS_RIGHT, y, hours)
        c.drawRightString(RATE_RIGHT, y, rate)
        c.drawRightString(CURRENT_RIGHT, y, amount)
        c.drawRightString(YTD_RIGHT, y, ytd)
        c.setStrokeColor(HexColor('#e0dde6')); c.line(44, y - 8, 551, y - 8)
        y -= 30

    # Totals table. Its header carries no Hours column, which is how the
    # reader keeps the two tables apart.
    y -= 26
    c.setFont('SampleBold', 11)
    c.drawString(44, y, 'Description')
    c.drawString(TOTALS_CURRENT_X, y, 'This pay')
    c.drawString(TOTALS_YTD_X, y, 'Year to date')
    c.setStrokeColor(HexColor('#2b2338')); c.line(44, y - 8, 551, y - 8)

    rows = [
        ('Gross earnings', spec['gross'], TOTALS_YTD[0]),
        ('PAYG withholding', spec['withheld'], TOTALS_YTD[1]),
        ('Other deductions', spec['deductions'], TOTALS_YTD[2]),
        ('Net pay', spec['net'], TOTALS_YTD[3]),
        ('Superannuation', spec['superann'], TOTALS_YTD[4]),
    ]
    y -= 30
    c.setFont('SampleSans', 11)
    for description, current, ytd in rows:
        c.drawString(44, y, description)
        c.drawRightString(CURRENT_RIGHT, y, current)
        c.drawRightString(YTD_RIGHT, y, ytd)
        c.setStrokeColor(HexColor('#e0dde6')); c.line(44, y - 8, 551, y - 8)
        y -= 30

    c.setFillColor(HexColor('#66616b')); c.setFont('SampleSans', 10)
    c.drawString(44, y - 20, 'Year-to-date figures are cumulative and must not be summed across pay advices.')
    c.drawString(44, y - 40, 'Overtime and penalty lines depend on an award and are not checked against an agreed ordinary rate.')
    c.drawString(44, y - 60, 'Amounts illustrate document reading, not approved payroll or tax calculations.')

    c.showPage(); c.save()
    data = stream.getvalue()
    result.append({'name': f'example-advice-v3-{number}.pdf', 'pdfBase64': base64.b64encode(data).decode('ascii')})
    Path(f'/tmp/taxprep-pay-advice-v3-example-{number}.pdf').write_bytes(data)

(root / 'advice-v3-examples.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'wrote advice-v3-examples.json with {len(result)} fictional pay advices')

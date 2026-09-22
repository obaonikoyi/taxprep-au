"""Independent fictional PAY ADVICE v2 payslips. Never use private payroll data as fixtures.

This layout is tabular: every amount row carries a current-period figure and a
year-to-date figure side by side. The YTD column is deliberately large and
unrelated, so any reader that confused the columns would produce obviously
wrong totals instead of plausible ones.
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
CURRENT_RIGHT = 430   # right edge of the "This pay" column
YTD_RIGHT = 545       # right edge of the "Year to date" column

# employer, period start, period end, payment date, gross, withheld, deductions, net, super
specs = [
    ('Riverbend Example Cafe', '01/07/2026', '14/07/2026', '16/07/2026',
     '1,640.00', '212.00', '35.00', '1,393.00', '188.60'),
    ('Riverbend Example Cafe', '15/07/2026', '28/07/2026', '30/07/2026',
     '1,845.50', '268.00', '35.00', '1,542.50', '212.23'),
    # Third file omits super entirely: the row is absent, so the field stays
    # unknown rather than being invented as zero.
    ('Tallow Example Logistics', '01/07/2026', '31/07/2026', '31/07/2026',
     '4,200.00', '912.00', '0.00', '3,288.00', None),
]

# Cumulative figures that must never reach a total.
YTD = ['48,912.00', '9,884.00', '640.00', '38,388.00', '5,624.00']

result = []
for number, spec in enumerate(specs, 1):
    employer, start, end, pay_date, gross, withheld, deductions, net, superann = spec
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(595, 842), invariant=1)
    c.setTitle('Fictional pay advice - Xoba Paycheck')

    c.setFillColor(HexColor('#173f35')); c.rect(0, 730, 595, 112, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('SampleBold', 22)
    c.drawString(44, 788, 'PAY ADVICE v2')
    c.setFont('SampleSans', 11)
    c.drawString(44, 758, 'Fictional example - no real employee or employer')

    c.setFillColor(HexColor('#173f35')); c.setFont('SampleSans', 12)
    c.drawString(44, 690, f'Employer: {employer}')
    c.drawString(44, 666, f'Pay period: {start} to {end}')
    c.drawString(44, 642, f'Payment date: {pay_date}')

    # Column headers. The parser anchors on these, so their position is the
    # contract; the amounts below are right-aligned under them.
    c.setFont('SampleBold', 11)
    c.drawString(44, 596, 'Description')
    c.drawString(360, 596, 'This pay')
    c.drawString(470, 596, 'Year to date')
    c.setStrokeColor(HexColor('#173f35')); c.line(44, 588, 551, 588)

    rows = [
        ('Gross earnings', gross, YTD[0]),
        ('PAYG withholding', withheld, YTD[1]),
        ('Other deductions', deductions, YTD[2]),
        ('Net pay', net, YTD[3]),
    ]
    if superann is not None:
        rows.append(('Superannuation', superann, YTD[4]))

    y = 564
    c.setFont('SampleSans', 11)
    for description, current, ytd in rows:
        c.drawString(44, y, description)
        c.drawRightString(CURRENT_RIGHT, y, current)
        c.drawRightString(YTD_RIGHT, y, ytd)
        c.setStrokeColor(HexColor('#dce6df')); c.line(44, y - 8, 551, y - 8)
        y -= 34

    c.setFillColor(HexColor('#63776f')); c.setFont('SampleSans', 10)
    c.drawString(44, y - 26, 'Year-to-date figures are cumulative and must not be summed across pay advices.')
    c.drawString(44, y - 46, 'Amounts illustrate document reading, not approved payroll or tax calculations.')
    c.drawString(44, y - 66, 'Super shown here is not confirmation that a fund received a payment.')

    c.showPage(); c.save()
    data = stream.getvalue()
    result.append({'name': f'example-advice-{number}.pdf', 'pdfBase64': base64.b64encode(data).decode('ascii')})
    Path(f'/tmp/taxprep-pay-advice-example-{number}.pdf').write_bytes(data)

(root / 'advice-examples.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'wrote advice-examples.json with {len(result)} fictional pay advices')

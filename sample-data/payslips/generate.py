"""Independent fictional payslips. Never use private payroll data as fixtures.

Each summary also states its ordinary hours, hourly rate and the pay for those
hours, so the example journey can demonstrate the rate checks. The fourth
Harbour payslip drops from 30.00 to 28.50 an hour with nothing recorded to
explain it: that is the question the example is built to raise. Its ordinary
line still agrees with its own hours and rate, so the payslip is internally
consistent and the question is still worth asking.
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
specs = [
    ('Harbour Example Services', '2026-07-01', '2026-07-14', '2026-07-16', '1800.00', '250.00', '20.00', '1530.00', '216.00', '60.00', '30.00', '1800.00'),
    ('Harbour Example Services', '2026-07-15', '2026-07-28', '2026-07-30', '2100.00', '340.00', '20.00', '1740.00', '252.00', '70.00', '30.00', '2100.00'),
    ('Harbour Example Services', '2026-07-29', '2026-08-11', '2026-08-13', '1950.00', '295.00', '20.00', '1635.00', '234.00', '65.00', '30.00', '1950.00'),
    # The rate drops here, and nothing in the example records a change.
    ('Harbour Example Services', '2026-08-12', '2026-08-25', '2026-08-27', '2400.00', '430.00', '20.00', '1950.00', '288.00', '80.00', '28.50', '2280.00'),
    ('Garden Example Studio', '2026-07-01', '2026-07-31', '2026-07-31', '1000.00', '100.00', '0.00', '900.00', '120.00', '40.00', '25.00', '1000.00'),
    ('Garden Example Studio', '2026-08-01', '2026-08-31', '2026-08-31', '1200.00', '140.00', '0.00', '1060.00', '', '48.00', '25.00', '1200.00'),
]
labels = ['Employer', 'Period start', 'Period end', 'Pay date', 'Gross pay', 'Tax withheld', 'Other deductions', 'Net pay', 'Super recorded',
          'Ordinary hours', 'Hourly rate', 'Pay for those hours']
result = []
for number, spec in enumerate(specs, 1):
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(595, 842), invariant=1)
    c.setTitle('Fictional payslip summary - Xoba Paycheck')
    c.setFillColor(HexColor('#173f35')); c.rect(0, 708, 595, 134, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('SampleBold', 22)
    c.drawString(44, 779, 'PAYSLIP SUMMARY v1')
    c.setFont('SampleSans', 11); c.drawString(44, 747, 'Fictional example - no real employee or employer')
    c.setFillColor(HexColor('#173f35'))
    y = 672
    for label, value in zip(labels, spec):
        c.setFont('SampleSans', 12); c.drawString(44, y, f'{label}: {value}')
        c.setStrokeColor(HexColor('#dce6df')); c.line(44, y-12, 551, y-12)
        y -= 34
    c.setFont('SampleSans', 11)
    c.drawString(44, 235, 'YTD gross pay: 99999.00')
    c.drawString(44, 211, 'YTD tax withheld: 19999.00')
    c.setFillColor(HexColor('#63776f')); c.setFont('SampleSans', 10)
    c.drawString(44, 155, 'YTD figures are cumulative and must not be summed across payslips.')
    c.drawString(44, 135, 'Amounts illustrate document reading, not approved payroll or tax calculations.')
    c.drawString(44, 115, 'Super shown here is not confirmation that a fund received a payment.')
    c.showPage(); c.save()
    data = stream.getvalue()
    result.append({'name': f'example-pay-{number}.pdf', 'pdfBase64': base64.b64encode(data).decode('ascii')})
    Path(f'/tmp/taxprep-payslip-example-{number}.pdf').write_bytes(data)
(root / 'examples.json').write_text(json.dumps(result, indent=2) + '\n')

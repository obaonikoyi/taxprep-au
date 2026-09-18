"""Reproducible fictional receipt fixture; JSON keeps fixtures text-only in Git."""
from io import BytesIO
import base64, json
from pathlib import Path
from reportlab.pdfgen import canvas
out=BytesIO()
c=canvas.Canvas(out,pagesize=(600,420),invariant=1)
c.setFont('Helvetica-Bold',18); c.drawString(40,375,'FICTIONAL RECEIPT - DEMO ONLY')
c.setFont('Helvetica',16)
for y,line in zip([320,280,240,200],['Merchant: Sunrise Mobile Services','Date: 2025-08-14','Description: Monthly phone service','Total: AUD 45.00']): c.drawString(40,y,line)
c.setFont('Helvetica',12); c.drawString(40,100,'Synthetic test document. No real account or identity details.')
c.showPage(); c.save()
Path(__file__).with_name('receipt.json').write_text(json.dumps({'pdfBase64':base64.b64encode(out.getvalue()).decode()},indent=2)+'\n')

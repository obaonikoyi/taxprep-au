"""Entirely invented statement data. No values, counterparties or identities copied from uploads."""
from io import BytesIO
from pathlib import Path
from reportlab.pdfgen import canvas
import json,base64
rows=[]
for month in ['Jul','Aug','Sep']:
 rows.extend([(f'02 {month}','PAYROLL Example Studio',420000),(f'03 {month}','Transfer to savings',-80000),(f'04 {month}','Example Supermarket',-14865),(f'06 {month}','Sunrise Mobile service',-5500),(f'09 {month}','Metro transport',-4210),(f'12 {month}','Example Software Plan',-2400),(f'15 {month}','Neighbourhood Cafe',-2850),(f'19 {month}','Example Retail Store',-13900),(f'21 {month}','Card repayment',-25000),(f'23 {month}','Example Workshop course',-12000)])
rows.extend([('25 Sep','Refund Example Retail Store',4900),('26 Sep','Harbour Repairs',-9750),('26 Sep','Harbour Repairs',-9750)])
fmt=lambda c:f'{abs(c)/100:,.2f}'
def make(empty=False,bad=False):
 out=BytesIO();c=canvas.Canvas(out,pagesize=(595,842),invariant=1)
 items=[] if empty else rows;opening=0 if empty else 125000;balance=opening;debits=sum(-a for _,_,a in items if a<0);credits=sum(a for _,_,a in items if a>0)
 def page(first):
  c.setFont('Helvetica-Bold',14);c.drawString(55,796,'FICTIONAL STATEMENT - DEMO ONLY')
  c.setFont('Helvetica',10);c.drawString(55,772,'Synthetic CommBank-style column layout; no bank endorsement.')
  if first:c.drawString(55,750,'Statement Period 1 Jul 2025 - 30 Sep 2025')
  c.setFillColorRGB(.93,.96,.95);c.rect(50,694,498,22,fill=1,stroke=0);c.setFillColorRGB(.07,.22,.18)
  c.setFont('Helvetica-Bold',10)
  for x,t in [(58,'Date'),(91,'Transaction')]:c.drawString(x,701,t)
  for x,t in [(389,'Debit'),(442,'Credit'),(540,'Balance')]:c.drawRightString(x,701,t)
  c.setFont('Helvetica',9)
 page(True);y=678
 c.drawString(58,y,'01 Jul');c.drawString(91,y,'2025 OPENING BALANCE');c.drawRightString(540,y,'Nil' if empty else fmt(balance)+' CR');y-=24
 for i,(date,desc,amount) in enumerate(items):
  if y<180:c.showPage();page(False);y=678
  if i%2:c.drawString(58,y,date+' '+desc)
  else:c.drawString(58,y,date);c.drawString(91,y,desc)
  if i==14:
   # Description/amount continuation crosses a page boundary.
   c.showPage();page(False);y=678;c.drawString(91,y,'Payment for the month')
  if 'Mobile' in desc:y-=13;c.drawString(91,y,'Value Date: 01/'+{'Jul':'07','Aug':'08','Sep':'09'}[date[-3:]]+'/2025')
  balance+=amount;c.drawRightString(389 if amount<0 else 442,y,fmt(amount));c.drawRightString(540,y,fmt(balance)+(' CR' if balance>0 else ' DR' if balance<0 else ''))
  y-=27
 c.drawString(58,y,'30 Sep');c.drawString(91,y,'2025 CLOSING BALANCE');c.drawRightString(540,y,'Nil' if empty else fmt(balance)+' CR');y-=35
 c.setFont('Helvetica',9);c.drawString(55,y,'Opening balance - Total debits   Total credits = Closing balance');y-=20
 for x,value in [(95,opening),(225,debits+(1 if bad else 0)),(350,credits),(490,balance)]:c.drawRightString(x,y,'Nil' if empty else fmt(value))
 c.showPage();c.save();return out.getvalue()
root=Path(__file__).parent
for name,empty,bad in [('example',False,False),('empty',True,False),('mismatch',False,True)]:
 data=make(empty,bad);(root/(name+'.json')).write_text(json.dumps({'pdfBase64':base64.b64encode(data).decode()},indent=2)+'\n')
 # Reproducible binary is generated into ignored temporary output for visual verification only.
 p=Path('/tmp/taxprep-synthetic-'+name+'.pdf');p.write_bytes(data)
Path('src/frontend/public/samples/statement.json').write_text((root/'example.json').read_text())

"""One fictional payslip as a picture, the way most people actually have one.

Every other sample here is a PDF with its own text. That is not what is on
anybody's phone: a payslip arrives as a photo, or as a scan an employer emailed,
and the app's answer to both used to be "type these twelve figures yourself".

This writes a PNG of a PAYSLIP SUMMARY v1 payslip, so the picture path can be
proved end to end: recognise the words on the device, then read them with the
documented parser that would have read the PDF. Deliberately a documented
layout, because that is what proves the recognised words reach the same parser
and produce the same figures — not a different, looser path.

It is drawn cleanly rather than photographed badly. A test that depends on how
well a recogniser copes with a crooked, shadowed phone photo is a test that
fails for reasons that have nothing to do with this app.

Invented employer, invented person, invented figures.

    python3 sample-data/payslips/generate_photo_example.py
"""
import base64, io, json, pathlib
from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).parent
WIDTH, HEIGHT = 1240, 1754  # A4 at 150dpi, the shape a scan comes out as.

FACTS = {
    "Employer": "Wattle Grove Example Cafe",
    "Period start": "2026-07-01",
    "Period end": "2026-07-14",
    "Pay date": "2026-07-16",
    "Gross pay": "1840.00",
    "Tax withheld": "286.00",
    "Other deductions": "0.00",
    "Net pay": "1554.00",
    "Super recorded": "211.60",
    "Ordinary hours": "80.00",
    "Hourly rate": "23.00",
    "Pay for those hours": "1840.00",
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/{name}", size)


def build() -> bytes:
    image = Image.new("RGB", (WIDTH, HEIGHT), "white")
    draw = ImageDraw.Draw(image)
    y = 110

    draw.text((90, y), "PAYSLIP SUMMARY v1", font=font(40, bold=True), fill="black")
    y += 70
    draw.text((90, y), "Fictional sample. Not a real payslip.", font=font(24), fill="black")
    y += 70

    for label, value in FACTS.items():
        draw.text((90, y), f"{label}: {value}", font=font(30), fill="black")
        y += 52

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


if __name__ == "__main__":
    png = build()
    (HERE / "photo-example.json").write_text(json.dumps({
        "name": "payslip-photo.png",
        "note": "Fictional payslip drawn as a picture, for the on-device recogniser.",
        "facts": FACTS,
        "pngBase64": base64.b64encode(png).decode(),
    }, indent=2) + "\n")
    print(f"photo-example.json written ({len(png)} bytes of PNG)")

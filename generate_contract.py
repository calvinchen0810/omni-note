from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1240, 1754  # A4 at 150dpi

img = Image.new("RGB", (W, H), "#ffffff")
draw = ImageDraw.Draw(img)

MARGIN = 100
LINE_COLOR = "#cccccc"
TEXT_DARK = "#1a1a1a"
TEXT_GRAY = "#555555"
TEXT_LIGHT = "#888888"

def find_font(size, bold=False):
    candidates_bold = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in (candidates_bold if bold else candidates):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

f_title  = find_font(38, bold=True)
f_h2     = find_font(22, bold=True)
f_body   = find_font(18)
f_small  = find_font(15)
f_label  = find_font(16, bold=True)
f_meta   = find_font(16)

def text(x, y, s, font, color=TEXT_DARK):
    draw.text((x, y), s, font=font, fill=color)

def hline(y, x0=MARGIN, x1=W - MARGIN, color=LINE_COLOR, width=1):
    draw.line([(x0, y), (x1, y)], fill=color, width=width)

def section_line(y):
    draw.line([(MARGIN, y), (W - MARGIN, y)], fill="#333333", width=2)

# ── Header ────────────────────────────────────────────────────────────────────
text(MARGIN, 80, "FREELANCE SERVICE AGREEMENT", f_title, TEXT_DARK)
hline(132, width=3)

# ── Parties ───────────────────────────────────────────────────────────────────
text(MARGIN, 155, "PARTIES", f_h2, TEXT_DARK)
hline(185)

text(MARGIN, 198, "Client:", f_label)
text(MARGIN + 130, 198, "Acme Corporation Ltd., 350 Fifth Avenue, New York, NY 10118", f_body, TEXT_GRAY)

text(MARGIN, 228, "Service Provider:", f_label)
text(MARGIN + 200, 228, "________________________________", f_body, TEXT_GRAY)

text(MARGIN, 258, "Effective Date:", f_label)
text(MARGIN + 175, 258, "________________________________", f_body, TEXT_GRAY)

# ── Services ──────────────────────────────────────────────────────────────────
section_line(300)
text(MARGIN, 318, "1.  SCOPE OF SERVICES", f_h2, TEXT_DARK)
hline(348)

services = [
    "The Service Provider agrees to perform the following services for the Client:",
    "",
    "   (a)  Design and development of user interface components as specified in",
    "         Exhibit A attached hereto.",
    "   (b)  Delivery of all source files, assets, and documentation upon project",
    "         completion.",
    "   (c)  Up to two (2) rounds of revisions based on Client feedback.",
]
y = 362
for line in services:
    text(MARGIN, y, line, f_body, TEXT_GRAY)
    y += 30

# ── Payment ───────────────────────────────────────────────────────────────────
section_line(y + 10)
text(MARGIN, y + 28, "2.  PAYMENT TERMS", f_h2, TEXT_DARK)
hline(y + 58)
y += 72

payment = [
    "Total Project Fee:  USD $4,500.00",
    "",
    "   •  50% deposit due upon signing of this Agreement.",
    "   •  Remaining 50% due upon final delivery and Client approval.",
    "   •  Invoices unpaid after 14 days accrue interest at 1.5% per month.",
]
for line in payment:
    text(MARGIN, y, line, f_body, TEXT_GRAY)
    y += 30

# ── Confidentiality ───────────────────────────────────────────────────────────
section_line(y + 10)
text(MARGIN, y + 28, "3.  CONFIDENTIALITY", f_h2, TEXT_DARK)
hline(y + 58)
y += 72

conf = [
    "Both parties agree to keep confidential all non-public information received",
    "from the other party during the term of this Agreement and for two (2) years",
    "thereafter. This obligation does not apply to information that is publicly",
    "available or independently developed.",
]
for line in conf:
    text(MARGIN, y, line, f_body, TEXT_GRAY)
    y += 30

# ── IP ────────────────────────────────────────────────────────────────────────
section_line(y + 10)
text(MARGIN, y + 28, "4.  INTELLECTUAL PROPERTY", f_h2, TEXT_DARK)
hline(y + 58)
y += 72

ip = [
    "Upon receipt of full payment, the Service Provider assigns to the Client all",
    "intellectual property rights in the deliverables. The Service Provider retains",
    "the right to display the work in their portfolio.",
]
for line in ip:
    text(MARGIN, y, line, f_body, TEXT_GRAY)
    y += 30

# ── Termination ───────────────────────────────────────────────────────────────
section_line(y + 10)
text(MARGIN, y + 28, "5.  TERMINATION", f_h2, TEXT_DARK)
hline(y + 58)
y += 72

term = [
    "Either party may terminate this Agreement with 14 days written notice.",
    "The Client shall pay for all work completed up to the termination date.",
]
for line in term:
    text(MARGIN, y, line, f_body, TEXT_GRAY)
    y += 30

# ── Signature block ───────────────────────────────────────────────────────────
sig_y = H - 280
section_line(sig_y)
text(MARGIN, sig_y + 18, "SIGNATURES", f_h2, TEXT_DARK)
hline(sig_y + 48)

col1 = MARGIN
col2 = W // 2 + 40
sig_start = sig_y + 70

# Left — Client
text(col1, sig_start, "CLIENT", f_label)
hline(sig_start + 60, x0=col1, x1=col1 + 380)
text(col1, sig_start + 68, "Authorized Signature", f_small, TEXT_LIGHT)

text(col1, sig_start + 100, "Name:", f_label)
hline(sig_start + 138, x0=col1, x1=col1 + 380)
text(col1, sig_start + 146, "Print Name", f_small, TEXT_LIGHT)

text(col1, sig_start + 178, "Date:", f_label)
hline(sig_start + 216, x0=col1, x1=col1 + 380)

# Right — Service Provider
text(col2, sig_start, "SERVICE PROVIDER", f_label)
hline(sig_start + 60, x0=col2, x1=col2 + 380)
text(col2, sig_start + 68, "Authorized Signature", f_small, TEXT_LIGHT)

text(col2, sig_start + 100, "Name:", f_label)
hline(sig_start + 138, x0=col2, x1=col2 + 380)
text(col2, sig_start + 146, "Print Name", f_small, TEXT_LIGHT)

text(col2, sig_start + 178, "Date:", f_label)
hline(sig_start + 216, x0=col2, x1=col2 + 380)

# ── Footer ────────────────────────────────────────────────────────────────────
hline(H - 50)
text(MARGIN, H - 38, "Freelance Service Agreement  •  Confidential  •  Page 1 of 1", f_small, TEXT_LIGHT)

out = "/home/user/omni-note/static/contract_template.png"
img.save(out, "PNG")
print(f"Saved: {out}  ({W}×{H})")

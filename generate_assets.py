"""
Generate all video shoot assets for OmniNote promo scenes 1–5.
Output: assets_for_video/
"""

import os, json, math, textwrap
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = "assets_for_video"
os.makedirs(OUT, exist_ok=True)

W, H = A4  # 595 x 842 pt

# ── helpers ────────────────────────────────────────────────────────────────────

def new_pdf(name):
    path = os.path.join(OUT, name)
    c = rl_canvas.Canvas(path, pagesize=A4)
    return c, path

def rule(c, y, color=(0.85, 0.85, 0.85), width=W - 80):
    c.setStrokeColorRGB(*color)
    c.setLineWidth(0.5)
    c.line(40, y, 40 + width, y)

def heading(c, text, y, size=22, color=(0.1, 0.1, 0.3)):
    c.setFont("Helvetica-Bold", size)
    c.setFillColorRGB(*color)
    c.drawString(40, y, text)

def body(c, text, x, y, size=11, color=(0.15, 0.15, 0.15), max_width=75):
    c.setFont("Helvetica", size)
    c.setFillColorRGB(*color)
    for line in textwrap.wrap(text, max_width):
        c.drawString(x, y, line)
        y -= size * 1.6
    return y

def checkbox(c, x, y, size=10):
    c.setStrokeColorRGB(0.3, 0.3, 0.3)
    c.setFillColorRGB(1, 1, 1)
    c.rect(x, y, size, size, stroke=1, fill=1)

def answer_line(c, x, y, w=400):
    c.setStrokeColorRGB(0.6, 0.6, 0.6)
    c.setLineWidth(0.8)
    c.line(x, y, x + w, y)

# ══════════════════════════════════════════════════════════════════════════════
# SCENE 2 — Exam paper (Biology Quiz)
# ══════════════════════════════════════════════════════════════════════════════

def page_header(c, page_num, total=2):
    c.setFillColorRGB(0.24, 0.27, 0.6)
    c.rect(0, H - 72, W, 72, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 19)
    c.setFillColorRGB(1, 1, 1)
    c.drawString(40, H - 34, "Biology Quiz — Cell Structure & Function")
    c.setFont("Helvetica", 10.5)
    c.drawString(40, H - 54, "Name: _________________________   Date: __________   Score: ______ / 100")
    c.setFont("Helvetica", 9)
    c.drawRightString(W - 30, H - 54, f"Page {page_num} / {total}")

def page_footer(c, text="Good luck!  —  OmniNote Demo Exam"):
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColorRGB(0.55, 0.55, 0.55)
    c.drawCentredString(W / 2, 24, text)


def make_exam():
    c, path = new_pdf("scene2_exam_biology.pdf")

    # ══════════════════════════════════════
    # PAGE 1
    # ══════════════════════════════════════
    page_header(c, 1)
    y = H - 95

    # ── Section A: Multiple Choice (4 questions, 2 options each row) ──────────
    heading(c, "Section A  Multiple Choice  (40 pts)", y, size=13, color=(0.24, 0.27, 0.6))
    y -= 5; rule(c, y, color=(0.24, 0.27, 0.6)); y -= 20

    mc = [
        ("1.", "Which organelle produces ATP?",
         ["A.  Nucleus", "B.  Mitochondria", "C.  Ribosome", "D.  Golgi apparatus"]),
        ("2.", "Plant cells have ___ that animal cells do not.",
         ["A.  Centrioles", "B.  Cell wall", "C.  Ribosomes", "D.  Mitochondria"]),
        ("3.", "Osmosis is the movement of ___ across a membrane.",
         ["A.  Glucose", "B.  Proteins", "C.  Water", "D.  Oxygen"]),
        ("4.", "Which process does NOT require energy (ATP)?",
         ["A.  Active transport", "B.  Endocytosis", "C.  Diffusion", "D.  Exocytosis"]),
    ]

    for num, q, opts in mc:
        c.setFont("Helvetica-Bold", 11)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(40, y, f"{num}  {q}")
        y -= 18
        # Two options per row
        for row in range(2):
            for col in range(2):
                idx = row * 2 + col
                ox = 56 + col * 240
                checkbox(c, ox, y - 2, 9)
                c.setFont("Helvetica", 10.5)
                c.setFillColorRGB(0.2, 0.2, 0.2)
                c.drawString(ox + 14, y, opts[idx])
            y -= 17
        y -= 12

    # ── Section B: Fill in the Blank (6 sentences) ───────────────────────────
    y -= 8
    heading(c, "Section B  Fill in the Blank  (30 pts)", y, size=13, color=(0.24, 0.27, 0.6))
    y -= 5; rule(c, y, color=(0.24, 0.27, 0.6)); y -= 20

    blanks = [
        ("5.", "The _______________ is the control center of the cell and contains DNA."),
        ("6.", "Chloroplasts are found only in _______________ cells and carry out photosynthesis."),
        ("7.", "The _______________ bilayer makes up the basic structure of the cell membrane."),
        ("8.", "Ribosomes are responsible for synthesizing _______________."),
        ("9.", "The process of a cell engulfing a large particle is called _______________."),
        ("10.", "Cells without a membrane-bound nucleus are called _______________."),
    ]

    for num, sent in blanks:
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColorRGB(0.15, 0.15, 0.15)
        c.drawString(40, y, num)
        c.setFont("Helvetica", 10.5)
        c.drawString(62, y, sent)
        y -= 26

    page_footer(c)

    # ══════════════════════════════════════
    # PAGE 2
    # ══════════════════════════════════════
    c.showPage()
    page_header(c, 2)
    y = H - 95

    # ── Section C: Matching (連連看) ─────────────────────────────────────────
    heading(c, "Section C  Matching  (30 pts)", y, size=13, color=(0.24, 0.27, 0.6))
    y -= 5; rule(c, y, color=(0.24, 0.27, 0.6)); y -= 18

    c.setFont("Helvetica", 10.5)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(40, y, "Draw a line to match each organelle on the left with its correct function on the right.")
    y -= 28

    left_items = [
        "11.  Mitochondria",
        "12.  Ribosome",
        "13.  Golgi apparatus",
        "14.  Vacuole",
        "15.  Cell membrane",
        "16.  Nucleus",
    ]
    right_items = [
        "A.  Packages and ships proteins",
        "B.  Controls what enters/exits the cell",
        "C.  Stores water and maintains turgor pressure",
        "D.  Site of protein synthesis",
        "E.  Contains DNA and controls cell activities",
        "F.  Produces ATP through cellular respiration",
    ]

    row_h = 38
    left_x  = 50
    right_x = 310
    col_w_l = 200
    col_w_r = 240
    dot_r   = 5

    # Column headers
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.24, 0.27, 0.6)
    c.drawString(left_x, y, "Organelle")
    c.drawString(right_x, y, "Function")
    y -= 6
    c.setStrokeColorRGB(0.24, 0.27, 0.6)
    c.setLineWidth(0.8)
    c.line(left_x, y, left_x + col_w_l, y)
    c.line(right_x, y, right_x + col_w_r, y)
    y -= 14

    top_y = y
    for i, (lbl, func) in enumerate(zip(left_items, right_items)):
        cy_row = y - i * row_h

        # Left item box
        c.setFillColorRGB(0.94, 0.95, 1.0)
        c.setStrokeColorRGB(0.70, 0.73, 0.90)
        c.setLineWidth(0.8)
        c.roundRect(left_x, cy_row - 14, col_w_l, 22, 4, stroke=1, fill=1)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColorRGB(0.15, 0.15, 0.35)
        c.drawString(left_x + 8, cy_row - 7, lbl)

        # Right dot (connection point)
        dot_lx = left_x + col_w_l + 2
        c.setFillColorRGB(0.24, 0.27, 0.6)
        c.circle(dot_lx, cy_row - 3, dot_r, stroke=0, fill=1)

        # Right item box
        c.setFillColorRGB(1.0, 0.97, 0.92)
        c.setStrokeColorRGB(0.88, 0.78, 0.55)
        c.setLineWidth(0.8)
        c.roundRect(right_x, cy_row - 14, col_w_r, 22, 4, stroke=1, fill=1)
        c.setFont("Helvetica", 10.5)
        c.setFillColorRGB(0.20, 0.15, 0.05)
        c.drawString(right_x + 8, cy_row - 7, func)

        # Left dot on right column
        dot_rx = right_x - 2
        c.setFillColorRGB(0.80, 0.65, 0.25)
        c.circle(dot_rx, cy_row - 3, dot_r, stroke=0, fill=1)

    # Dashed line between columns (visual guide)
    mid_x = (left_x + col_w_l + right_x) / 2
    c.setStrokeColorRGB(0.75, 0.75, 0.75)
    c.setLineWidth(0.6)
    c.setDash(4, 4)
    c.line(mid_x, top_y + 6, mid_x, top_y - len(left_items) * row_h + row_h - 10)
    c.setDash()

    y -= len(left_items) * row_h + 18

    # Instruction note
    c.setFont("Helvetica-Oblique", 9.5)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawString(40, y, "Tip: Draw your connecting lines clearly from the blue dot (left) to the gold dot (right).")
    y -= 40

    # ── Score summary box ────────────────────────────────────────────────────
    c.setStrokeColorRGB(0.24, 0.27, 0.6)
    c.setFillColorRGB(0.96, 0.97, 1.0)
    c.setLineWidth(1)
    c.roundRect(40, y - 56, W - 80, 62, 6, stroke=1, fill=1)

    c.setFont("Helvetica-Bold", 11)
    c.setFillColorRGB(0.24, 0.27, 0.6)
    c.drawString(56, y - 10, "Score Summary")

    sections = [
        ("Section A  Multiple Choice", "40 pts", "______ / 40"),
        ("Section B  Fill in the Blank", "30 pts", "______ / 30"),
        ("Section C  Matching", "30 pts", "______ / 30"),
    ]
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    sx = 56
    for label, pts, blank in sections:
        c.drawString(sx, y - 26, label)
        c.drawString(sx + 220, y - 26, pts)
        c.drawString(sx + 310, y - 26, blank)
        y -= 16

    page_footer(c, "Good luck!  —  OmniNote Demo Exam  •  Page 2 / 2")

    c.save()
    print(f"✓  {path}")

# ══════════════════════════════════════════════════════════════════════════════
# SCENE 4 — Service Contract (for digital signature demo)
# ══════════════════════════════════════════════════════════════════════════════

def make_contract():
    c, path = new_pdf("scene4_service_contract.pdf")

    # Header
    c.setFillColorRGB(0.08, 0.08, 0.08)
    c.rect(0, H - 70, W, 70, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 18)
    c.setFillColorRGB(1, 1, 1)
    c.drawCentredString(W / 2, H - 30, "FREELANCE SERVICE AGREEMENT")
    c.setFont("Helvetica", 10)
    c.drawCentredString(W / 2, H - 50, "Contract No.  FSA-2024-0042")

    y = H - 95

    def section(title, content_lines, y):
        c.setFont("Helvetica-Bold", 12)
        c.setFillColorRGB(0.1, 0.1, 0.3)
        c.drawString(40, y, title)
        y -= 4
        rule(c, y, color=(0.1, 0.1, 0.3))
        y -= 16
        c.setFont("Helvetica", 10.5)
        c.setFillColorRGB(0.15, 0.15, 0.15)
        for line in content_lines:
            if line == "":
                y -= 6
                continue
            for wrapped in textwrap.wrap(line, 90):
                c.drawString(48, y, wrapped)
                y -= 14
        y -= 8
        return y

    y = section("1.  Parties", [
        'This Freelance Service Agreement (the "Agreement") is entered into as of  May 17, 2025',
        'between  Acme Design Studio (the "Client"),  located at  123 Innovation Ave, San Francisco, CA 94107,',
        'and  Jordan Lee (the "Service Provider"),  an independent contractor.',
    ], y)

    y = section("2.  Scope of Work", [
        "The Service Provider agrees to deliver the following services:",
        "  •  UI/UX design for mobile application (OmniNote v2.0)",
        "  •  Delivery of high-fidelity Figma prototypes for all core screens",
        "  •  Up to 3 rounds of revisions per screen based on Client feedback",
        "  •  Final asset export in PNG, SVG, and PDF formats",
        "",
        "All deliverables shall conform to the specifications detailed in Exhibit A.",
    ], y)

    y = section("3.  Timeline & Milestones", [
        "Milestone 1 — Wireframes:          June 1, 2025",
        "Milestone 2 — High-fidelity mockups: June 20, 2025",
        "Milestone 3 — Final delivery:        July 5, 2025",
    ], y)

    y = section("4.  Compensation", [
        "Client agrees to pay Service Provider a total fee of  USD $4,800,  disbursed as follows:",
        "  •  30% deposit ($1,440) upon signing of this Agreement",
        "  •  40% ($1,920) upon approval of Milestone 2",
        "  •  30% ($1,440) upon final delivery and acceptance",
        "",
        "Payments shall be made via bank transfer within 5 business days of each milestone.",
    ], y)

    y = section("5.  Intellectual Property", [
        "Upon receipt of full payment, Service Provider assigns all intellectual property rights",
        "in the deliverables to Client.  Service Provider retains the right to display the work",
        "in their portfolio with Client's written approval.",
    ], y)

    y = section("6.  Confidentiality", [
        "Both parties agree to keep confidential all non-public information exchanged during",
        "the course of this Agreement and for two (2) years thereafter.",
    ], y)

    y = section("7.  Termination", [
        "Either party may terminate this Agreement with 14 days' written notice.  In the event",
        "of termination, Client shall pay for all work completed up to the termination date.",
    ], y)

    # Signature block
    y -= 10
    rule(c, y + 4, color=(0.3, 0.3, 0.3))
    c.setFont("Helvetica-Bold", 12)
    c.setFillColorRGB(0.1, 0.1, 0.3)
    c.drawString(40, y - 14, "8.  Signatures")
    y -= 34

    # Left sig
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawString(50, y, "CLIENT")
    y -= 14
    c.drawString(50, y, "Acme Design Studio")
    y -= 50
    answer_line(c, 50, y, 200)
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(50, y - 13, "Authorised Signature")
    answer_line(c, 50, y - 30, 200)
    c.drawString(50, y - 43, "Printed Name & Title")
    answer_line(c, 50, y - 60, 200)
    c.drawString(50, y - 73, "Date")

    # Right sig
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    ry2 = y + 50 + 14
    c.drawString(320, ry2, "SERVICE PROVIDER")
    ry2 -= 14
    c.drawString(320, ry2, "Jordan Lee")
    ry2 -= 50
    answer_line(c, 320, ry2, 220)
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawString(320, ry2 - 13, "Signature")
    answer_line(c, 320, ry2 - 30, 220)
    c.drawString(320, ry2 - 43, "Printed Name")
    answer_line(c, 320, ry2 - 60, 220)
    c.drawString(320, ry2 - 73, "Date")

    # Footer
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.drawCentredString(W / 2, 22, "FSA-2024-0042  •  Page 1 of 1  •  OmniNote Demo Contract")

    c.save()
    print(f"✓  {path}")

# ══════════════════════════════════════════════════════════════════════════════
# SCENE 5 — Interior Design Reference Image (SVG)
# ══════════════════════════════════════════════════════════════════════════════

def make_reference_image():
    path = os.path.join(OUT, "scene5_room_reference.svg")
    # Skip regeneration — detailed SVG is maintained manually.
    if os.path.exists(path):
        print(f"✓  {path} (kept existing)")
        return
    print(f"⚠  {path} not found — please restore it manually")

# ══════════════════════════════════════════════════════════════════════════════
# SCENE 1 — Biology class notes (visual reference HTML)
# SCENE 3 — Mind map (visual reference HTML)
# ══════════════════════════════════════════════════════════════════════════════

def make_canvas_previews():
    # ---------- Scene 1: notes preview ----------
    html1 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Scene 1 — Canvas Preview: Biology Notes</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e8eaed; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 32px; }
  .page {
    background: white;
    width: 900px; min-height: 1160px;
    position: relative;
    font-family: 'Georgia', serif;
    box-shadow: 0 8px 40px rgba(0,0,0,.25);
    overflow: hidden;
  }
  /* ruled lines */
  .page::before {
    content: "";
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      to bottom, transparent 0px, transparent 39px, #b8d4f8 39px, #b8d4f8 40px
    );
    background-position: 0 60px;
    pointer-events: none;
  }
  .red-margin {
    position: absolute; left: 80px; top: 0; bottom: 0;
    border-left: 2px solid #f4a0a0;
  }
  .content { padding: 20px 40px 40px 100px; }
  .date { font-size: 13px; color: #666; margin-bottom: 4px; font-family: sans-serif; }
  h1 { font-size: 28px; color: #1a1a6e; margin-bottom: 8px; font-style: italic; line-height: 40px; }
  h2 { font-size: 18px; color: #2244aa; margin-top: 16px; margin-bottom: 4px; line-height: 40px; }
  .note-text { font-size: 16px; color: #1a1a2e; line-height: 40px; }
  .hl { background: #ffd60a55; padding: 0 3px; border-radius: 2px; }
  .hl2 { background: #7bf7a055; padding: 0 3px; border-radius: 2px; }
  .indent { padding-left: 28px; }
  .arrow { color: #4488cc; }
  .underline { text-decoration: underline; text-decoration-color: #e63946; }
  .star { color: #e63946; font-style: normal; }

  /* sticky note */
  .sticky {
    position: absolute;
    right: 40px; top: 200px;
    width: 200px; height: 160px;
    background: #fff6bf;
    border-radius: 6px;
    box-shadow: 2px 4px 12px rgba(0,0,0,.18);
    padding: 10px 12px;
    font-family: sans-serif; font-size: 13px; color: #333;
    transform: rotate(2.5deg);
  }
  .sticky-handle { height: 22px; background: rgba(0,0,0,0.08); margin: -10px -12px 8px; border-radius: 6px 6px 0 0; display: flex; align-items: center; padding: 0 10px; font-size: 11px; color: #888; }
  .sticky p { line-height: 1.55; }

  .sticky2 {
    position: absolute;
    right: 50px; top: 600px;
    width: 180px; height: 130px;
    background: #e3fafc;
    border-radius: 6px;
    box-shadow: 2px 4px 12px rgba(0,0,0,.15);
    padding: 10px 12px;
    font-family: sans-serif; font-size: 12.5px; color: #333;
    transform: rotate(-1.8deg);
  }

  .label { font-size: 10px; color: #888; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0; }
</style>
</head>
<body>
<div class="page">
  <div class="red-margin"></div>
  <div class="content">
    <div class="date">May 17, 2025  |  Period 3 — Biology</div>
    <h1>Cell Structure &amp; Function</h1>

    <h2>▸ The Cell — Basic Unit of Life</h2>
    <div class="note-text">
      All living things are made of <span class="hl">cells</span><br>
      <span class="indent arrow">→</span> <span class="indent">Two types: <span class="hl">Prokaryotic</span> &amp; <span class="hl2">Eukaryotic</span></span><br>
      <span class="indent">Prokaryotic = <span class="underline">no nucleus</span> (bacteria)</span><br>
      <span class="indent">Eukaryotic = <span class="underline">has nucleus</span> (plants, animals)</span>
    </div>

    <h2>▸ Key Organelles <span class="star">★</span></h2>
    <div class="note-text">
      <b>Nucleus</b> — <span class="hl">"Control center"</span>, contains DNA<br>
      <span class="indent">• Nuclear envelope = double membrane</span><br>
      <span class="indent">• Nucleolus → makes ribosomes</span><br>
      <b>Mitochondria</b> — <span class="hl">"Powerhouse"</span> → ATP production<br>
      <span class="indent">• Equation: C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + <b>ATP</b></span><br>
      <b>Ribosome</b> — protein synthesis (rough ER surface)<br>
      <b>Golgi Apparatus</b> — packages &amp; ships proteins<br>
      <b>Cell Membrane</b> — <span class="hl2">phospholipid bilayer</span> ← semi-permeable
    </div>

    <h2>▸ Plant vs. Animal Cells</h2>
    <div class="note-text">
      Plant cells ONLY have:<br>
      <span class="indent">✓ <span class="hl">Cell Wall</span>  ✓ Chloroplasts  ✓ Large vacuole</span><br>
      Animal cells ONLY have:<br>
      <span class="indent">✓ Centrioles (cell division)</span>
    </div>

    <h2>▸ Transport Across Membranes</h2>
    <div class="note-text">
      <b>Passive</b> (no energy): Diffusion, <span class="hl">Osmosis</span><br>
      <span class="indent">→ High conc. to low conc.</span><br>
      <b>Active</b> (needs ATP): pumps ions against gradient<br>
      <span class="indent star">★ Exam tip: osmosis = WATER only!</span>
    </div>
  </div>

  <!-- Sticky note 1 -->
  <div class="sticky">
    <div class="sticky-handle">⠿  Note</div>
    <p>⚠️ Remember to ask<br>teacher about<br><b>the ATP formula</b><br>— will it be on exam?</p>
  </div>

  <!-- Sticky note 2 -->
  <div class="sticky2">
    <div class="sticky-handle" style="background:rgba(0,0,0,0.06);">⠿  Reminder</div>
    <p>Review Ch. 4 p.78–92<br>before Friday!<br><br>🎯 Focus on osmosis diagram</p>
  </div>
</div>
</body>
</html>"""
    p1 = os.path.join(OUT, "scene1_canvas_preview.html")
    with open(p1, "w", encoding="utf-8") as f:
        f.write(html1)
    print(f"✓  {p1}")

    # ---------- Scene 3: mind map preview ----------
    html3 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Scene 3 — Canvas Preview: Mind Map</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #e8eaed; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .page {
    background: white; width: 1200px; height: 850px;
    position: relative; overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,.25);
    font-family: 'Segoe UI', Arial, sans-serif;
  }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .node {
    position: absolute;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    text-align: center;
    font-weight: 600;
    box-shadow: 0 3px 12px rgba(0,0,0,.15);
    cursor: default;
    padding: 8px 14px;
    line-height: 1.3;
  }
  .center {
    width: 160px; height: 60px;
    left: 520px; top: 395px;
    background: #6366f1; color: white;
    font-size: 16px;
    border-radius: 14px;
    box-shadow: 0 4px 20px rgba(99,102,241,.45);
  }
  .branch { font-size: 13px; width: 130px; min-height: 44px; }

  /* Copy — teal */
  .copy { background: #e0f7f4; color: #0e7c6e; border: 2px solid #4dd0c4; left: 180px; top: 145px; }
  .copy-sub { background: #f0fdfb; color: #0e7c6e; border: 1.5px solid #9ae8e0; font-weight: 400; font-size: 11.5px; width: 115px; }
  /* Design — purple */
  .design { background: #ede9fe; color: #5b21b6; border: 2px solid #a78bfa; left: 180px; top: 555px; }
  .design-sub { background: #f5f3ff; color: #5b21b6; border: 1.5px solid #c4b5fd; font-weight: 400; font-size: 11.5px; width: 115px; }
  /* Budget — orange */
  .budget { background: #fff7ed; color: #9a3412; border: 2px solid #fb923c; left: 870px; top: 145px; }
  .budget-sub { background: #fff9f5; color: #9a3412; border: 1.5px solid #fca97a; font-weight: 400; font-size: 11.5px; width: 115px; }
  /* Timeline — green */
  .timeline { background: #f0fdf4; color: #166534; border: 2px solid #4ade80; left: 870px; top: 555px; }
  .timeline-sub { background: #f5fef7; color: #166534; border: 1.5px solid #86efac; font-weight: 400; font-size: 11.5px; width: 115px; }
</style>
</head>
<body>
<div class="page">

  <svg id="lines" xmlns="http://www.w3.org/2000/svg">
    <!-- Center to Copy -->
    <path d="M 520 425 C 420 425 380 195 310 175" stroke="#4dd0c4" stroke-width="2.5" fill="none" opacity="0.7"/>
    <!-- Center to Design -->
    <path d="M 520 440 C 420 440 380 580 310 580" stroke="#a78bfa" stroke-width="2.5" fill="none" opacity="0.7"/>
    <!-- Center to Budget -->
    <path d="M 680 425 C 780 425 820 195 870 175" stroke="#fb923c" stroke-width="2.5" fill="none" opacity="0.7"/>
    <!-- Center to Timeline -->
    <path d="M 680 440 C 780 440 820 580 870 580" stroke="#4ade80" stroke-width="2.5" fill="none" opacity="0.7"/>

    <!-- Copy sub-branches -->
    <path d="M 245 148 C 180 120 150 95 115 85" stroke="#4dd0c4" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 180 170 C 115 170 90 175 55 178" stroke="#4dd0c4" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 245 198 C 180 220 150 240 115 248" stroke="#4dd0c4" stroke-width="1.8" fill="none" opacity="0.55"/>

    <!-- Design sub-branches -->
    <path d="M 245 558 C 180 530 150 510 115 498" stroke="#a78bfa" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 180 575 C 115 572 90 568 55 565" stroke="#a78bfa" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 245 598 C 180 618 150 635 115 642" stroke="#a78bfa" stroke-width="1.8" fill="none" opacity="0.55"/>

    <!-- Budget sub-branches -->
    <path d="M 1000 148 C 1060 120 1085 95 1100 85" stroke="#fb923c" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 1000 170 C 1060 168 1090 172 1120 175" stroke="#fb923c" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 1000 200 C 1060 220 1080 240 1100 248" stroke="#fb923c" stroke-width="1.8" fill="none" opacity="0.55"/>

    <!-- Timeline sub-branches -->
    <path d="M 1000 558 C 1060 528 1085 505 1100 495" stroke="#4ade80" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 1000 575 C 1060 572 1090 568 1120 565" stroke="#4ade80" stroke-width="1.8" fill="none" opacity="0.55"/>
    <path d="M 1000 600 C 1060 618 1080 638 1100 645" stroke="#4ade80" stroke-width="1.8" fill="none" opacity="0.55"/>
  </svg>

  <!-- Center node -->
  <div class="node center">✦ New Campaign</div>

  <!-- Branch: Copy -->
  <div class="node branch copy">📝 Copy</div>
  <div class="node branch copy-sub" style="left:18px;top:63px">Tagline ideas</div>
  <div class="node branch copy-sub" style="left:18px;top:150px">Blog posts ×3</div>
  <div class="node branch copy-sub" style="left:18px;top:220px">Social captions</div>

  <!-- Branch: Design -->
  <div class="node branch design">🎨 Design</div>
  <div class="node branch design-sub" style="left:18px;top:468px">Brand palette</div>
  <div class="node branch design-sub" style="left:18px;top:538px">Banner 1200×628</div>
  <div class="node branch design-sub" style="left:18px;top:612px">Video thumbnail</div>

  <!-- Branch: Budget -->
  <div class="node branch budget">💰 Budget</div>
  <div class="node branch budget-sub" style="left:1070px;top:63px">Total: $8,000</div>
  <div class="node branch budget-sub" style="left:1087px;top:148px">Ads 60%</div>
  <div class="node branch budget-sub" style="left:1070px;top:218px">Design 25%</div>

  <!-- Branch: Timeline -->
  <div class="node branch timeline">📅 Timeline</div>
  <div class="node branch timeline-sub" style="left:1070px;top:465px">Kick-off Jun 1</div>
  <div class="node branch timeline-sub" style="left:1087px;top:536px">Launch Jul 4</div>
  <div class="node branch timeline-sub" style="left:1070px;top:615px">Review Jul 18</div>

  <!-- Annotation sticky note -->
  <div style="position:absolute;right:400px;top:30px;background:#fff6bf;border-radius:8px;
              padding:8px 12px;font-size:12px;color:#555;width:165px;
              box-shadow:2px 3px 10px rgba(0,0,0,.15);transform:rotate(-2deg)">
    <div style="height:20px;background:rgba(0,0,0,0.07);margin:-8px -12px 8px;border-radius:8px 8px 0 0;"></div>
    💡 A/B test two taglines<br>before final launch!
  </div>
</div>
</body>
</html>"""
    p3 = os.path.join(OUT, "scene3_canvas_preview.html")
    with open(p3, "w", encoding="utf-8") as f:
        f.write(html3)
    print(f"✓  {p3}")

# ══════════════════════════════════════════════════════════════════════════════
# INDEX — summary HTML
# ══════════════════════════════════════════════════════════════════════════════

def make_index():
    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>OmniNote Video Assets</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 40px; color: #1a1a2e; }
  h1 { font-size: 28px; color: #6366f1; margin-bottom: 6px; }
  .sub { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
  .card { background: white; border-radius: 12px; padding: 22px 28px; margin-bottom: 18px;
          box-shadow: 0 2px 12px rgba(0,0,0,.08); border-left: 5px solid #6366f1; }
  .card h2 { font-size: 17px; margin-bottom: 10px; }
  .card table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  .card td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .card td:first-child { font-weight: 600; color: #374151; white-space: nowrap; width: 200px; }
  a { color: #6366f1; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
  .tag { display: inline-block; background: #ede9fe; color: #5b21b6;
         border-radius: 999px; padding: 1px 10px; font-size: 11px; margin-right: 4px; }
  .colors { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .color-chip { width: 22px; height: 22px; border-radius: 4px; border: 1px solid rgba(0,0,0,.1); }
</style>
</head>
<body>
<h1>📓 OmniNote — Video Shoot Assets</h1>
<p class="sub">All files for 5 promo short-video scenes. Open the HTML previews in a browser, import PDFs &amp; SVG into OmniNote.</p>

<div class="card" style="border-color:#4dd0c4">
  <h2>Scene 1 — Student Taking Class Notes (Hand-writing)</h2>
  <table>
    <tr><td>Canvas Preview</td><td><a href="scene1_canvas_preview.html">scene1_canvas_preview.html</a> — open in browser to see final canvas layout</td></tr>
    <tr><td>Background</td><td>Ruled  •  Line spacing 40 px  •  Margin line red</td></tr>
    <tr><td>Content to write</td><td>Biology notes as shown in the preview (Cell Structure &amp; Function)</td></tr>
    <tr><td>Colors</td>
      <td><div class="colors">
        <div class="color-chip" style="background:#1a1a2e"></div><span>Pen — #1a1a2e</span>
        <div class="color-chip" style="background:#ffd60a"></div><span>Highlighter — #ffd60a (key terms)</span>
        <div class="color-chip" style="background:#7bf7a0"></div><span>Highlighter — #7bf7a0 (plant cell)</span>
        <div class="color-chip" style="background:#e63946"></div><span>Pen — #e63946 (stars / underline)</span>
      </div></td></tr>
    <tr><td>Sticky notes</td><td>
        #fff6bf (yellow)  x:680 y:190  180×150 px — "Remember to ask teacher about the ATP formula"<br>
        #e3fafc (cyan)    x:670 y:580  160×120 px — "Review Ch.4 p.78–92 before Friday!"
    </td></tr>
    <tr><td>Shoot tip</td><td>Start with blank page → write title → add content → add sticky notes → zoom out to full view</td></tr>
  </table>
</div>

<div class="card" style="border-color:#f59e0b">
  <h2>Scene 2 — Student Answering Exam (PDF Import)</h2>
  <table>
    <tr><td>PDF to import</td><td><a href="scene2_exam_biology.pdf">scene2_exam_biology.pdf</a> — Biology Quiz, 1 page A4</td></tr>
    <tr><td>Flow</td><td>Import PDF → select all pages → confirm → exam appears as background</td></tr>
    <tr><td>Answer style</td><td>Pen #1a1a2e width 2–3 • Write answers directly on answer lines • Tick checkboxes for MCQ (draw ✓ inside boxes)</td></tr>
    <tr><td>Suggested answers</td><td>MCQ: B, C, C, B, C  •  Short answer: freestyle handwriting on lines</td></tr>
    <tr><td>Export</td><td>Export → Export as PDF → submit animation</td></tr>
    <tr><td>Shoot tip</td><td>Import takes ~2 sec on screen — keep in clip. Zoom into MCQ section first, then pan to short-answer.</td></tr>
  </table>
</div>

<div class="card" style="border-color:#a78bfa">
  <h2>Scene 3 — Creator's Mind Map Brainstorm</h2>
  <table>
    <tr><td>Canvas Preview</td><td><a href="scene3_canvas_preview.html">scene3_canvas_preview.html</a> — open in browser</td></tr>
    <tr><td>Background</td><td>Blank (white)</td></tr>
    <tr><td>Build order</td><td>1. Center node "New Campaign" 2. Add Copy branch 3. Add Design branch 4. Add Budget branch 5. Add Timeline branch 6. Add sub-nodes 7. Sticky note</td></tr>
    <tr><td>Node colors</td><td>
        Center: default purple<br>
        Copy branch: teal #0e7c6e<br>
        Design branch: purple #5b21b6<br>
        Budget: orange #9a3412<br>
        Timeline: green #166534
    </td></tr>
    <tr><td>Sticky note</td><td>#fff6bf  right-top area — "A/B test two taglines before final launch!"</td></tr>
    <tr><td>Shoot tip</td><td>Use Mindmap tool. Double-click to create first node. Drag from port circles to connect. Speed up the build in edit — show final state in last 3 sec.</td></tr>
  </table>
</div>

<div class="card" style="border-color:#f43f5e">
  <h2>Scene 4 — Consumer Signs Contract (PDF Import + Signature)</h2>
  <table>
    <tr><td>PDF to import</td><td><a href="scene4_service_contract.pdf">scene4_service_contract.pdf</a> — Freelance Service Agreement, 1 page A4</td></tr>
    <tr><td>Flow</td><td>Import PDF → jump to last page → pen tool → sign on "Service Provider" signature line</td></tr>
    <tr><td>Signature style</td><td>Pen #1a1a2e width 2 • Cursive / flowing signature in the right-side signature box</td></tr>
    <tr><td>Export</td><td>Export as PDF → show file being sent (transition out)</td></tr>
    <tr><td>Shoot tip</td><td>Slow down the signing moment — 2–3 sec pen stroke = most impactful frame of the clip.</td></tr>
  </table>
</div>

<div class="card" style="border-color:#10b981">
  <h2>Scene 5 — Designer Annotates Reference Image</h2>
  <table>
    <tr><td>Reference image</td><td><a href="scene5_room_reference.svg">scene5_room_reference.svg</a> — Living room illustration (1200×800)</td></tr>
    <tr><td>Flow</td><td>Background Picker → Upload image (SVG/PNG) → image appears as background → annotate on top</td></tr>
    <tr><td>Annotations to draw</td><td>
        Red circle #e63946 around the left wall area → "Change wall colour?"<br>
        Blue arrow #2196f3 pointing at sofa → "Try beige instead"<br>
        Green pen #4caf50 marking floor area → "Lighter wood tone"<br>
        Sticky note #fff6bf → "Show client 3 colour options"
    </td></tr>
    <tr><td>Export</td><td>Export as PNG → show sharing</td></tr>
    <tr><td>Shoot tip</td><td>Import SVG or convert to PNG first (see note below). Pan + zoom to different areas as you annotate.</td></tr>
    <tr><td>⚠️ Note</td><td>OmniNote accepts JPEG/PNG/GIF/WEBP. Convert SVG → PNG before uploading:<br>
        Open SVG in browser → screenshot, OR use online converter.</td></tr>
  </table>
</div>

<hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
<p style="color:#9ca3af;font-size:12px">Generated for OmniNote promo video production • May 2025</p>
</body>
</html>"""
    p = os.path.join(OUT, "00_index.html")
    with open(p, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✓  {p}")


# ── Run all ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Generating OmniNote video assets...\n")
    make_exam()
    make_contract()
    make_reference_image()
    make_canvas_previews()
    make_index()
    print("\nDone! All files in ./assets_for_video/")

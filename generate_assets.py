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

def make_exam():
    c, path = new_pdf("scene2_exam_biology.pdf")

    # Header band
    c.setFillColorRGB(0.24, 0.27, 0.6)
    c.rect(0, H - 80, W, 80, stroke=0, fill=1)
    c.setFont("Helvetica-Bold", 20)
    c.setFillColorRGB(1, 1, 1)
    c.drawString(40, H - 38, "Biology Quiz — Cell Structure & Function")
    c.setFont("Helvetica", 11)
    c.drawString(40, H - 58, "Name: ___________________________    Date: ___________    Score: ______ / 100")

    y = H - 105

    # ── Section A: Multiple Choice ──────────────────────────────────────────
    heading(c, "Section A  Multiple Choice  (40 pts)", y, size=13, color=(0.24, 0.27, 0.6))
    y -= 6
    rule(c, y, color=(0.24, 0.27, 0.6))
    y -= 18

    mc_questions = [
        ("1.", "Which organelle is responsible for producing ATP through cellular respiration?",
         ["A. Nucleus", "B. Mitochondria", "C. Ribosome", "D. Golgi apparatus"]),
        ("2.", "The cell membrane is primarily composed of:",
         ["A. Proteins only", "B. Carbohydrates only",
          "C. A phospholipid bilayer with embedded proteins", "D. Cellulose"]),
        ("3.", "Which of the following is found in plant cells but NOT in animal cells?",
         ["A. Mitochondria", "B. Cell membrane", "C. Cell wall", "D. Nucleus"]),
        ("4.", "Ribosomes are responsible for:",
         ["A. DNA replication", "B. Protein synthesis",
          "C. Lipid production", "D. Energy storage"]),
        ("5.", "The process by which water moves across a semi-permeable membrane is called:",
         ["A. Active transport", "B. Diffusion", "C. Osmosis", "D. Endocytosis"]),
    ]

    for num, q, opts in mc_questions:
        c.setFont("Helvetica-Bold", 11)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(40, y, f"{num} {q}")
        y -= 18
        for opt in opts:
            checkbox(c, 52, y - 2, 9)
            c.setFont("Helvetica", 10.5)
            c.setFillColorRGB(0.2, 0.2, 0.2)
            c.drawString(68, y, opt)
            y -= 16
        y -= 10
        if y < 200:
            c.showPage()
            y = H - 60

    # ── Section B: Short Answer ──────────────────────────────────────────────
    y -= 10
    heading(c, "Section B  Short Answer  (40 pts)", y, size=13, color=(0.24, 0.27, 0.6))
    y -= 6
    rule(c, y, color=(0.24, 0.27, 0.6))
    y -= 20

    sa_questions = [
        ("6.", "(10 pts)", "Describe the structure and function of the cell nucleus. Include the role of the nuclear envelope and nucleolus in your answer."),
        ("7.", "(10 pts)", "Explain the difference between prokaryotic and eukaryotic cells. Give one example of each."),
        ("8.", "(10 pts)", "What is the function of the endoplasmic reticulum (ER)? Distinguish between rough ER and smooth ER."),
        ("9.", "(10 pts)", "Describe how mitochondria produce energy. Why are they called the 'powerhouse of the cell'?"),
    ]

    for num, pts, q in sa_questions:
        c.setFont("Helvetica-Bold", 11)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(40, y, f"{num} {pts}  {q[:80]}")
        if len(q) > 80:
            c.setFont("Helvetica", 11)
            c.drawString(52, y - 14, q[80:])
            y -= 14
        y -= 20
        for _ in range(4):
            answer_line(c, 52, y)
            y -= 18
        y -= 10
        if y < 120:
            c.showPage()
            y = H - 60

    # ── Section C: Diagram ───────────────────────────────────────────────────
    y -= 6
    heading(c, "Section C  Diagram Label  (20 pts)", y, size=13, color=(0.24, 0.27, 0.6))
    y -= 6
    rule(c, y, color=(0.24, 0.27, 0.6))
    y -= 18

    c.setFont("Helvetica", 11)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    c.drawString(40, y, "10. (20 pts)  Label the parts of the animal cell diagram below. Write the name of each organelle on the blank lines provided.")
    y -= 22

    # Draw a simple cell diagram
    cx, cy, rx, ry = 297, y - 95, 130, 90
    c.setStrokeColorRGB(0.3, 0.3, 0.8)
    c.setFillColorRGB(0.93, 0.95, 1.0)
    c.setLineWidth(2)
    c.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, stroke=1, fill=1)

    # Nucleus
    c.setStrokeColorRGB(0.2, 0.2, 0.7)
    c.setFillColorRGB(0.8, 0.85, 1.0)
    c.circle(cx - 15, cy + 15, 32, stroke=1, fill=1)
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.2, 0.2, 0.5)
    c.drawCentredString(cx - 15, cy + 12, "Nucleus")

    # Mitochondria (oval shape)
    c.setStrokeColorRGB(0.7, 0.3, 0.2)
    c.setFillColorRGB(1.0, 0.88, 0.82)
    c.ellipse(cx + 40, cy - 10, cx + 90, cy + 25, stroke=1, fill=1)
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.5, 0.2, 0.1)
    c.drawCentredString(cx + 65, cy + 8, "Mito.")

    # Golgi (stacked curves)
    c.setStrokeColorRGB(0.2, 0.6, 0.3)
    c.setFillColorRGB(0.85, 1.0, 0.88)
    for i in range(3):
        c.ellipse(cx - 80, cy - 5 + i * 8, cx - 30, cy + 5 + i * 8, stroke=1, fill=1)

    # Label lines with blanks
    labels = [
        (cx - 15 + 32, cy + 30, cx + 10, cy + 60, "A"),
        (cx + 65, cy + 25, cx + 80, cy + 55, "B"),
        (cx - 55, cy + 10, cx - 90, cy + 50, "C"),
        (cx, cy - ry, cx + 40, cy - ry - 25, "D"),
        (cx - rx + 10, cy, cx - rx - 40, cy + 20, "E"),
    ]
    c.setStrokeColorRGB(0.4, 0.4, 0.4)
    c.setLineWidth(0.7)
    for x1, y1, x2, y2, lbl in labels:
        c.line(x1, y1, x2, y2)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(x2 + 3, y2, f"{lbl}: ___________________")

    y -= 215

    # Footer
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(W / 2, 30, "Good luck!  —  OmniNote Demo Exam")

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
    svg = '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" viewBox="0 0 1200 800"
     xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">
  <defs>
    <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f0e8"/>
      <stop offset="100%" stop-color="#e8dfc8"/>
    </linearGradient>
    <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c8a97a"/>
      <stop offset="100%" stop-color="#a07840"/>
    </linearGradient>
    <linearGradient id="sofaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a6fa5"/>
      <stop offset="100%" stop-color="#2d4d7a"/>
    </linearGradient>
  </defs>

  <!-- Sky / ceiling -->
  <rect width="1200" height="800" fill="#d6e8f0"/>

  <!-- Back wall -->
  <polygon points="200,80 1000,80 1000,600 200,600" fill="url(#wallGrad)" stroke="#c8baa0" stroke-width="2"/>

  <!-- Floor (perspective) -->
  <polygon points="0,600 1200,600 1200,800 0,800" fill="url(#floorGrad)"/>
  <!-- Floor planks -->
  <g stroke="#8a5e30" stroke-width="0.8" opacity="0.4">
    <line x1="0" y1="630" x2="1200" y2="630"/>
    <line x1="0" y1="660" x2="1200" y2="660"/>
    <line x1="0" y1="695" x2="1200" y2="695"/>
    <line x1="0" y1="735" x2="1200" y2="735"/>
    <line x1="0" y1="775" x2="1200" y2="775"/>
    <line x1="200" y1="600" x2="200" y2="800"/>
    <line x1="450" y1="600" x2="400" y2="800"/>
    <line x1="650" y1="600" x2="600" y2="800"/>
    <line x1="850" y1="600" x2="800" y2="800"/>
    <line x1="1000" y1="600" x2="1000" y2="800"/>
  </g>

  <!-- Left wall -->
  <polygon points="0,0 200,80 200,600 0,600" fill="#ddd6c0" stroke="#c0b090" stroke-width="1"/>

  <!-- Right wall -->
  <polygon points="1200,0 1000,80 1000,600 1200,600" fill="#d0c9b5" stroke="#b8ae96" stroke-width="1"/>

  <!-- Large window on back wall -->
  <rect x="480" y="110" width="240" height="300" fill="#a8d0e8" stroke="#8a7060" stroke-width="3"/>
  <!-- Window panes -->
  <line x1="600" y1="110" x2="600" y2="410" stroke="#8a7060" stroke-width="2"/>
  <line x1="480" y1="260" x2="720" y2="260" stroke="#8a7060" stroke-width="2"/>
  <!-- Window sill -->
  <rect x="470" y="408" width="260" height="12" fill="#b8a898" rx="2"/>
  <!-- Window light effect -->
  <polygon points="480,110 720,110 850,600 350,600" fill="rgba(255,240,200,0.12)"/>

  <!-- Curtains -->
  <path d="M480,110 Q460,200 475,300 Q465,400 480,410" fill="#c8b4a0" stroke="#a89080" stroke-width="1"/>
  <path d="M720,110 Q740,200 725,300 Q735,400 720,410" fill="#c8b4a0" stroke="#a89080" stroke-width="1"/>

  <!-- Sofa (main) -->
  <rect x="310" y="480" width="580" height="120" fill="url(#sofaGrad)" rx="10"/>
  <rect x="310" y="450" width="580" height="50" fill="#3d5f8f" rx="8"/>
  <!-- Sofa arms -->
  <rect x="290" y="450" width="30" height="150" fill="#2d4d7a" rx="5"/>
  <rect x="880" y="450" width="30" height="150" fill="#2d4d7a" rx="5"/>
  <!-- Sofa cushions -->
  <rect x="320" y="455" width="175" height="40" fill="#5580b5" rx="5"/>
  <rect x="512" y="455" width="175" height="40" fill="#5580b5" rx="5"/>
  <rect x="703" y="455" width="175" height="40" fill="#5580b5" rx="5"/>
  <!-- Sofa legs -->
  <rect x="330" y="595" width="15" height="20" fill="#1a2a40" rx="2"/>
  <rect x="855" y="595" width="15" height="20" fill="#1a2a40" rx="2"/>

  <!-- Coffee table -->
  <rect x="430" y="575" width="340" height="10" fill="#8b6540" rx="3"/>
  <rect x="440" y="585" width="10" height="25" fill="#6b4520"/>
  <rect x="750" y="585" width="10" height="25" fill="#6b4520"/>
  <!-- Table items: book + small plant -->
  <rect x="460" y="560" width="55" height="15" fill="#e85c50" rx="2"/>
  <rect x="465" y="548" width="45" height="14" fill="#f07060" rx="2"/>
  <circle cx="700" cy="558" r="14" fill="#4a9e5c"/>
  <rect x="696" y="568" width="8" height="12" fill="#6b4520"/>

  <!-- Floor lamp (right) -->
  <rect x="880" y="350" width="8" height="250" fill="#b0a090" rx="2"/>
  <ellipse cx="884" cy="350" rx="35" ry="20" fill="#f5e8c0" stroke="#c0b090" stroke-width="1.5"/>
  <ellipse cx="884" cy="600" rx="20" ry="5" fill="#8a7060"/>
  <!-- Lamp glow -->
  <ellipse cx="884" cy="370" rx="60" ry="40" fill="rgba(255,240,180,0.15)"/>

  <!-- Side table + plant (left) -->
  <rect x="200" y="520" width="80" height="80" fill="#9a7850" rx="4"/>
  <rect x="190" y="516" width="100" height="8" fill="#b09060" rx="2"/>
  <!-- Potted plant -->
  <rect x="228" y="490" width="24" height="26" fill="#b07850" rx="3"/>
  <ellipse cx="240" cy="488" rx="28" ry="22" fill="#3a8048"/>
  <ellipse cx="225" cy="478" rx="18" ry="14" fill="#4a9858"/>
  <ellipse cx="255" cy="480" rx="16" ry="12" fill="#2d6e38"/>

  <!-- Wall art (back wall, left) -->
  <rect x="240" y="150" width="160" height="110" fill="#f0ebe0" stroke="#8a7060" stroke-width="3"/>
  <rect x="248" y="158" width="144" height="94" fill="#e8d8b8"/>
  <!-- Abstract art content -->
  <circle cx="290" cy="195" r="25" fill="#c87040" opacity="0.7"/>
  <circle cx="350" cy="210" r="18" fill="#4870b0" opacity="0.6"/>
  <rect x="265" y="220" width="120" height="15" fill="#60a040" opacity="0.5" rx="3"/>

  <!-- Wall art (back wall, right) -->
  <rect x="800" y="130" width="130" height="180" fill="#f0ebe0" stroke="#8a7060" stroke-width="3"/>
  <rect x="808" y="138" width="114" height="164" fill="#1a2a3a"/>
  <!-- Night city silhouette -->
  <rect x="810" y="240" width="20" height="60" fill="#f5c842"/>
  <rect x="835" y="220" width="15" height="80" fill="#e0e0e0"/>
  <rect x="855" y="250" width="25" height="50" fill="#f5c842"/>
  <rect x="885" y="230" width="18" height="70" fill="#e0e0e0"/>
  <rect x="808" y="290" width="114" height="12" fill="#0a1520"/>
  <!-- Stars -->
  <circle cx="820" cy="155" r="2" fill="white"/>
  <circle cx="850" cy="165" r="1.5" fill="white"/>
  <circle cx="880" cy="148" r="2" fill="white"/>
  <circle cx="895" cy="170" r="1.5" fill="white"/>
  <circle cx="912" cy="155" r="2" fill="white"/>

  <!-- Throw pillow on sofa -->
  <rect x="540" y="450" width="45" height="40" fill="#e8c870" rx="4"/>
  <line x1="540" y1="470" x2="585" y2="470" stroke="#c8a840" stroke-width="0.8"/>
  <line x1="562" y1="450" x2="562" y2="490" stroke="#c8a840" stroke-width="0.8"/>

  <!-- Rug -->
  <ellipse cx="600" cy="595" rx="260" ry="25" fill="#c04030" opacity="0.35"/>

  <!-- Room label (subtle watermark for video reference) -->
  <text x="600" y="760" text-anchor="middle" font-size="13" fill="rgba(80,60,40,0.4)"
        font-style="italic">Living Room — Interior Design Reference  |  OmniNote Scene 5</text>
</svg>'''
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"✓  {path}")

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

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "Daily_Vedic_Astro_Next_Steps_Guide.pdf"
ICON_PATH = ROOT / "assets" / "icon.png"

NAVY = colors.HexColor("#172A52")
NAVY_DARK = colors.HexColor("#101B36")
SAFFRON = colors.HexColor("#B85D2A")
SAFFRON_SOFT = colors.HexColor("#F8E0C6")
CREAM = colors.HexColor("#FFF9EE")
GOLD = colors.HexColor("#C9973E")
MAROON = colors.HexColor("#7A2F38")
GREEN = colors.HexColor("#3E7657")
INK = colors.HexColor("#18213A")
MUTED = colors.HexColor("#666B76")
BORDER = colors.HexColor("#E8DCC8")
WHITE = colors.white


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("AppSans", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("AppSans-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
    pdfmetrics.registerFont(TTFont("AppSans-Italic", r"C:\Windows\Fonts\ariali.ttf"))
    pdfmetrics.registerFontFamily(
        "AppSans",
        normal="AppSans",
        bold="AppSans-Bold",
        italic="AppSans-Italic",
        boldItalic="AppSans-Bold",
    )


register_fonts()

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        fontName="AppSans-Bold",
        fontSize=31,
        leading=35,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=7 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSubtitle",
        fontName="AppSans",
        fontSize=14,
        leading=21,
        textColor=colors.HexColor("#E9DFC9"),
        alignment=TA_CENTER,
        spaceAfter=8 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSmall",
        fontName="AppSans",
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#E9DFC9"),
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="PageTitle",
        fontName="AppSans-Bold",
        fontSize=22,
        leading=27,
        textColor=NAVY,
        spaceAfter=4 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="PageIntro",
        fontName="AppSans",
        fontSize=10.5,
        leading=16,
        textColor=MUTED,
        spaceAfter=5 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="StepTitle",
        fontName="AppSans-Bold",
        fontSize=14,
        leading=18,
        textColor=NAVY,
    )
)
styles.add(
    ParagraphStyle(
        name="H3",
        fontName="AppSans-Bold",
        fontSize=11,
        leading=15,
        textColor=INK,
        spaceBefore=2 * mm,
        spaceAfter=1.5 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyApp",
        fontName="AppSans",
        fontSize=9.5,
        leading=14.5,
        textColor=INK,
        spaceAfter=2.3 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        fontName="AppSans",
        fontSize=8.2,
        leading=12,
        textColor=MUTED,
    )
)
styles.add(
    ParagraphStyle(
        name="Checklist",
        fontName="AppSans",
        fontSize=9.2,
        leading=13.5,
        textColor=INK,
        leftIndent=3 * mm,
        firstLineIndent=-3 * mm,
        spaceAfter=1.7 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="CodeBlock",
        fontName="Courier",
        fontSize=7.8,
        leading=11.5,
        textColor=colors.HexColor("#F6F1E8"),
    )
)
styles.add(
    ParagraphStyle(
        name="BoxTitle",
        fontName="AppSans-Bold",
        fontSize=9.5,
        leading=13,
        textColor=NAVY,
        spaceAfter=1.5 * mm,
    )
)
styles.add(
    ParagraphStyle(
        name="TableHeader",
        fontName="AppSans-Bold",
        fontSize=9,
        leading=12,
        textColor=WHITE,
    )
)
styles.add(
    ParagraphStyle(
        name="BoxBody",
        fontName="AppSans",
        fontSize=8.7,
        leading=13,
        textColor=INK,
    )
)


def body(text: str) -> Paragraph:
    return Paragraph(text, styles["BodyApp"])


def checklist(text: str, checked: bool = False) -> Paragraph:
    mark = "[x]" if checked else "[ ]"
    return Paragraph(f"{mark}&nbsp;&nbsp;{text}", styles["Checklist"])


def step_header(number: int, title: str, outcome: str | None = None) -> Table:
    badge = Table(
        [[Paragraph(str(number), ParagraphStyle("Badge", parent=styles["StepTitle"], textColor=WHITE, alignment=TA_CENTER))]],
        colWidths=[10 * mm],
        rowHeights=[10 * mm],
    )
    badge.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SAFFRON),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0, SAFFRON),
            ]
        )
    )
    title_parts = [Paragraph(title, styles["StepTitle"])]
    if outcome:
        title_parts.append(Paragraph(outcome, styles["Small"]))
    title_box = Table([[title_parts]], colWidths=[156 * mm])
    title_box.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    table = Table([[badge, title_box]], colWidths=[13 * mm, 158 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return table


def command_box(lines: list[str]) -> Table:
    content = "<br/>".join(escape(line) for line in lines)
    table = Table([[Paragraph(content, styles["CodeBlock"])]], colWidths=[171 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY_DARK),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#34456E")),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def info_box(title: str, text: str, tone: str = "blue") -> Table:
    palette = {
        "blue": (colors.HexColor("#E8EDF6"), NAVY),
        "warm": (SAFFRON_SOFT, SAFFRON),
        "green": (colors.HexColor("#E7F0EA"), GREEN),
        "danger": (colors.HexColor("#F7E5E7"), MAROON),
    }
    background, accent = palette[tone]
    table = Table(
        [["", [Paragraph(title, styles["BoxTitle"]), Paragraph(text, styles["BoxBody"])]]],
        colWidths=[2.5 * mm, 168.5 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BACKGROUND", (0, 0), (0, -1), accent),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 0),
                ("LEFTPADDING", (1, 0), (1, -1), 4 * mm),
                ("RIGHTPADDING", (1, 0), (1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return table


def phase_card(number: int, title: str, result: str) -> Table:
    table = Table(
        [
            [Paragraph(f"{number:02d}", ParagraphStyle("PhaseNo", parent=styles["StepTitle"], textColor=GOLD)), Paragraph(title, styles["BoxTitle"])],
            ["", Paragraph(result, styles["Small"])],
        ],
        colWidths=[12 * mm, 69 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
                ("SPAN", (0, 0), (0, 1)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ]
        )
    )
    return table


def divider() -> HRFlowable:
    return HRFlowable(width="100%", thickness=0.6, color=BORDER, spaceBefore=4 * mm, spaceAfter=4 * mm)


def draw_first_page(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(NAVY_DARK)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(colors.Color(1, 1, 1, alpha=0.08))
    canvas.setLineWidth(1)
    canvas.circle(width - 18 * mm, height - 22 * mm, 46 * mm, fill=0, stroke=1)
    canvas.circle(14 * mm, 12 * mm, 54 * mm, fill=0, stroke=1)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 0, width, 4 * mm, fill=1, stroke=0)
    canvas.restoreState()


def draw_later_pages(canvas, doc) -> None:
    width, height = A4
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 13 * mm, width, 13 * mm, fill=1, stroke=0)
    canvas.setFont("AppSans-Bold", 8.5)
    canvas.setFillColor(WHITE)
    canvas.drawString(19 * mm, height - 8.3 * mm, "DAILY VEDIC ASTRO")
    canvas.setFont("AppSans", 8)
    canvas.setFillColor(colors.HexColor("#E9DFC9"))
    canvas.drawRightString(width - 19 * mm, height - 8.3 * mm, "Next Steps Launch Guide")
    canvas.setStrokeColor(BORDER)
    canvas.line(19 * mm, 14 * mm, width - 19 * mm, 14 * mm)
    canvas.setFont("AppSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(19 * mm, 9 * mm, "Production setup checklist - June 2026")
    canvas.drawRightString(width - 19 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story() -> list:
    story: list = []

    story.extend(
        [
            Spacer(1, 19 * mm),
            Image(str(ICON_PATH), width=34 * mm, height=34 * mm, hAlign="CENTER"),
            Spacer(1, 10 * mm),
            Paragraph("Daily Vedic Astro", styles["CoverTitle"]),
            Paragraph("What to do next - step-by-step launch guide", styles["CoverSubtitle"]),
            Table(
                [[Paragraph("SOURCE READY", styles["CoverSmall"]), Paragraph("BACKEND VERIFIED", styles["CoverSmall"]), Paragraph("NEXT: CREDENTIALS + RELEASE", styles["CoverSmall"])]],
                colWidths=[51 * mm, 51 * mm, 62 * mm],
                hAlign="CENTER",
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.Color(1, 1, 1, alpha=0.08)),
                        ("BOX", (0, 0), (-1, -1), 0.6, colors.Color(1, 1, 1, alpha=0.18)),
                        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.Color(1, 1, 1, alpha=0.14)),
                        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
                    ]
                ),
            ),
            Spacer(1, 16 * mm),
            Paragraph(
                "For the project located at:<br/><b>C:\\Users\\mamat\\OneDrive\\Documents\\10rs vedic</b>",
                styles["CoverSmall"],
            ),
            Spacer(1, 10 * mm),
            Paragraph("Prepared 24 June 2026", styles["CoverSmall"]),
            PageBreak(),
        ]
    )

    story.extend(
        [
            Paragraph("Your launch path", styles["PageTitle"]),
            Paragraph(
                "The application code is complete and verified. Your next work is mainly account setup, credentials, real provider integration, device testing and store review. Complete the stages in this order so later steps do not have to be repeated.",
                styles["PageIntro"],
            ),
            info_box(
                "Important distinction",
                "The app can be previewed immediately with local data and OTP 123456. A public production release must use a real OTP provider, a Lahiri sidereal astrology provider, live store products and production Cloudflare secrets.",
                "warm",
            ),
            Spacer(1, 5 * mm),
        ]
    )

    phases = [
        (1, "Run the app locally", "Confirm the app opens and the parent-friendly journey feels right."),
        (2, "Create Cloudflare resources", "Provision D1, apply the schema and deploy the Worker API."),
        (3, "Connect real OTP", "Deliver secure phone or email verification without preview codes."),
        (4, "Connect Vedic calculations", "Replace preview values with sidereal, Lahiri-based chart data."),
        (5, "Configure subscriptions", "Create Apple/Google products and validate premium entitlement."),
        (6, "Initialize EAS", "Connect the Expo project and create an installable preview APK."),
        (7, "Test notifications", "Verify daily, weekly and monthly reminders on real devices."),
        (8, "Complete legal/store content", "Publish support, privacy, terms, screenshots and listing copy."),
        (9, "Run release QA", "Exercise every access state, device size and destructive account action."),
        (10, "Build and submit", "Produce Android AAB and iOS builds, then release gradually."),
    ]
    phase_rows = []
    for index in range(0, len(phases), 2):
        left = phase_card(*phases[index])
        right = phase_card(*phases[index + 1])
        phase_rows.append([left, right])
    phase_table = Table(phase_rows, colWidths=[84 * mm, 84 * mm], hAlign="LEFT")
    phase_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.extend(
        [
            phase_table,
            Spacer(1, 3 * mm),
            info_box(
                "Keep these files open while working",
                "README.md, worker/wrangler.toml, worker/.dev.vars.example, .env.example, worker/PROVIDER_CONTRACT.md and eas.json.",
                "blue",
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            Paragraph("Local run and Cloudflare deployment", styles["PageTitle"]),
            Paragraph("Finish this page before purchasing provider plans or submitting store builds.", styles["PageIntro"]),
            step_header(1, "Run the mobile app locally", "Outcome: the full preview journey works in Expo Go or web."),
            Spacer(1, 3 * mm),
            body("Open PowerShell in the project folder and run:"),
            command_box(
                [
                    'cd "C:\\Users\\mamat\\OneDrive\\Documents\\10rs vedic"',
                    "npm install",
                    "Copy-Item .env.example .env",
                    "npx expo start",
                ]
            ),
            Spacer(1, 3 * mm),
            checklist("Open the QR code with Expo Go, or press W for the web preview."),
            checklist("Sign in with any test phone/email and use preview OTP 123456."),
            checklist("Complete birth details and verify Home, Daily, Panchang, Remedies, Chart and Profile."),
            checklist("Switch between light and dark mode and confirm large text remains readable."),
            info_box("Success signal", "You reach the Home screen and see a 30-day trial card. Preview readings show a 'Preview calculation' label.", "green"),
            divider(),
            step_header(2, "Create the Cloudflare Worker and D1 database", "Outcome: a deployed HTTPS API with persistent users and trials."),
            Spacer(1, 3 * mm),
            body("Create or sign in to a Cloudflare account, then authenticate Wrangler and create the database:"),
            command_box(
                [
                    "npx wrangler login",
                    "cd worker",
                    "npx wrangler d1 create daily-vedic-astro",
                ]
            ),
            Spacer(1, 2 * mm),
            body("Copy the returned database ID into <b>worker/wrangler.toml</b> in place of <b>replace-with-your-d1-database-id</b>. Then prepare a strong local secret and test the migration:"),
            command_box(
                [
                    "Copy-Item .dev.vars.example .dev.vars",
                    "npx wrangler d1 migrations apply daily-vedic-astro --local",
                    "npx wrangler dev",
                ]
            ),
            Spacer(1, 3 * mm),
            info_box("Secret rule", "JWT_SECRET must contain at least 32 random characters. Never put Worker secrets in an EXPO_PUBLIC_ variable or commit .dev.vars.", "danger"),
            PageBreak(),
        ]
    )

    story.extend(
        [
            Paragraph("Authentication and Vedic calculations", styles["PageTitle"]),
            Paragraph("These are the two integrations that turn preview mode into a trustworthy service.", styles["PageIntro"]),
            step_header(3, "Connect a real OTP delivery provider", "Outcome: production users receive phone or email verification codes."),
            Spacer(1, 3 * mm),
            checklist("Choose an SMS/email provider that can reliably serve your target Indian users."),
            checklist("Create a small secure endpoint that accepts identifier, code, purpose and expiry."),
            checklist("Set OTP_PROVIDER_URL in worker/wrangler.toml."),
            checklist("Store OTP_PROVIDER_TOKEN with: npx wrangler secret put OTP_PROVIDER_TOKEN"),
            checklist("Deploy and verify that production responses never include devOtp."),
            info_box(
                "Expected provider request",
                "The Worker sends identifier, a six-digit code, purpose 'Daily Vedic Astro sign-in' and a ten-minute expiry. See README.md for the exact JSON body.",
                "blue",
            ),
            divider(),
            step_header(4, "Connect a Lahiri sidereal astrology provider", "Outcome: Rashi, Nakshatra, Lagna and Panchang use real calculations."),
            Spacer(1, 3 * mm),
            checklist("Confirm the provider supports sidereal zodiac and Lahiri ayanamsa."),
            checklist("Confirm it accepts date, exact time, timezone, place and coordinates."),
            checklist("Confirm chart responses include Rashi, Nakshatra, Lagna and basic dasha."),
            checklist("Confirm Panchang responses include Tithi, Yoga, Karana, sunrise/sunset and local caution periods."),
            checklist("Review licensing terms for caching and consumer display."),
            checklist("Ask a qualified Vedic astrologer to validate sample calculations before launch."),
            body("Implement the exact request/response contract in <b>worker/PROVIDER_CONTRACT.md</b>, then configure:"),
            command_box(
                [
                    "cd worker",
                    "npx wrangler secret put ASTROLOGY_PROVIDER_KEY",
                    "# Set ASTROLOGY_PROVIDER_URL in wrangler.toml",
                ]
            ),
            Spacer(1, 3 * mm),
            info_box("Do not skip", "Production is intentionally designed to fail safely when the astrology provider is absent. Do not change it to silently serve estimated values.", "danger"),
            PageBreak(),
        ]
    )

    story.extend(
        [
            Paragraph("Store subscriptions", styles["PageTitle"]),
            Paragraph("Digital premium access must continue to use Apple and Google billing. RevenueCat is the entitlement and validation layer, not a custom payment gateway.", styles["PageIntro"]),
            step_header(5, "Create and verify the ₹10 monthly plan", "Outcome: purchase, restore and renewal state work on both platforms."),
            Spacer(1, 3 * mm),
            Paragraph("A. Create the accounts", styles["H3"]),
            checklist("Enroll in the Apple Developer Program and create the app in App Store Connect."),
            checklist("Create a Google Play Console developer account and app."),
            checklist("Create a RevenueCat project for Daily Vedic Astro."),
            Paragraph("B. Create matching products", styles["H3"]),
            checklist("Use product ID: daily_vedic_astro_monthly_10 on Apple and Google."),
            checklist("Set a monthly auto-renewing subscription and choose the closest allowed ₹10 India price point."),
            checklist("Create RevenueCat entitlement: premium, then attach both products."),
            Paragraph("C. Configure app and Worker keys", styles["H3"]),
            command_box(
                [
                    "# EAS public build variables",
                    "EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...",
                    "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...",
                    "",
                    "# Worker secrets",
                    "npx wrangler secret put REVENUECAT_SECRET_KEY",
                    "npx wrangler secret put REVENUECAT_WEBHOOK_SECRET",
                ]
            ),
            Spacer(1, 3 * mm),
            Paragraph("D. Configure and test the webhook", styles["H3"]),
            checklist("Webhook URL: https://YOUR-WORKER/subscription/webhook"),
            checklist("Authorization header: Bearer YOUR_REVENUECAT_WEBHOOK_SECRET"),
            checklist("Test initial purchase, renewal, cancellation, expiration and restore."),
            checklist("Confirm access changes in GET /subscription/status."),
            info_box(
                "Trial behavior",
                "The service trial starts once on profile creation and lasts 30 days. It is linked to the account identifier. Deleting and recreating an account does not restart the trial.",
                "warm",
            ),
            Spacer(1, 3 * mm),
            info_box("Never test live money first", "Use Apple sandbox/TestFlight and Google Play internal testing accounts before any public rollout.", "danger"),
            PageBreak(),
        ]
    )

    story.extend(
        [
            Paragraph("EAS builds and notifications", styles["PageTitle"]),
            Paragraph("Create an installable APK early. Store billing and realistic push behavior require a development or EAS build, not only Expo Go.", styles["PageIntro"]),
            step_header(6, "Initialize EAS and create the preview APK", "Outcome: the app installs on a physical Android phone."),
            Spacer(1, 3 * mm),
            command_box(
                [
                    "cd \"C:\\Users\\mamat\\OneDrive\\Documents\\10rs vedic\"",
                    "npx eas-cli@latest login",
                    "npx eas-cli@latest init",
                    "eas build --platform android --profile preview",
                ]
            ),
            Spacer(1, 3 * mm),
            checklist("Store the generated EAS project ID as EXPO_PUBLIC_EAS_PROJECT_ID."),
            checklist("Add production EXPO_PUBLIC_API_URL pointing to the deployed Worker."),
            checklist("Install the APK on at least one current and one older Android phone."),
            checklist("Verify launch, login, scrolling, back navigation and subscription messaging."),
            divider(),
            step_header(7, "Test push and local reminders", "Outcome: reminders arrive at the time selected in Profile."),
            Spacer(1, 3 * mm),
            checklist("Use a physical Android and iPhone; simulators are not sufficient for final push testing."),
            checklist("Enable reminders from Profile and accept the system permission prompt."),
            checklist("Verify the daily reminder and tap it to open Daily guidance."),
            checklist("Verify the weekly reminder on Monday and monthly reminder on the first day."),
            checklist("Change the reminder time and verify the old schedules are replaced."),
            checklist("Disable reminders and confirm scheduled notifications are removed."),
            info_box(
                "Current implementation",
                "Daily, weekly and monthly reminders are scheduled locally on the device. The Expo push token is also stored in D1, ready for future server-driven campaigns.",
                "green",
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            Paragraph("Legal, store content and release QA", styles["PageTitle"]),
            Paragraph("Do not submit until the following operator-owned information replaces every placeholder.", styles["PageIntro"]),
            step_header(8, "Complete legal and store information", "Outcome: policies and listing content identify the real app operator."),
            Spacer(1, 3 * mm),
            checklist("Add company or proprietor legal name, postal address and support email."),
            checklist("Host Privacy Policy and Terms at public HTTPS URLs."),
            checklist("Update app/privacy.tsx and app/terms.tsx with the final operator details."),
            checklist("Prepare store title, short description, full description and support URL."),
            checklist("Capture light and dark screenshots from real phone-sized builds."),
            checklist("Complete Apple privacy nutrition labels and Google Data Safety accurately."),
            checklist("Explain birth data, OTP, subscription entitlement and notification usage."),
            checklist("Verify Delete Account is easy to find and removes raw profile/birth data."),
            info_box("Content safety", "Use guidance language only. Avoid fear, guaranteed outcomes, diagnosis, death, accident, marriage certainty or investment claims.", "warm"),
            divider(),
            step_header(9, "Run the release QA matrix", "Outcome: every critical state passes on Android and iOS."),
            Spacer(1, 3 * mm),
        ]
    )

    qa_data = [
        [Paragraph("State", styles["TableHeader"]), Paragraph("Must verify", styles["TableHeader"])],
        [Paragraph("New user", styles["Small"]), Paragraph("OTP, onboarding, privacy message and 30-day trial", styles["Small"])],
        [Paragraph("Trial user", styles["Small"]), Paragraph("Full daily, weekly, monthly, Panchang, remedies and chart", styles["Small"])],
        [Paragraph("Expired user", styles["Small"]), Paragraph("Basic daily message only; premium sections visibly locked", styles["Small"])],
        [Paragraph("Paid user", styles["Small"]), Paragraph("Purchase, restore, renewal, cancellation and expiration", styles["Small"])],
        [Paragraph("Offline", styles["Small"]), Paragraph("Saved profile opens calmly; no false purchase or calculation success", styles["Small"])],
        [Paragraph("Account deletion", styles["Small"]), Paragraph("Raw data removed; trial cannot be reset; store cancellation explained", styles["Small"])],
        [Paragraph("Accessibility", styles["Small"]), Paragraph("Large text, screen reader labels, color contrast and 44px controls", styles["Small"])],
    ]
    qa_table = Table(qa_data, colWidths=[34 * mm, 137 * mm], repeatRows=1)
    qa_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("BACKGROUND", (0, 1), (-1, -1), WHITE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
            ]
        )
    )
    story.extend([qa_table, PageBreak()])

    story.extend(
        [
            Paragraph("Build, submit and monitor", styles["PageTitle"]),
            Paragraph("When all prior checkboxes are complete, create release builds from a clean working tree.", styles["PageIntro"]),
            step_header(10, "Create production builds and submit", "Outcome: controlled internal testing, then a gradual public release."),
            Spacer(1, 3 * mm),
            command_box(
                [
                    "npm run typecheck",
                    "npm run lint",
                    "npx expo-doctor",
                    "",
                    "eas build --platform android --profile production",
                    "eas build --platform ios --profile production",
                    "",
                    "eas submit --platform android --profile production",
                    "eas submit --platform ios --profile production",
                ]
            ),
            Spacer(1, 4 * mm),
            Paragraph("Before pressing Submit", styles["H3"]),
            checklist("Worker ENVIRONMENT is production and preview data is disabled."),
            checklist("Remote D1 migration is applied and the deployed / endpoint returns status ok."),
            checklist("OTP, astrology and RevenueCat secrets exist only in Worker/EAS secret stores."),
            checklist("Production app uses the deployed HTTPS Worker URL."),
            checklist("Product IDs and entitlement ID match exactly across code, stores and RevenueCat."),
            checklist("Support, terms and privacy URLs are live and accessible without login."),
            checklist("At least one Android internal test and one TestFlight session passed end to end."),
            Paragraph("Recommended release sequence", styles["H3"]),
            body("1. Google Play internal testing. 2. TestFlight internal testing. 3. Small closed beta with trusted families. 4. Fix feedback. 5. Gradual public rollout. Avoid opening to everyone on the first production build."),
            info_box(
                "Monitor after release",
                "Watch OTP delivery failures, astrology provider errors, subscription webhooks, crash-free sessions, account deletions and user reports. Pause rollout if login, billing or chart generation becomes unreliable.",
                "blue",
            ),
            Spacer(1, 5 * mm),
            info_box(
                "Your immediate next action",
                "Start with Step 1 today. After local confirmation, create the Cloudflare D1 database in Step 2. Do not purchase every service at once; connect and test one provider at a time.",
                "green",
            ),
            Spacer(1, 6 * mm),
            Paragraph("Useful project references", styles["H3"]),
            body("README.md - complete setup details<br/>worker/PROVIDER_CONTRACT.md - astrology provider contract<br/>worker/wrangler.toml - Cloudflare configuration<br/>eas.json - build profiles<br/>app/privacy.tsx and app/terms.tsx - in-app policies"),
        ]
    )

    return story


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        leftMargin=19 * mm,
        rightMargin=19 * mm,
        topMargin=20 * mm,
        bottomMargin=19 * mm,
        title="Daily Vedic Astro - Next Steps Launch Guide",
        author="Daily Vedic Astro project",
        subject="Step-by-step production setup and store launch guide",
    )
    doc.build(build_story(), onFirstPage=draw_first_page, onLaterPages=draw_later_pages)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Create an EEC DOCX matching the clause sequence and table form of the reference PDF."""

from __future__ import annotations

import copy
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET


DOCS_DIR = Path(__file__).resolve().parent
TEMPLATE = DOCS_DIR / "EF_BMMS_Privacy_Policy_Redline_Procedural_Mechanisms.docx"
OUTPUT = DOCS_DIR / "EEC_Same_Clauses_as_Better_Pass_Reference.docx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DC = "http://purl.org/dc/elements/1.1/"
CP = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"

for prefix, uri in {
    "w": W,
    "dc": DC,
    "cp": CP,
    "dcterms": "http://purl.org/dc/terms/",
    "dcmitype": "http://purl.org/dc/dcmitype/",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}.items():
    ET.register_namespace(prefix, uri)


def qn(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


# The numbering intentionally matches the reference PDF exactly; item 9 is absent there.
ROWS = [
    (
        "1",
        "1.1 Legal Name",
        "**EEC – Electronic Educare**\n\nThe contracting/operator entity should be stated as **YarrowTech [insert full legal name and entity type]**, operating the product EEC – Electronic Educare.",
    ),
    (
        "2",
        "1.2 Privacy Policy Link",
        "**Product website:** https://electroniceducare.com\n\n**Privacy Policy:** [publish and confirm URL – suggested: https://electroniceducare.com/privacy]\n\n**Terms and Conditions:** [publish and confirm URL – suggested: https://electroniceducare.com/terms]",
    ),
    (
        "3",
        "1.4 Non-acceptance of updated Terms/Privacy Policy",
        "If a subscribing institution or adult User does not agree to any updated Terms and Conditions or Privacy Policy, they may discontinue use of the applicable Services, subject to the subscription agreement, school-record obligations and applicable law. Continued use of the Platform after the effective date of updated terms may constitute acceptance where legally valid. Where fresh consent is required by law, EEC shall obtain a separate affirmative action and shall not rely only on continued use.",
    ),
    (
        "4",
        "2.1(a) Institution/User Add",
        "**2.1(a) Subscribing Institution / School:**\nFor the purposes of these Terms and Conditions, a “Subscribing Institution” or “School” means a school, educational institution, training organisation or other authorised entity registered on or subscribed to the EEC Platform for educational and administrative Services. Subscribing Institutions may include the following categories:\n\n1. **Schools and Educational Institutions** – organisations using EEC for admissions, student records, academics, attendance, timetables, examinations, assignments, fees, communications, reporting or other approved modules.\n\n2. **Institution Administrators and Staff** – authorised principals, administrators, teachers, counsellors or personnel who use EEC within their assigned roles and permissions.\n\n3. **Students** – learners whose accounts or educational records are created or administered through a Subscribing Institution. A Student may be a child under applicable Indian law.\n\n4. **Parents / Guardians** – verified parents or lawful guardians linked to a Student and authorised to access the limited parent-facing Services.\n\n**2.1(b) User:**\nFor the purposes of these Terms and Conditions, a “User” means an authorised institution representative, administrator, principal, teacher, staff member, Student, parent or lawful guardian who accesses or uses EEC. User rights, responsibilities and access permissions vary by role and institution configuration.",
    ),
    (
        "5",
        "2.1(d) Customer Details",
        "Clarify exactly what Customer/User information is collected. Suggested categories: **name, username, mobile number, email address, school/campus, role, class/section, student or employee identifier, parent/guardian linkage, address where required, academic and attendance records, assignments and examination information, communications, uploaded content, AI-tutor interactions, subscription or fee transaction details, device/access logs and information voluntarily provided by the User or institution.** State the purpose for collecting each category and refer to the Privacy Policy for processing, storage, sharing, retention and deletion details.",
    ),
    (
        "6",
        "3.3 Verification Documents",
        "For registration and verification purposes, EEC may collect and require Subscribing Institutions and authorised Users to provide information and documents necessary to establish identity, authority, eligibility and legitimacy.\n\n**(a) Subscribing Institutions / Schools:**\nA Subscribing Institution shall provide, as applicable, its **name, official email address, phone number, country, state/city, campus address, school type, board/affiliation, registration or recognition information, website, institution overview, authorised representative and primary verification documents.** EEC may request additional information where reasonably necessary to verify the institution or prevent fraud.\n\n**(b) Authorised Users:**\nInstitution administrators, teachers, staff, Students and parents/guardians shall provide, as applicable, their **name, email address, phone number, institution, role, employee/student identifier, class/section and parent/guardian relationship.** Government-issued identification should be requested only where necessary, lawfully authorised and protected by appropriate safeguards.\n\nSubscribing Institutions and Users are responsible for ensuring that all information and documents submitted to EEC are **accurate, complete, valid and up to date.** EEC reserves the right to conduct additional verification or request further information where required for compliance, child safety, security, fraud prevention or proper operation of the Platform.",
    ),
    (
        "7",
        "4.3 Refund Policy",
        "All payments made through the EEC Platform are subject to the applicable subscription agreement, institution policy and payment/transaction policies of the configured payment gateway, including Razorpay where enabled. Refunds shall be governed as follows:\n\n**(a) Institution Subscription Cancelled Before Activation:**\nWhere a Subscribing Institution cancels before service activation, refund eligibility shall be determined under the applicable order form, including any disclosed setup or implementation charges. **[Confirm approved refund percentage and deductions.]**\n\n**(b) Institution Subscription Cancelled After Activation:**\nAfter activation, renewal or use of EEC, any pro-rata, partial or non-refundable amount shall be governed by the signed order form or subscription agreement. **[Insert approved cancellation window and refund rule.]**\n\n**(c) School Fees or Institution Charges:**\nWhere EEC facilitates payment of school fees or another institution charge, the Subscribing Institution ordinarily determines the charge, cancellation and refund eligibility. EEC provides payment technology and reconciliation support unless the applicable agreement states otherwise.\n\n**(d) Duplicate, Failed or Erroneous Payment:**\nA verified duplicate debit, failed transaction with debit, or erroneous charge may be eligible for correction or refund subject to confirmation by the institution, payment gateway and bank.\n\n**(e) Service Cancellation or Unavailability:**\nWhere a paid EEC Service is cancelled or cannot be provided for reasons attributable to EEC, the Customer may be eligible for an appropriate refund or credit under the applicable agreement and law.\n\n**(f) Processing of Refunds:**\nApproved refunds shall be processed through the original or another authorised payment method. Credit time may depend on the institution, Razorpay or other gateway, bank, card issuer or payment provider. **[Confirm merchant-of-record, refund authority, gateway charges and processing timeline.]**",
    ),
    (
        "8",
        "4.6 Devices",
        "EEC can be accessed through supported web browsers and internet-connected devices. Google Play Store, Apple App Store, progressive web application or other mobile availability should be stated only for versions actually released and supported. EEC may update minimum browser, operating-system, device and connectivity requirements with reasonable notice of material changes.",
    ),
    (
        "10",
        "5.2",
        "Add the word **“correct”** before “current”, so that the relevant phrase reads **“true, accurate, complete, correct and current information.”**",
    ),
    (
        "11",
        "Privacy Policy – Contractual Agreement",
        "Add a provision making it clear that the EEC Privacy Policy forms part of the contractual framework governing use of EEC and that acceptance/use of the Platform constitutes acknowledgement that the User has received and read the Privacy Policy. Acknowledgement of the Privacy Policy shall not be treated as consent for every processing purpose; separate consent must be obtained where required by applicable law.",
    ),
    (
        "12",
        "7.2",
        "This point needs to be reviewed against the actual existing wording of Clause 7.2 before filling it. No specific change is indicated in the reference document.",
    ),
    (
        "13",
        "7.4(f)",
        "Add the terms **“clone”** and **“piracy”** to the prohibited activities. The clause should prohibit Users from cloning, copying, reproducing, pirating, modifying, reverse engineering, decompiling, circumventing technical protections or creating unauthorised derivative versions of EEC, its Platform, source code, models, content, databases, systems or Services, except to the limited extent applicable law expressly permits.",
    ),
    (
        "14",
        "7.4.10",
        "Add **location, Student and Customer/User information** to the relevant prohibited-use and data provision. It should cover unauthorised collection, access, inference, misuse, export, disclosure, sale or exploitation of Student, parent, teacher, staff, Customer, wellbeing, assessment, communication, payment, device and location information.",
    ),
    (
        "15",
        "8",
        "Payments may be provided for:\n\n1. **School/institution subscription and implementation charges**\n2. **School fees or institution-authorised charges**\n3. **Optional paid modules or Services ordered by the institution**\n\nDo not include advertising, boosted posts or unrelated marketplace payments unless such features are actually approved and launched. State the merchant, payment gateway, taxes, invoice, settlement, cancellation, refund and grievance role for every payment flow.",
    ),
    (
        "16",
        "10.6",
        "Remove this clause, as indicated in the reference document. Before deletion, review the existing EEC wording to ensure that removing Clause 10.6 does not create a numbering error, conflict or regulatory gap.",
    ),
    (
        "17",
        "11.1",
        "**11.1** Users are responsible for providing true, accurate, complete, correct and current information when creating an account, establishing an institution tenant, linking a Student, processing a payment or using any EEC Service.\n\n**11.2** Users must use the EEC Platform and Services only for lawful, authorised educational and administrative purposes and in accordance with these Terms, institution policy and applicable law.\n\n**11.3** Users are responsible for reviewing relevant information before submitting an assignment, examination, fee payment, leave request, meeting request, support request or another transaction.\n\n**11.4** Users must follow reasonable instructions, safeguarding requirements, assessment-integrity rules and guidelines provided by EEC and the relevant Subscribing Institution.\n\n**11.5** Users are responsible for ensuring that they have the required role, authority, age, parent/guardian linkage or other eligibility to access a feature or record.\n\n**11.6** Users must behave respectfully towards EEC, institutions, administrators, teachers, Students, parents/guardians and other Users and must not engage in abusive, threatening, discriminatory, fraudulent, disruptive or unlawful behaviour.\n\n**11.7** Users must not misuse EEC, including attempting unauthorised access, crossing institution or role boundaries, interfering with the Platform, introducing malicious code, creating fraudulent accounts, manipulating academic records or using AI features to cheat, harm, harass or extract prohibited information.\n\n**11.8** Users must protect credentials, use only their own authorised account and promptly report suspected compromise or inaccurate role/student linkage.\n\n**11.9** Users must not upload or disclose another person’s Personal Data, photograph, recording, medical information, financial information, government identifier or confidential document without authority.\n\n**11.10** Users must not provide false, misleading, fraudulent, defamatory or manipulated information, reviews, feedback, assessment evidence or reports concerning EEC or another User.\n\n**11.11** Users must not transfer, resell, misuse or commercially exploit their account, login credentials, reports, access links, content or Services unless EEC and the relevant institution expressly permit it.\n\n**11.12** A User who violates these Terms or misuses EEC may have access restricted, suspended or terminated, without prejudice to other remedies. For a child or education record, suspension shall not destroy records the institution must lawfully preserve or improperly deny authorised access.",
    ),
    (
        "18",
        "15.3",
        "The EEC / Electronic Educare name and logo are trademarks of **[insert confirmed owner]**. **[Confirm trademark registration/application number and permitted ™ or ® symbol before publication.]** The EEC software, design, databases, documentation, original content and associated intellectual property are owned by or licensed to the applicable YarrowTech entity, subject to third-party and User rights.",
    ),
    (
        "19",
        "17.3",
        "After a verified account-deletion request or subscription termination, Personal Data associated with the account shall be deleted from active EEC databases or anonymised in accordance with the responsible institution’s lawful instructions, applicable agreement and law. Certain academic, financial, audit, security or dispute records may be retained where required. Uploaded files, search/vector stores, AI memory, caches, subprocessors and backups must be included in the approved deletion process, with backups expiring through the defined cycle. **[Confirm active-system deletion SLA, backup expiry and deletion-certificate process.]**",
    ),
    (
        "20",
        "Customer Support – New Clause",
        "**Mobile:** +91 9830590929\n\n**Email:** eec@electroniceducare.com\n\n**Website:** https://electroniceducare.com\n\n**Address:** [insert complete customer-support postal address]\n\nPrivacy and statutory grievances should additionally identify the Grievance Officer’s name, designation, dedicated email, telephone, postal address and approved acknowledgement/resolution period.",
    ),
]


def element(name: str, attrs: dict[str, str] | None = None) -> ET.Element:
    return ET.Element(qn(W, name), {qn(W, key): value for key, value in (attrs or {}).items()})


def run(text: str, bold: bool = False, size: str = "19") -> ET.Element:
    node = element("r")
    props = element("rPr")
    props.append(element("rFonts", {"ascii": "Arial", "hAnsi": "Arial", "cs": "Arial"}))
    props.append(element("sz", {"val": size}))
    props.append(element("szCs", {"val": size}))
    if bold:
        props.append(element("b"))
        props.append(element("bCs"))
    node.append(props)
    text_node = element("t")
    if text.startswith(" ") or text.endswith(" "):
        text_node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    text_node.text = text
    node.append(text_node)
    return node


def paragraph(markup: str, *, bold_all: bool = False, center: bool = False, size: str = "19") -> ET.Element:
    p = element("p")
    ppr = element("pPr")
    ppr.append(element("spacing", {"before": "0", "after": "0", "line": "240", "lineRule": "auto"}))
    if center:
        ppr.append(element("jc", {"val": "center"}))
    p.append(ppr)

    if bold_all:
        p.append(run(markup, True, size))
        return p

    cursor = 0
    bold = False
    for match in re.finditer(r"\*\*", markup):
        if match.start() > cursor:
            p.append(run(markup[cursor:match.start()], bold, size))
        bold = not bold
        cursor = match.end()
    if cursor < len(markup):
        p.append(run(markup[cursor:], bold, size))
    return p


def cell(text: str, width: str, *, bold_all: bool = False, center: bool = False, shade: str | None = None) -> ET.Element:
    tc = element("tc")
    tcpr = element("tcPr")
    tcpr.append(element("tcW", {"w": width, "type": "dxa"}))
    tcpr.append(element("vAlign", {"val": "top"}))
    if shade:
        tcpr.append(element("shd", {"fill": shade, "val": "clear"}))
    tc.append(tcpr)
    blocks = text.split("\n")
    for block in blocks:
        tc.append(paragraph(block, bold_all=bold_all, center=center))
    if not blocks:
        tc.append(paragraph(""))
    return tc


def table_row(values: tuple[str, str, str], *, header: bool = False) -> ET.Element:
    widths = ("650", "3400", "7250")
    tr = element("tr")
    trpr = element("trPr")
    if header:
        trpr.append(element("tblHeader", {"val": "true"}))
        trpr.append(element("cantSplit"))
    tr.append(trpr)
    for idx, value in enumerate(values):
        tr.append(
            cell(
                value,
                widths[idx],
                bold_all=header or idx < 2,
                center=header,
                shade="F2F2F2" if header else None,
            )
        )
    return tr


def build_table() -> ET.Element:
    tbl = element("tbl")
    tblpr = element("tblPr")
    tblpr.append(element("tblW", {"w": "11300", "type": "dxa"}))
    tblpr.append(element("tblLayout", {"type": "fixed"}))
    borders = element("tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(element(side, {"val": "single", "sz": "8", "space": "0", "color": "000000"}))
    tblpr.append(borders)
    margins = element("tblCellMar")
    for side in ("top", "left", "bottom", "right"):
        margins.append(element(side, {"w": "100", "type": "dxa"}))
    tblpr.append(margins)
    tbl.append(tblpr)
    grid = element("tblGrid")
    for width in ("650", "3400", "7250"):
        grid.append(element("gridCol", {"w": width}))
    tbl.append(grid)
    tbl.append(table_row(("No.", "Clause", "What should be added / changed for EEC – Electronic Educare"), header=True))
    for no, clause, text in ROWS:
        tbl.append(table_row((no, clause, text)))
    return tbl


def generate() -> None:
    with ZipFile(TEMPLATE) as source:
        files = {name: source.read(name) for name in source.namelist()}

    document = ET.fromstring(files["word/document.xml"])
    body_node = document.find(qn(W, "body"))
    if body_node is None:
        raise RuntimeError("Template has no document body")
    sect = body_node.find(qn(W, "sectPr"))
    saved_sect = copy.deepcopy(sect) if sect is not None else element("sectPr")
    for child in list(body_node):
        body_node.remove(child)
    body_node.append(build_table())

    # Match the reference's compact A4 portrait layout.
    pgmar = saved_sect.find(qn(W, "pgMar"))
    if pgmar is None:
        pgmar = element("pgMar")
        saved_sect.append(pgmar)
    for key, value in {
        "top": "360",
        "right": "300",
        "bottom": "420",
        "left": "300",
        "header": "180",
        "footer": "180",
        "gutter": "0",
    }.items():
        pgmar.set(qn(W, key), value)
    body_node.append(saved_sect)
    files["word/document.xml"] = ET.tostring(document, encoding="utf-8", xml_declaration=True)

    # Keep the footer visually empty like the reference.
    footer = ET.fromstring(files["word/footer1.xml"])
    for p in footer.findall(qn(W, "p")):
        for child in list(p):
            if child.tag == qn(W, "r"):
                p.remove(child)
    files["word/footer1.xml"] = ET.tostring(footer, encoding="utf-8", xml_declaration=True)

    core = ET.fromstring(files["docProps/core.xml"])
    metadata = {
        qn(DC, "title"): "EEC – Same Clauses as Better Pass Reference",
        qn(DC, "subject"): "Clause-by-clause EEC adaptation using the exact sequence of the supplied reference PDF",
        qn(DC, "creator"): "YarrowTech / EEC",
        qn(CP, "lastModifiedBy"): "OpenAI Codex",
        qn(DC, "description"): "Three-column clause review adapted for EEC – Electronic Educare.",
    }
    for tag, value in metadata.items():
        node = core.find(tag)
        if node is None:
            node = ET.SubElement(core, tag)
        node.text = value
    files["docProps/core.xml"] = ET.tostring(core, encoding="utf-8", xml_declaration=True)

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as target:
        for name, data in files.items():
            target.writestr(name, data)
    print(OUTPUT)


if __name__ == "__main__":
    generate()

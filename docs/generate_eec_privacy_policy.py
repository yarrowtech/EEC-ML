#!/usr/bin/env python3
"""Generate the EEC privacy-policy DOCX from the supplied EF&BMMS template."""

from __future__ import annotations

import copy
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET


DOCS_DIR = Path(__file__).resolve().parent
TEMPLATE = DOCS_DIR / "EF_BMMS_Privacy_Policy_Redline_Procedural_Mechanisms.docx"
OUTPUT = DOCS_DIR / "EEC_Electronic_Educare_Privacy_Policy_Redline_Procedural_Mechanisms.docx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DC = "http://purl.org/dc/elements/1.1/"
CP = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
W14 = "http://schemas.microsoft.com/office/word/2010/wordml"

for prefix, uri in {
    "w": W,
    "w14": W14,
    "dc": DC,
    "cp": CP,
    "dcterms": "http://purl.org/dc/terms/",
    "dcmitype": "http://purl.org/dc/dcmitype/",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}.items():
    ET.register_namespace(prefix, uri)


def qn(namespace: str, name: str) -> str:
    return f"{{{namespace}}}{name}"


def heading(text: str) -> tuple[str, str]:
    return ("heading", text)


def body(text: str) -> tuple[str, str]:
    return ("body", text)


CONTENT: list[tuple[str, str]] = [
    ("title", "PRIVACY POLICY"),
    ("subtitle", "EEC – ELECTRONIC EDUCARE"),
    ("center", "Education ERP, Learning Management System and AI-Assisted Learning Platform"),
    ("center", "Website: https://electroniceducare.com"),
    ("center", "Effective Date: [TO CONFIRM BEFORE PUBLICATION]"),
    ("center", "Last Updated: 26 August 2026"),
    ("notice", "DRAFT FOR LEGAL AND OPERATIONAL REVIEW – NOT FOR PUBLICATION UNTIL ALL RED REVIEW FIELDS ARE RESOLVED"),
    body("Items in square brackets identify decisions or facts that EEC must confirm before this Policy is approved and published. This draft is an operational adaptation of the supplied policy template and is not a substitute for advice from qualified Indian counsel."),

    heading("1. GENERAL"),
    body("We, at YarrowTech [INSERT FULL LEGAL NAME AND ENTITY TYPE] (\u201cYarrowTech\u201d, \u201cwe\u201d, \u201cour\u201d or \u201cus\u201d), operate EEC \u2013 Electronic Educare and are committed to respecting privacy and appropriately protecting the personal data and information processed through our services."),
    body("This Privacy Policy (\u201cPolicy\u201d) describes how YarrowTech collects, receives, stores, uses, discloses, transfers and otherwise processes Personal Data in connection with EEC \u2013 Electronic Educare, including https://electroniceducare.com, school-specific domains, web and application interfaces, APIs, AI-assisted features and associated services (collectively, the \u201cPlatform\u201d or \u201cServices\u201d). EEC is a cloud-based education ERP and learning-management platform connecting schools and other educational institutions with administrators, teachers, staff, students and parents or guardians. Its features may include admissions and student records, academics, attendance, timetables, examinations, assignments, learning resources, communications, parent access, finance and fees, human resources, transport, library functions, reporting, analytics and AI-assisted learning tools."),
    body("This Policy has been framed with reference to the Digital Personal Data Protection Act, 2023 (\u201cDPDP Act\u201d), the Digital Personal Data Protection Rules, 2025 (\u201cDPDP Rules\u201d), the Information Technology Act, 2000 (\u201cIT Act\u201d) and applicable rules and directions issued thereunder, including, to the extent applicable during the statutory transition, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (\u201cSPDI Rules\u201d), the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (\u201cIT Rules, 2021\u201d) and directions of the Indian Computer Emergency Response Team (\u201cCERT-In\u201d)."),
    body("This Policy is intended to operate during the transitional period described in Section 26 and thereafter. Where applicable law or an agreement with a subscribing institution imposes a more stringent obligation, that obligation shall prevail to the extent required by law."),
    body("By accessing or using the Platform, you acknowledge that you have read and understood this Policy. Where consent is required, it will be sought through an appropriate affirmative action and in the manner required by applicable law. If you provide Personal Data relating to another person, you represent that you are authorised to do so and have provided any required notice and obtained any required consent. A school, parent or guardian must not create or operate a child account except through an approved onboarding process."),

    heading("2. INFORMATION COLLECTED"),
    body("For this Policy, \u201cPersonal Data\u201d has the meaning assigned under applicable law and broadly means data about an individual who is identifiable by or in relation to such data. Depending on the modules selected by a subscribing institution and the way a person uses EEC, the Platform may process the following categories:"),
    body("2.1 Institution and subscription data \u2013 school or institution name, board or affiliation, branches, address, registration or tax details, authorised representative, official contact details, subscription plan, tenant or account identifiers, implementation configuration and contractual records."),
    body("2.2 Administrator, teacher and staff data \u2013 name, photograph, employee identifier, designation, department, qualifications, employment and allocation details, attendance, leave, timetable, contact details, username, authentication data, role, permissions, payroll or expense information where the relevant module is enabled, and activity or audit records."),
    body("2.3 Student identity and enrolment data \u2013 name, photograph, date of birth or age, gender where required, admission and roll numbers, class, section, academic year, subjects, address and contact details, parent or guardian linkage, emergency contacts, prior-school or admission information and other records entered by the institution."),
    body("2.4 Parent and guardian data \u2013 name, relationship to the student, contact and address details, username and authentication data, student linkage, communication preferences, consent or authorisation records and information submitted through parent-facing Services."),
    body("2.5 Academic and learning data \u2013 curriculum and subject enrolment, assignments, submissions, examinations, answers, marks, grades, report cards, teacher feedback, lesson plans, learning resources, quiz and practice attempts, goals, badges, progress, mastery or performance indicators, learning-path records and intervention information."),
    body("2.6 Attendance, activity and campus-operation data \u2013 attendance and leave, timetable and scheduling, library transactions, transport or route information, events, meetings, notifications, access to materials and other institution-administration records where the relevant modules are enabled."),
    body("2.7 Wellbeing, behaviour and support data \u2013 behaviour observations, counselling or wellbeing records, accessibility or learning-support needs, accommodation information, health or emergency information and safeguarding records, but only where an approved feature and lawful institutional process require them. These categories may be highly sensitive in context and access should be strictly limited."),
    body("2.8 Communications and user-generated content \u2013 messages among authorised users, notices, posts, comments, feedback, meeting requests, support requests, files, photographs, audio, video and other content uploaded or exchanged through enabled features."),
    body("2.9 AI-assisted learning and assessment data \u2013 prompts and questions, tutor conversations, uploaded teacher materials, retrieved source passages, generated responses, writing samples, reading or speech recordings, transcripts, pronunciation or fluency indicators, model-generated recommendations, summaries, classifications and related quality, safety and provenance metadata. [CONFIRM WHICH AI FEATURES, INPUTS AND OUTPUTS WILL BE ENABLED IN PRODUCTION.]"),
    body("2.10 Finance and payment data \u2013 fee structures, invoices, dues, concessions, receipts, payment status, transaction references and reconciliation information. Where a third-party payment gateway processes a payment, card, bank-account, UPI or other payment-instrument details may be collected directly by that provider under its own terms and privacy policy."),
    body("2.11 Technical, device and usage data \u2013 IP address, browser and device information, operating system, application version, timestamps, login, authentication and access records, approximate network or tenant context, feature interactions, crash reports, diagnostics, security events and audit logs."),
    body("2.12 Support and feedback data \u2013 information contained in emails, calls, service requests, complaints, surveys, demonstrations, onboarding communications and other correspondence with YarrowTech or the subscribing institution."),
    body("2.13 Cookies and similar technologies \u2013 session, authentication, preference, security, performance and analytics information as described in Section 17."),
    body("Users must not upload Aadhaar numbers, complete payment credentials, passwords for unrelated systems, biometric identifiers, medical records or other highly sensitive information unless an expressly approved feature requires it, the subscribing institution has documented the lawful necessity, and appropriate safeguards have been implemented. [CONFIRM WHETHER ANY AADHAAR, BIOMETRIC, PRECISE LOCATION, HEALTH OR GOVERNMENT-ID PROCESSING IS INTENDED.]"),

    heading("3. WAYS IN WHICH WE COLLECT INFORMATION"),
    body("YarrowTech may collect Personal Data when an institution requests a demonstration, enters into or administers a subscription, configures a tenant, imports or uploads records, or enables an integration; when an administrator, teacher, staff member, student, parent or guardian creates, activates or uses an account; when a person submits content or communicates through the Platform; automatically through access logs, cookies and similar technologies; when fees or subscriptions are processed; when support is requested; and from service providers used to host, secure, communicate, analyse or support the Services."),
    body("Schools may provide records through forms, spreadsheets, APIs, synchronisation tools or manual entry. A subscribing institution is responsible for ensuring that it is legally entitled to collect and provide those records, that data is accurate and relevant, and that students, parents, personnel and other affected individuals receive the notices, choices and rights required by law."),

    heading("4. ROLE OF YARROWTECH AND SUBSCRIBING INSTITUTIONS"),
    body("EEC is a multi-tenant SaaS platform through which a subscribing school or other educational institution may process Personal Data relating to students, parents, teachers, employees and other individuals. Depending on the data and purpose, YarrowTech may act as a Data Fiduciary or Data Processor under the DPDP framework."),
    body("Where YarrowTech determines the purpose and means of processing for its own business activities\u2014such as demonstration enquiries, subscription administration, account security, platform-level authentication, billing, fraud prevention, support, product administration and legal compliance\u2014YarrowTech may act as the relevant Data Fiduciary."),
    body("Where a subscribing institution determines why student, parent, staff, academic, attendance, wellbeing, financial or other institution records are processed and uses EEC as its technology provider, that institution will ordinarily be the Data Fiduciary and YarrowTech will process such Personal Data on its documented instructions as a Data Processor. The institution remains responsible for lawful purpose, data minimisation, notices, consent or other lawful basis, parental authorisation, user access, retention decisions and responses to Data Principal requests."),
    body("The subscription agreement, order form, implementation schedule and any data-processing agreement should identify the enabled modules, categories of Data Principals and data, processing purposes, authorised administrators, sub-processors, security measures, retention and return or deletion procedures. If those terms conflict with this Policy, the specific contractual terms prevail to the extent legally permissible."),

    heading("5. HOW WE USE PERSONAL DATA"),
    body("YarrowTech uses Personal Data for the purpose for which it was collected, on an institution's documented instructions where we act as Data Processor, and for other purposes permitted by law. Uses may include:"),
    body("5.1 Service provision and access \u2013 creating tenants and accounts, authenticating users, applying role and tenant permissions, maintaining enrolment links, delivering enabled modules and providing technical operations."),
    body("5.2 Educational and institution operations \u2013 supporting admissions, classes, subjects, attendance, timetables, assignments, examinations, results, report cards, learning resources, library, transport, communications, human resources, finance and reporting as configured by the institution."),
    body("5.3 Learning support and analytics \u2013 displaying progress, identifying patterns or areas requiring attention, providing practice or learning-path suggestions, supporting teacher interventions and producing reports for authorised users. Engagement indicators are not by themselves proof of learning and AI-derived indicators should be reviewed in context."),
    body("5.4 AI-assisted features \u2013 answering curriculum-grounded questions, generating or organising learning materials, providing writing, reading or speech feedback, producing summaries, recommendations or draft insights and improving retrieval or response quality. Section 11 explains limits and safeguards."),
    body("5.5 Payments and subscriptions \u2013 administering subscriptions and school-authorised fees, issuing invoices or receipts, reconciling transactions and communicating payment status."),
    body("5.6 Support and communications \u2013 responding to requests, troubleshooting, delivering notices, assignments, meeting updates, maintenance information and security alerts, and facilitating authorised school-community communications."),
    body("5.7 Safety, security and integrity \u2013 detecting, preventing and investigating unauthorised access, fraud, misuse, tenant leakage, harmful content, cyber incidents, account compromise and violations of applicable terms or policies."),
    body("5.8 Service improvement \u2013 monitoring performance, understanding feature use, testing fixes and improving usability, reliability and accessibility. Where reasonably practicable, improvement data will be aggregated, anonymised, de-identified or otherwise minimised. Student Personal Data will not be used to train a general-purpose model unless the responsible Data Fiduciary has approved a lawful, transparent process and any required consent has been obtained."),
    body("5.9 Legal compliance and claims \u2013 complying with law, lawful government directions and court orders, maintaining prescribed records, obtaining professional advice and establishing, exercising or defending legal rights."),
    body("5.10 Marketing \u2013 communicating with adult institutional representatives about YarrowTech products or Services where permitted and, where required, with consent. EEC does not use student data for targeted advertising or sell Personal Data as an independent commercial product."),

    heading("6. BASES FOR COLLECTION AND PROCESSING"),
    body("Where YarrowTech acts as a Data Fiduciary, processing will be for a lawful purpose on a basis permitted under applicable law. Depending on the circumstances and statutory commencement, this may include consent or a legitimate use expressly recognised by the DPDP Act, such as Personal Data voluntarily provided by a Data Principal for a specified purpose, processing necessary to comply with law, or another applicable statutory ground. [COUNSEL TO CONFIRM EACH PURPOSE-TO-BASIS MAPPING BEFORE PUBLICATION.]"),
    body("Where consent is relied upon, the notice and consent flow should identify the itemised Personal Data and specified purpose, provide a clear affirmative choice, and enable withdrawal with comparable ease. Withdrawal does not affect processing lawfully completed before withdrawal, but may limit the availability of a feature that cannot operate without the relevant data."),
    body("YarrowTech does not use \u2018legitimate interests\u2019 as a standalone basis under the DPDP Act. References in this Policy to administrative, security or legal purposes are subject to the specific lawful basis applicable at the time of processing."),
    body("Where YarrowTech acts as Data Processor, it processes Personal Data under the instructions and contractual arrangements of the subscribing institution, subject to law. The institution must document its lawful purpose and basis, including any authority to process children's data."),

    heading("7. INFORMATION SHARING AND DISCLOSURE"),
    body("YarrowTech may disclose Personal Data only where necessary to provide, maintain, secure or administer the Services; on the responsible Data Fiduciary's instructions; with appropriate authorisation; in connection with a transaction described below; or where permitted or required by law."),
    body("Service providers may support cloud hosting, databases, file or media storage, content delivery, communications and email, authentication, security, monitoring, customer support, analytics, payment processing, AI or language-model services, vector search and other technical functions. They may process Personal Data only for the contracted service and should be subject to appropriate confidentiality, security, deletion and data-protection obligations. [APPROVE AND PUBLISH A CURRENT SUB-PROCESSOR LIST, INCLUDING PROCESSING PURPOSE AND LOCATION.]"),
    body("Payment gateways, banks and payment-service providers may receive information necessary to initiate, verify and reconcile payments. Professional advisers, auditors, insurers, affiliates or group entities may receive limited information where reasonably necessary and lawfully permitted."),
    body("Government authorities, regulators, courts or law-enforcement agencies may receive Personal Data where disclosure is required or authorised by applicable law, court order or lawful direction. YarrowTech will assess the request, disclose only what is legally required and preserve a record where permitted."),
    body("In a merger, acquisition, financing, restructuring, sale of assets or similar corporate transaction, information may be disclosed to relevant parties subject to confidentiality and data-protection safeguards."),
    body("If a subscribing institution enables an integration with a third-party system, necessary information may be exchanged to deliver that integration. The institution must assess and authorise the integration, and processing by an independent third party is governed by that party's terms and privacy policy."),

    heading("8. DISCLOSURE OF DATA BY SUBSCRIBING INSTITUTIONS"),
    body("A subscribing institution may use EEC to process Personal Data relating to students, parents, personnel and other individuals. It must ensure it has authority and a lawful purpose for collection, upload, access, use and disclosure; configure roles and modules appropriately; restrict exports; and provide required notices, rights and parental or guardian processes."),
    body("YarrowTech does not ordinarily decide the educational, employment, safeguarding, assessment or financial purposes for which an institution processes its records. Except where an agreement or law provides otherwise, the institution is responsible for those decisions and for the accuracy and fairness of consequential actions."),

    heading("9. HOW YOU CONTROL YOUR INFORMATION"),
    body("Subject to applicable law, a Data Principal may request information about processing and a summary of Personal Data, correction, completion or updating, erasure where applicable, withdrawal of consent where processing is consent-based, grievance redressal and nomination. Requests may require reasonable verification of identity, relationship, guardianship or authority."),
    body("For data controlled by a school or institution, the request should ordinarily be made to that institution using its published channel. YarrowTech will provide reasonable contractual and technical assistance to the institution. For data for which YarrowTech is the Data Fiduciary, requests may be sent to eec@electroniceducare.com or [INSERT DEDICATED PRIVACY/RIGHTS PORTAL]."),
    body("YarrowTech will acknowledge a verified request within [INSERT BUSINESS-DAY SLA] and provide a substantive response within [INSERT SLA CONSISTENT WITH LAW AND CONTRACT]. Verification will ordinarily use [CONFIRM METHOD: REGISTERED EMAIL OR MOBILE OTP, ACCOUNT LOGIN, AND AUTHORISED-SIGNATORY OR GUARDIAN CONFIRMATION]. If more time is reasonably required, the requester will be informed of the reason and expected completion date."),
    body("A request may be limited or refused where law permits or requires continued processing, where identity or authority cannot reasonably be verified, where erasure would improperly affect another person's rights, or where the request concerns records the institution must preserve. Reasons and the available grievance route will be provided where required."),

    heading("10. CHILDREN'S DATA"),
    body("EEC is designed for educational use and therefore may process Personal Data of persons under eighteen years of age (\u201cchildren\u201d under the DPDP Act). Child accounts must be created, linked and administered only through an approved school and parent or guardian process. Children should receive a concise, age-appropriate explanation of relevant data uses in addition to the notice provided to the parent or lawful guardian."),
    body("Before processing that requires verifiable parental consent under applicable law, the responsible Data Fiduciary must verify that consent is attributable to an adult who is the child's parent or lawful guardian using a method permitted by the DPDP Rules. EEC will support [CONFIRM PRODUCTION MECHANISM: PARENT ACCOUNT PLUS OTP AND SCHOOL-VERIFIED GUARDIAN LINK; ALTERNATIVE IDENTITY/VIRTUAL-TOKEN PROCESS IF REQUIRED], record the consent purpose, notice version, timestamp and withdrawal, and prevent the relevant processing if verification fails."),
    body("Children's data must be limited to what is necessary for authorised educational, safety and institution-administration purposes. It must not be sold, used for targeted advertising, used to manipulate a child, or used for tracking or behavioural monitoring prohibited by law. Educational activity logs, progress analytics and safety monitoring will be limited to approved purposes and subject to legal assessment of the applicable DPDP provisions and exemptions before those provisions commence."),
    body("Schools and authorised adults must not ask children to disclose unnecessary family, health, identity, financial or location information through tutor prompts, journals, chats or uploads. Access to wellbeing, safeguarding and accommodation information must be restricted to personnel with a documented need. A concern about immediate harm may be escalated under the institution's safeguarding process rather than handled solely by an automated system. [INSERT SAFEGUARDING CONTACT AND ESCALATION PROCEDURE.]"),
    body("Parents or guardians may exercise applicable rights for a child through the responsible institution or YarrowTech, as relevant, subject to verification and the child's evolving capacity and other applicable law. When an account holder ceases to be a child, [CONFIRM AGE-TRANSITION AND RE-CONSENT/NOTICE PROCESS]."),

    heading("11. AI-ASSISTED FEATURES, PROFILING AND HUMAN REVIEW"),
    body("EEC may use rules, analytics, retrieval systems, machine-learning models or generative AI to support tutoring, content generation, recommendations, assessment feedback, speech or writing analysis, summaries and institution insights. These outputs are probabilistic, may be incomplete or incorrect and are intended to assist\u2014not replace\u2014qualified educators, administrators, parents, safeguarding professionals or other responsible humans."),
    body("AI outputs must not be treated as the sole basis for admission, grading, discipline, promotion, denial of educational access, safeguarding conclusions, diagnosis of disability or health conditions, or another decision producing a legal or similarly significant effect. The subscribing institution must establish an appropriate human-review and correction route for any consequential use. Students and parents should be told when material content or feedback is AI-generated."),
    body("Only the minimum context needed for an enabled AI purpose should be supplied to a model. Direct identifiers and sensitive context should be excluded or pseudonymised where feasible. Teacher-uploaded materials and student prompts may be embedded or indexed for retrieval. If an external AI provider is enabled, relevant content may be transmitted to that provider only under an approved institutional configuration, contract and processing location. [CONFIRM DEFAULT PROVIDERS, DATA-USE TERMS, RETENTION, TRAINING OPT-OUT AND CROSS-BORDER LOCATIONS.]"),
    body("Users should not rely on EEC for medical, mental-health, legal or emergency advice. Harm, abuse, bullying, self-harm or other safeguarding disclosures should trigger an approved supportive response and human escalation. [IMPLEMENT AND DOCUMENT MODEL EVALUATION, SAFETY TESTING, INCIDENT REVIEW, VERSIONING, OVERRIDE AND APPEAL PROCEDURES BEFORE PRODUCTION RELEASE.]"),

    heading("12. THIRD-PARTY CONTENT"),
    body("The Platform may contain links to or integrations with third-party websites, applications, content or services. Inclusion does not imply endorsement of the third party or its privacy or security practices."),
    body("YarrowTech does not control an independent third party's policies or content. Once a user leaves EEC or provides information directly to that party, the third party's terms and privacy policy apply. Schools should review third-party services before enabling them for children."),

    heading("13. INFORMATION SECURITY"),
    body("YarrowTech endeavours to preserve the confidentiality, integrity and availability of Personal Data and to apply reasonable safeguards appropriate to the nature and risk of processing. Security is a shared responsibility among YarrowTech, subscribing institutions, users and authorised service providers."),
    body("Measures may include tenant isolation, role-based access, authentication and access management, password hashing, encryption or equivalent protection in transit and where appropriate at rest, secrets management, network and application controls, rate limiting, input validation, audit and security logging, monitoring and alerting, backup and recovery, vulnerability and patch management, security testing, personnel confidentiality, vendor review and incident-response procedures."),
    body("Highly sensitive child, wellbeing, payment and credential information should receive enhanced access and encryption controls. Production environments must not use default credentials or development-only access settings. [CONFIRM SECURITY OWNER, ACCESS-REVIEW CADENCE, ENCRYPTION SCOPE, BACKUP LOCATION/RETENTION, PENETRATION-TEST CADENCE AND VENDOR-RISK PROCESS.]"),
    body("No internet, cloud, storage or electronic-transmission method is completely secure. Nothing in this Policy excludes any statutory responsibility or liability that cannot lawfully be excluded."),

    heading("14. PERSONAL DATA BREACHES AND CYBER INCIDENTS"),
    body("YarrowTech will maintain procedures to identify, triage, contain, investigate, document, remediate and review security incidents. Where a Personal Data breach occurs, YarrowTech will take reasonable steps to mitigate harm and comply with notification and reporting requirements under the DPDP framework, the IT Act, CERT-In directions and other applicable law as those requirements apply."),
    body("The internal protocol shall provide that: (i) a suspected incident is reported immediately through [INSERT INCIDENT CHANNEL]; (ii) a confirmed incident is escalated to [INSERT INCIDENT OWNER/TEAM] within [INSERT HOURS]; (iii) an initial impact and child-safety assessment is completed within [INSERT HOURS]; (iv) affected subscribing institutions are notified within [INSERT CONTRACTUAL SLA] through [INSERT CHANNEL]; and (v) the Data Protection Board, CERT-In, affected Data Principals or other authorities are notified within the form and timeline required by law. [APPROVE BREACH PLAYBOOK AND MESSAGE TEMPLATES.]"),
    body("If a breach concerns data processed for a subscribing institution, YarrowTech will provide available facts and reasonable cooperation so that the institution can meet its obligations as Data Fiduciary. Nothing in a contractual SLA extends a shorter statutory reporting deadline."),

    heading("15. DATA RETENTION AND DELETION"),
    body("Personal Data will be retained only for as long as necessary for the documented purpose, to provide the Services, meet a subscribing institution's lawful instructions, comply with law, maintain security, resolve disputes, enforce agreements or establish, exercise or defend legal claims. Data should be deleted or anonymised when its purpose is no longer served unless retention is required by law."),
    body("The following schedule must be finalised before publication: institution, user and authentication data \u2013 subscription or enrolment duration plus [INSERT PERIOD]; academic, attendance and institution records \u2013 as instructed by the institution and [INSERT PERIOD AFTER TERMINATION]; AI tutor conversations and generated outputs \u2013 [INSERT PERIOD]; raw speech/audio uploads \u2013 [INSERT SHORT PERIOD OR IMMEDIATE-DELETION RULE]; embeddings and language-memory records \u2013 [INSERT PERIOD AND DELETION LINKAGE]; messages and support records \u2013 [INSERT PERIOD]; payment and accounting records \u2013 [INSERT STATUTORY PERIOD]; security and access logs \u2013 [INSERT PERIOD CONSISTENT WITH CERT-IN AND OTHER LAW]; backups \u2013 [INSERT CYCLE AND MAXIMUM EXPIRY]."),
    body("On account closure or subscription termination, YarrowTech may return, export, delete or anonymise Personal Data according to the agreement, verified institutional instructions, backup cycles and law. Deletion workflows must cover primary databases, file storage, search/vector stores, AI memory, caches and reasonably accessible backups. [CONFIRM EXPORT FORMAT, DELETION SLA, BACKUP EXPIRY AND CERTIFICATE PROCESS.]"),
    body("Before expiry of a prescribed inactivity period, EEC will provide any advance notice required by the DPDP Rules after the relevant provisions commence. Security logs and legally required records may remain for the applicable statutory period even when other data is deleted."),

    heading("16. PAYMENT INFORMATION"),
    body("EEC may facilitate school fees, subscriptions or other authorised payments through third-party payment-service providers such as a configured payment gateway. The provider may collect card, bank-account, UPI or other payment-instrument information under its own terms and privacy policy. YarrowTech and the institution may receive transaction references, payer details, payment status and reconciliation information."),
    body("Do not send complete card numbers, CVV/CVC, PINs, OTPs, banking passwords or unrelated credentials through email, chat or support channels. Payment-gateway credentials accessible to authorised institution administrators must be protected and encrypted. [CONFIRM PAYMENT PROVIDER(S), MERCHANT-OF-RECORD ROLE, REFUND PROCESS AND PCI RESPONSIBILITY.]"),

    heading("17. COOKIES AND SIMILAR TECHNOLOGIES"),
    body("EEC may use cookies, local storage and similar technologies necessary to maintain sessions, authenticate users, preserve preferences, route users to the correct institution, provide security, monitor reliability and understand use. Non-essential analytics or similar technologies will be used only after any required notice and consent."),
    body("A separate Cookie Policy or consent interface should identify the specific cookies and technologies, provider, purpose, duration and choice. [COMPLETE A PRODUCTION COOKIE/SDK INVENTORY AND IMPLEMENT PREFERENCE CONTROLS BEFORE ENABLING NON-ESSENTIAL TRACKING.]"),

    heading("18. INTERNATIONAL TRANSFER AND PROCESSING"),
    body("YarrowTech may use infrastructure or service providers located outside India. Cross-border processing will comply with restrictions or conditions specified by the Central Government under the DPDP framework and any sectoral or contractual localisation requirement. [INSERT APPROVED HOSTING REGIONS, SUB-PROCESSOR LOCATIONS AND TRANSFER CONTROLS.]"),
    body("Infrastructure locations may change for operational, security or commercial reasons, subject to applicable notice, contractual and legal requirements. A current sub-processor list and processing locations should be made available through [INSERT URL OR REQUEST CHANNEL]."),

    heading("19. INFORMATION TECHNOLOGY ACT AND RULES"),
    body("During the applicable transition and to the extent not repealed or displaced, YarrowTech will comply with the IT Act and relevant rules, including the SPDI Rules where information falls within their scope. Reasonable security practices, privacy notices, consent and other requirements will be applied as required by law."),
    body("The IT Rules, 2021 apply only to the extent an enabled EEC feature falls within the statutory definition of an intermediary or another covered service. Before enabling public or user-to-user content functionality beyond institution-controlled educational communications, YarrowTech will assess and implement applicable due-diligence, takedown, notice and grievance mechanisms. [COUNSEL TO CONFIRM INTERMEDIARY STATUS BY FEATURE.]"),

    heading("20. MARKETING AND COMMERCIAL COMMUNICATIONS"),
    body("YarrowTech and subscribing institutions may send essential account, assignment, fee, meeting, security, maintenance and other service-related communications. These are distinct from promotional communications."),
    body("YarrowTech may send adult institutional representatives information about products, Services, features or offers where permitted and, where required, with consent. Recipients may opt out through the provided mechanism or by contacting YarrowTech. Student contact details will not be used for direct marketing or targeted advertising."),

    heading("21. USER AND INSTITUTION RESPONSIBILITIES"),
    body("Users must provide accurate information, protect credentials, use only their own authorised account, respect role and school boundaries, avoid sharing another person's data without authority, and promptly report suspected compromise or inappropriate access. Users must not attempt to bypass security, scrape records, export data without permission or submit unlawful or harmful content."),
    body("Subscribing institutions must appoint authorised administrators, maintain accurate student-parent and staff links, configure least-privilege access, promptly revoke leavers, manage consent and notices, assess optional integrations and AI features, train users, maintain lawful retention instructions and investigate misuse. Institutions are responsible for their educational, employment, financial and safeguarding decisions."),

    heading("22. GRIEVANCE OFFICER AND PRIVACY CONTACT"),
    body("The Grievance Officer or designated privacy contact for YarrowTech will address complaints and questions concerning Personal Data for which YarrowTech is responsible. These details must remain prominently available on the website or Platform as required by law."),
    body("Name: [INSERT NAME]"),
    body("Designation: [INSERT DESIGNATION]"),
    body("Email Address: [INSERT DEDICATED GRIEVANCE EMAIL; CURRENT GENERAL CONTACT IS eec@electroniceducare.com]"),
    body("Contact Number: +91 9830590929 [CONFIRM FOR PRIVACY/GRIEVANCE USE]"),
    body("Postal Address: [INSERT COMPLETE POSTAL ADDRESS]"),
    body("Grievance acknowledgement and resolution period: [INSERT PERIOD CONSISTENT WITH APPLICABLE LAW]. If the grievance concerns records controlled by a subscribing institution, YarrowTech may direct the person to that institution and provide reasonable assistance."),

    heading("23. DATA PROTECTION OFFICER AND SIGNIFICANT DATA FIDUCIARY"),
    body("YarrowTech will appoint a Data Protection Officer and undertake additional obligations applicable to a Significant Data Fiduciary if and when it is notified as one under the DPDP Act or rules. This Policy does not represent that YarrowTech is currently classified as a Significant Data Fiduciary. [CONFIRM INTERNAL PRIVACY OWNER EVEN IF A STATUTORY DPO IS NOT REQUIRED.]"),

    heading("24. DISCLAIMER AND LIMITATION OF LIABILITY"),
    body("YarrowTech is not responsible for the way a subscribing institution independently decides to collect, use, disclose, retain or act on Personal Data it controls, except to the extent stated in an agreement or required by law. Institutions remain responsible for educational, employment, safeguarding, financial and administrative decisions."),
    body("To the extent legally permissible, YarrowTech is not responsible for loss arising solely from inaccurate or unlawfully supplied information; unauthorised credential use caused by a user's failure to protect an account; actions of independent third-party services outside YarrowTech's reasonable control; or internet, telecommunications and force-majeure events."),
    body("AI-generated content may be inaccurate and requires appropriate human judgment. Nothing in this Policy excludes or limits any responsibility, right or statutory obligation that cannot lawfully be excluded or limited."),

    heading("25. UPDATES AND CHANGES TO THIS POLICY"),
    body("YarrowTech may update this Policy to reflect changes in the Platform, enabled Services, law, regulatory requirements, security practices, subprocessors or business operations. The current version and effective date will be published on the website or Platform."),
    body("Material changes will be notified through the Platform, website, registered email or another legally appropriate channel. If a change requires fresh consent, EEC will seek it through an appropriate mechanism before the affected processing begins."),

    heading("26. TRANSITIONAL PROVISION"),
    body("The DPDP Act and DPDP Rules were brought into force in stages by notifications dated 13 November 2025. As at 26 August 2026, only the provisions specified for commencement on publication are operative. The next stages are scheduled for one year and eighteen months from Gazette publication, including Rule 4 on 13 November 2026 and Rules 3, 5 to 16, 22 and 23 on 13 May 2027, subject to any later notification or corrigendum."),
    body("Until each relevant DPDP provision becomes operative, YarrowTech will continue to comply with the IT Act, SPDI Rules, CERT-In directions and other applicable law to the extent applicable. YarrowTech may implement DPDP-aligned controls earlier as a matter of policy, but this draft must not state or imply certified compliance without operational evidence and legal review."),
    body("This Policy will be reviewed before each commencement milestone and updated for further rules, directions, exemptions, classifications or guidance. [ASSIGN OWNER AND TARGET REVIEW DATES: BEFORE 13 NOVEMBER 2026 AND BEFORE 13 MAY 2027.]"),

    heading("27. GOVERNING LAW"),
    body("This Policy is governed by the laws of India. Subject to mandatory law and any dispute-resolution clause in the applicable EEC subscription agreement or terms, courts and tribunals having jurisdiction at [INSERT CITY AND STATE] will have jurisdiction over matters arising from this Policy."),

    heading("28. CONTACT INFORMATION"),
    body("For questions about this Policy or YarrowTech's processing of Personal Data, contact:"),
    body("YarrowTech legal name: [INSERT FULL LEGAL NAME AND ENTITY TYPE]"),
    body("Product: EEC \u2013 Electronic Educare"),
    body("Website: https://electroniceducare.com"),
    body("Address: [INSERT COMPLETE POSTAL ADDRESS]"),
    body("Email: eec@electroniceducare.com [CONFIRM OR REPLACE WITH PRIVACY EMAIL]"),
    body("Telephone: +91 9830590929 [CONFIRM]"),
]


def make_run(text: str, *, bold: bool = False, italic: bool = False, red: bool = False) -> ET.Element:
    run = ET.Element(qn(W, "r"))
    if bold or italic or red:
        rpr = ET.SubElement(run, qn(W, "rPr"))
        if bold:
            ET.SubElement(rpr, qn(W, "b"))
        if italic:
            ET.SubElement(rpr, qn(W, "i"))
        if red:
            ET.SubElement(rpr, qn(W, "color"), {qn(W, "val"): "C00000"})
    node = ET.SubElement(run, qn(W, "t"))
    if text.startswith(" ") or text.endswith(" "):
        node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    node.text = text
    return run


def make_paragraph(kind: str, text: str, prototypes: dict[str, ET.Element]) -> ET.Element:
    paragraph = ET.Element(qn(W, "p"))
    proto = prototypes[kind]
    ppr = proto.find(qn(W, "pPr"))
    if ppr is not None:
        paragraph.append(copy.deepcopy(ppr))

    if kind == "notice":
        paragraph.append(make_run(text, bold=True, red=True))
        return paragraph

    if kind in {"title", "subtitle"}:
        paragraph.append(make_run(text, bold=True))
        return paragraph

    if kind == "heading":
        paragraph.append(make_run(text))
        return paragraph

    # Redline unresolved operational/legal fields while keeping the surrounding prose clean.
    cursor = 0
    for match in re.finditer(r"\[[^\]]+\]", text):
        if match.start() > cursor:
            paragraph.append(make_run(text[cursor:match.start()]))
        paragraph.append(make_run(match.group(0), bold=True, red=True))
        cursor = match.end()
    if cursor < len(text):
        paragraph.append(make_run(text[cursor:]))
    return paragraph


def generate() -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Template not found: {TEMPLATE}")

    with ZipFile(TEMPLATE) as zin:
        files = {name: zin.read(name) for name in zin.namelist()}

    document = ET.fromstring(files["word/document.xml"])
    doc_body = document.find(qn(W, "body"))
    if doc_body is None:
        raise RuntimeError("Template document has no body")
    existing = list(doc_body.findall(qn(W, "p")))
    if len(existing) < 7:
        raise RuntimeError("Template does not contain the expected paragraph styles")

    prototypes = {
        "title": existing[0],
        "subtitle": existing[1],
        "center": existing[2],
        "notice": existing[1],
        "heading": existing[5],
        "body": existing[6],
    }
    sect_pr = doc_body.find(qn(W, "sectPr"))
    saved_sect_pr = copy.deepcopy(sect_pr) if sect_pr is not None else None
    for child in list(doc_body):
        doc_body.remove(child)
    for kind, text in CONTENT:
        doc_body.append(make_paragraph(kind, text, prototypes))
    if saved_sect_pr is not None:
        doc_body.append(saved_sect_pr)

    files["word/document.xml"] = ET.tostring(document, encoding="utf-8", xml_declaration=True)

    footer = ET.fromstring(files["word/footer1.xml"])
    footer_p = footer.find(qn(W, "p"))
    if footer_p is not None:
        for child in list(footer_p):
            if child.tag == qn(W, "r"):
                footer_p.remove(child)
        footer_p.append(make_run("EEC \u2013 Electronic Educare | Privacy Policy | Draft for review"))
    files["word/footer1.xml"] = ET.tostring(footer, encoding="utf-8", xml_declaration=True)

    core = ET.fromstring(files["docProps/core.xml"])
    values = {
        qn(DC, "title"): "EEC \u2013 Electronic Educare Privacy Policy",
        qn(DC, "subject"): "India privacy-policy draft with procedural review fields",
        qn(DC, "creator"): "YarrowTech / EEC",
        qn(CP, "lastModifiedBy"): "OpenAI Codex",
        qn(DC, "description"): "Adapted from the supplied privacy-policy template for EEC's education ERP, LMS and AI-assisted services.",
    }
    for tag, value in values.items():
        node = core.find(tag)
        if node is None:
            node = ET.SubElement(core, tag)
        node.text = value
    files["docProps/core.xml"] = ET.tostring(core, encoding="utf-8", xml_declaration=True)

    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)

    print(OUTPUT)


if __name__ == "__main__":
    generate()

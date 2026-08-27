#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { jsPDF } = require('../frontend/node_modules/jspdf');

const outputPath = path.join(__dirname, 'EEC_Clause_Review_and_Recommended_Changes.pdf');
const fontRegular = '/usr/share/fonts/truetype/lato/Lato-Medium.ttf';
const fontBold = '/usr/share/fonts/truetype/lato/Lato-Semibold.ttf';

const rows = [
  {
    no: '1',
    clause: '1.1 Legal Name',
    text: '**EEC – Electronic Educare** is the product name. The contracting/operator entity should be stated as **YarrowTech [insert full legal name and entity type]**, operating EEC – Electronic Educare. Do not use only the product name where the legal entity is required.'
  },
  {
    no: '2',
    clause: '1.2 Product, Terms and Privacy Links',
    text: '**Product website:** https://electroniceducare.com\n\n**Terms and Conditions:** [publish and confirm URL, suggested: https://electroniceducare.com/terms]\n\n**Privacy Policy:** [publish and confirm URL, suggested: https://electroniceducare.com/privacy]\n\nThe Terms and Privacy Policy must be available before account creation and from every user portal.'
  },
  {
    no: '3',
    clause: '1.4 Non-acceptance of Updated Terms / Privacy Policy',
    text: 'If a subscribing institution or adult user does not agree to updated Terms and Conditions or a revised Privacy Policy, they may discontinue use of the affected Services, subject to the applicable subscription agreement, school-record obligations and lawful retention. Continued use after the effective date may constitute acceptance only where legally valid. **Fresh affirmative consent must be obtained where a material change requires it; silence or continued use must not be treated as consent where the law requires an affirmative action.**'
  },
  {
    no: '4',
    clause: '2.1 Definitions – Institutions and Users',
    text: '**2.1(a) Subscribing Institution / School:**\nA school, educational institution, training organisation or other authorised entity that subscribes to and administers EEC for approved educational and administrative purposes.\n\n**2.1(b) Institution Administrator:**\nAn authorised representative who configures the institution tenant, creates or approves accounts, assigns roles and manages institution records.\n\n**2.1(c) Teacher / Staff User:**\nAn authorised educator, principal, counsellor, administrator or other staff member using EEC within assigned duties and permissions.\n\n**2.1(d) Student:**\nA learner whose account or educational record is created or administered through an institution. A Student may be a child under Indian law, in which case the applicable parent or lawful-guardian process applies.\n\n**2.1(e) Parent / Guardian:**\nA verified parent or lawful guardian linked to a Student and authorised to access the limited parent-facing Services.\n\nTogether, these persons may be referred to as **Users**, but their rights and permitted access are not identical.'
  },
  {
    no: '5',
    clause: '2.2 User and Student Details',
    text: 'The Terms and Privacy Policy should identify the information processed for each user group. Depending on enabled modules, this may include:\n\n**Institution:** legal/business name, affiliation or registration, branches, address, official contacts, subscription and authorised representative.\n\n**Teachers and staff:** name, employee identifier, role, allocation, contact, authentication, attendance/leave and activity records.\n\n**Students:** name, photograph, age/date of birth, admission/roll number, class/section, parent linkage, contact/address where required, attendance, assignments, examinations, grades, feedback, learning progress, communications, uploaded content and support records.\n\n**Parents/guardians:** name, relationship, contact, authentication, consent/authorisation and communication records.\n\n**AI-assisted features:** prompts, tutor conversations, uploaded learning materials, writing samples, reading/speech recordings, transcripts, generated feedback and recommendations.\n\n**Technical/payment:** device and access logs, support information, invoices, payment status and transaction references.\n\nState the purpose, role, recipient and retention for each category in the Privacy Policy.'
  },
  {
    no: '6',
    clause: '3.3 Institution Verification and Account Administration',
    text: 'For onboarding and tenant-security purposes, EEC may require a subscribing institution to provide its name, address, board/affiliation or registration information, official email and telephone number, website, authorised representative, school administrator and supporting documents reasonably necessary to establish identity and authority.\n\nThe institution must ensure submitted information is **true, accurate, complete, valid and current**. EEC may request additional evidence where reasonably necessary for security, fraud prevention, contractual compliance or tenant legitimacy. Government identifiers should not be collected unless necessary and lawfully approved.\n\nStudent, parent, teacher and staff accounts must be created or imported only by authorised persons using an approved process. Role assignments and student–guardian links must be verified and periodically reviewed.'
  },
  {
    no: '7',
    clause: '4.3 Subscription, Fee and Refund Policy',
    text: '**(a) EEC subscription charges:**\nCancellation, renewal, upgrade, downgrade, tax and refund terms for an institution’s EEC subscription shall be governed by its order form or subscription agreement. The public Terms must not promise a fixed refund unless that commercial policy has been approved.\n\n**(b) School fees and institution charges:**\nWhere EEC facilitates payment of school fees or another institution charge, the subscribing institution ordinarily determines the amount, due date, concession, cancellation and refund eligibility. EEC provides technology and payment-status/reconciliation support unless the applicable agreement states otherwise.\n\n**(c) Payment provider:**\nTransactions may be processed through the payment gateway configured for the institution, including Razorpay where enabled. The provider’s processing time and payment/refund rules may apply. Users must not send card numbers, CVV/CVC, PINs, OTPs or banking passwords through ordinary support channels.\n\n**(d) Processing of approved refunds:**\nAn approved refund should be returned through the original or otherwise authorised payment method. Credit time may depend on the institution, gateway, bank, card issuer or payment service provider.\n\n**[Confirm merchant-of-record roles, refund authority, gateway charges, timelines and support escalation before publication.]**'
  },
  {
    no: '8',
    clause: '4.6 Devices and Availability',
    text: 'EEC may be accessed through supported web browsers and devices with an internet connection. Mobile, progressive-web-app, Google Play or Apple App Store availability should be stated **only for versions actually released and supported**. EEC may update minimum browser, operating-system, device or connectivity requirements and should give reasonable notice of material changes.'
  },
  {
    no: '9',
    clause: '5.2 Accurate Information',
    text: 'Add **“correct”** and use the complete phrase: “Users and subscribing institutions must provide and maintain **true, accurate, complete, correct and current** information.” The Terms should also require prompt correction of account, enrolment, guardian-link, role, contact and payment information.'
  },
  {
    no: '10',
    clause: 'Privacy Policy – Contractual Incorporation',
    text: 'State that the EEC Privacy Policy forms part of the contractual framework governing use of the Platform. Acceptance of the Terms confirms acknowledgement that the User has received and read the Privacy Policy; it does **not** convert acknowledgement into consent for every processing purpose. Consent must be obtained separately where applicable law requires it.'
  },
  {
    no: '11',
    clause: '6 Children and Parent / Guardian Authorisation',
    text: 'EEC is intended for educational use and may process Personal Data of persons under eighteen years of age. Child accounts must be created, linked and administered through an approved institution and parent/lawful-guardian process.\n\nBefore processing that requires verifiable parental consent, the responsible Data Fiduciary must verify the parent or lawful guardian using a legally permitted mechanism and record the notice version, purpose, affirmative action, timestamp and withdrawal. **[Confirm the production mechanism, such as parent account plus OTP and school-verified guardian linkage.]**\n\nChildren’s data must not be sold, used for targeted advertising, used to manipulate a child or subjected to tracking/behavioural monitoring prohibited by law. Educational analytics and activity records must be limited to approved learning, safety and administration purposes. Provide an age-appropriate notice to Students.'
  },
  {
    no: '12',
    clause: '7.2 Role of EEC and Subscribing Institutions',
    text: 'Clarify the data-protection roles by purpose. A subscribing institution will ordinarily act as **Data Fiduciary** for student, parent, staff, academic, attendance, wellbeing, fee and other institution records because it determines why those records are processed. YarrowTech/EEC will ordinarily act as **Data Processor** for that processing.\n\nYarrowTech may separately act as Data Fiduciary for its own demonstration enquiries, subscriptions, platform-level account security, billing, fraud prevention, support, service administration and legal compliance. The subscription and data-processing agreement should allocate notices, consent, rights, security, breaches, retention, subprocessors and deletion.'
  },
  {
    no: '13',
    clause: '7.4 Prohibited Activities',
    text: 'Prohibit Users from: gaining or attempting unauthorised access; crossing institution, class, student or role boundaries; impersonating another person; sharing credentials; scraping, exporting or disclosing records without authority; introducing malware; disrupting the Platform; exploiting vulnerabilities; evading security or rate limits; submitting unlawful, abusive or harmful content; manipulating assessments or academic records; using AI features to cheat, harm, harass or obtain prohibited information; performing prompt-injection or data-exfiltration attacks; or using EEC contrary to law, school policy or the Terms.'
  },
  {
    no: '14',
    clause: '7.4(f) Cloning, Piracy and Reverse Engineering',
    text: 'Add **“clone”** and **“piracy.”** The clause should prohibit cloning, pirating, copying, reproducing, modifying, republishing, reverse engineering, decompiling, circumventing technical protection or creating unauthorised derivative versions of EEC, its source code, models, interfaces, content, databases or Services, except to the limited extent that applicable law expressly permits and does not allow contractual restriction.'
  },
  {
    no: '15',
    clause: '7.4.10 Student, Customer and Location Data',
    text: 'The prohibited-use and confidentiality clause should expressly cover unauthorised collection, access, inference, export, disclosure, sale or exploitation of **student, parent, teacher, staff, customer, wellbeing, assessment, communication, payment, device and location information**. Users must not attempt to identify another institution’s users or combine EEC data with outside data for surveillance, profiling, discrimination or an unrelated purpose.'
  },
  {
    no: '16',
    clause: '8 Payments',
    text: 'Payments facilitated through EEC may include:\n\n1. **Institution subscription and implementation charges** payable under the applicable agreement.\n2. **School fees or institution-authorised charges** payable by parents, guardians or other authorised payers.\n3. **Optional paid modules or services** expressly ordered by the institution.\n\nDo not include external advertisements, boosted posts or unrelated marketplace payments unless those features are actually approved and launched. State the merchant, gateway, taxes, invoice, settlement, refund and grievance roles for each payment flow.'
  },
  {
    no: '17',
    clause: '9 AI-Assisted Learning and Academic Decisions',
    text: 'EEC may use rules, analytics, retrieval, machine learning or generative AI for tutoring, content generation, recommendations, summaries and reading, writing or speech feedback. AI outputs are probabilistic and may be incomplete, inaccurate or biased.\n\nAI output must not be the sole basis for admission, grading, promotion, discipline, denial of educational access, safeguarding findings, disability/health diagnosis or another consequential decision. The institution must provide qualified human review and a correction or appeal route. Students and parents should be told when material content or feedback is AI-generated.\n\nOnly minimum approved context should be provided to a model. Customer content must not leak across schools. **[Confirm external AI providers, training restrictions, retention, locations, evaluations, safety controls, model versioning and human-override procedure.]**'
  },
  {
    no: '18',
    clause: '10 Communications and User-Generated Content',
    text: 'Where EEC enables messages, posts, comments, journals, files, meetings or other user-generated content, Users must communicate lawfully and respectfully. The institution is responsible for appropriate moderation, user access and safeguarding escalation within its tenant.\n\nEEC may apply proportionate technical moderation for security and safety, but must not promise that every communication is monitored. Restricted wellbeing or safeguarding information should be visible only to personnel with a documented need. Public-content or intermediary features require a separate assessment under the IT Act and current IT Rules.'
  },
  {
    no: '19',
    clause: '11 User Responsibilities',
    text: '**11.1** Users must provide true, accurate, complete, correct and current information.\n\n**11.2** Users may use EEC only for lawful, authorised educational and administrative purposes and within their assigned role.\n\n**11.3** Users must protect credentials, use only their own account and promptly report suspected compromise.\n\n**11.4** Students must follow assessment integrity and acceptable-use rules and must not present AI-generated work as their own where prohibited.\n\n**11.5** Teachers and staff must verify important academic, behavioural, wellbeing and AI-generated information before acting on it.\n\n**11.6** Parents/guardians may access only Students lawfully linked to their account and must keep relationship/contact details current.\n\n**11.7** Users must not upload another person’s Personal Data, photograph, recording or confidential document without authority.\n\n**11.8** Users must not disclose unnecessary family, medical, identity, financial or precise-location information through tutor prompts, chats, journals or support.\n\n**11.9** Users must follow reasonable security, safeguarding and school instructions.\n\n**11.10** Users must not submit false, misleading, fraudulent, defamatory, abusive, discriminatory or unlawful content.\n\n**11.11** Users must not transfer, sell or commercially exploit accounts, access links, reports, content or credentials unless expressly authorised.\n\n**11.12** Access may be restricted, suspended or terminated for breach, without limiting other lawful remedies. For a child or educational record, suspension must not destroy records the institution must preserve or improperly deny lawful access.'
  },
  {
    no: '20',
    clause: '12 Institution and Administrator Responsibilities',
    text: 'Subscribing institutions and their administrators must: establish lawful purposes and provide required notices; obtain and manage parent/guardian consent where applicable; verify student–guardian and staff links; configure least-privilege access; promptly revoke leavers; ensure teacher/class allocation; review optional integrations and AI features; respond to Data Principal requests; provide retention/deletion instructions; train Users; investigate misuse; and maintain appropriate safeguarding and grievance processes.\n\nThe institution remains responsible for educational, employment, financial and safeguarding decisions and must not rely blindly on generated recommendations or scores.'
  },
  {
    no: '21',
    clause: '15.3 Intellectual Property and Trademarks',
    text: 'The EEC software, design, databases, documentation, original content, branding and associated intellectual property are owned by or licensed to the applicable YarrowTech entity, subject to third-party and user rights. The Terms should grant only a limited, non-exclusive, non-transferable right to use the Services during the authorised subscription.\n\nState that the **EEC / Electronic Educare name and logo are trademarks only after confirming registration or the legal basis for the claim. [Confirm trademark owner, registration/application numbers and permitted symbol.]** Customer and User content remains subject to the ownership and licence terms expressly agreed.'
  },
  {
    no: '22',
    clause: '17.3 Account Closure, Data Return and Deletion',
    text: 'Replace any absolute statement that all data is immediately deleted from the database. Use a complete lifecycle clause:\n\nFollowing a verified request, account closure or subscription termination, EEC will return, delete or anonymise Personal Data according to the responsible institution’s lawful instructions, the applicable agreement, technical backup cycles and legal obligations. Certain academic, financial, audit, security, dispute or statutory records may be retained where required.\n\nDeletion must address primary databases, uploaded files, search/vector stores, AI memory, caches and subprocessors, with backup copies expiring through the approved cycle. **[Confirm export format, active-system deletion SLA, backup expiry, legal holds, Qdrant/vector deletion and deletion-certificate process.]**'
  },
  {
    no: '23',
    clause: '18 Privacy, Grievance and Customer Support',
    text: '**General support:**\nEmail: eec@electroniceducare.com\nTelephone: +91 9830590929\nWebsite: https://electroniceducare.com\n\n**Privacy / Grievance Officer:**\nName: [insert]\nDesignation: [insert]\nDedicated email: [insert]\nTelephone: [confirm whether the general number will be used]\nPostal address: [insert complete address]\nAcknowledgement and resolution target: [insert legally and operationally approved period]\n\nPrivacy and statutory grievances should be distinguishable from ordinary technical support. If a school controls the relevant record, EEC may route the request to that institution while providing reasonable assistance.'
  },
  {
    no: '24',
    clause: '19 Security Incidents and Personal Data Breaches',
    text: 'Add a provision stating that YarrowTech/EEC maintains procedures to identify, contain, investigate, document, remediate and review security incidents. Users and institutions must promptly report suspected compromise through **[insert incident channel]**.\n\nWhere applicable, EEC will notify the responsible institution, affected Data Principals, the Data Protection Board, CERT-In or another authority in the legally required form and timeline. The internal process must support the six-hour CERT-In assessment/reporting path for specified cyber incidents and must not allow a contractual deadline to extend a shorter statutory deadline. **[Approve incident owner, 24x7 contact tree, customer SLA and templates.]**'
  },
  {
    no: '25',
    clause: '20 Governing Law and DPDP Transition',
    text: 'The Terms and Privacy Policy should be governed by Indian law, subject to mandatory rights and the dispute clause in the applicable institution agreement. Courts at **[insert city and state after confirming the legal entity’s office and contract position]** may have jurisdiction.\n\nThe documents should recognise the staged commencement of the DPDP Act and DPDP Rules. They must be reviewed before the next applicable commencement milestones and whenever MeitY, CERT-In or a sector regulator issues a material change. Do not claim certified or complete DPDP compliance without operational evidence and legal review.'
  }
];

const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
doc.setProperties({
  title: 'EEC – Electronic Educare Clause Review and Recommended Changes',
  subject: 'Terms, privacy, payments, child-data, AI and operational clause recommendations for EEC',
  author: 'YarrowTech / EEC',
  creator: 'OpenAI Codex'
});
doc.addFileToVFS('Lato-Regular.ttf', fs.readFileSync(fontRegular).toString('base64'));
doc.addFont('Lato-Regular.ttf', 'Lato', 'normal');
doc.addFileToVFS('Lato-Bold.ttf', fs.readFileSync(fontBold).toString('base64'));
doc.addFont('Lato-Bold.ttf', 'Lato', 'bold');

const pageWidth = 210;
const pageHeight = 297;
const marginX = 6;
const top = 7;
const bottom = 10;
const widths = [11, 58, 129];
const xs = [marginX, marginX + widths[0], marginX + widths[0] + widths[1]];
const lineHeight = 4.05;
const fontSize = 8.3;
const paddingX = 1.8;
const paddingY = 1.8;
const headerHeight = 13;
let y = top;

function setFont(style = 'normal', size = fontSize) {
  doc.setFont('Lato', style);
  doc.setFontSize(size);
}

function breakLongToken(token, maxWidth, style) {
  setFont(style);
  if (doc.getTextWidth(token) <= maxWidth) return [token];
  const pieces = [];
  let current = '';
  for (const char of token) {
    const test = current + char;
    if (current && doc.getTextWidth(test) > maxWidth) {
      pieces.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function layoutRichText(markup, maxWidth, forceBold = false) {
  const lines = [[]];
  let currentWidth = 0;
  let bold = forceBold;
  const tokens = markup.split(/(\*\*|\n|\s+)/).filter((token) => token !== '');

  function newLine() {
    lines.push([]);
    currentWidth = 0;
  }

  for (const token of tokens) {
    if (token === '**') {
      if (!forceBold) bold = !bold;
      continue;
    }
    if (token === '\n') {
      newLine();
      continue;
    }
    const style = bold ? 'bold' : 'normal';
    const normalized = token.replace(/\s+/g, ' ');
    if (normalized === ' ' && currentWidth === 0) continue;
    const pieces = breakLongToken(normalized, maxWidth, style);
    for (const piece of pieces) {
      setFont(style);
      const width = doc.getTextWidth(piece);
      if (currentWidth > 0 && currentWidth + width > maxWidth) newLine();
      const value = currentWidth === 0 ? piece.replace(/^ +/, '') : piece;
      setFont(style);
      const valueWidth = doc.getTextWidth(value);
      if (value) lines[lines.length - 1].push({ text: value, style, width: valueWidth });
      currentWidth += valueWidth;
    }
  }
  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

function drawRichLines(lines, x, startY) {
  lines.forEach((line, index) => {
    let cursorX = x;
    for (const span of line) {
      setFont(span.style);
      doc.text(span.text, cursorX, startY + index * lineHeight, { baseline: 'top' });
      cursorX += span.width;
    }
  });
}

function drawHeader() {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 248, 248);
  doc.rect(marginX, y, widths[0], headerHeight, 'FD');
  doc.rect(xs[1], y, widths[1], headerHeight, 'FD');
  doc.rect(xs[2], y, widths[2], headerHeight, 'FD');
  setFont('bold', 9.2);
  doc.text('No.', marginX + widths[0] / 2, y + 4.7, { align: 'center', baseline: 'top' });
  doc.text('Clause', xs[1] + widths[1] / 2, y + 4.7, { align: 'center', baseline: 'top' });
  doc.text('What should be added / changed for EEC – Electronic Educare', xs[2] + widths[2] / 2, y + 4.7, { align: 'center', baseline: 'top' });
  y += headerHeight;
}

function newPage() {
  doc.addPage();
  y = top;
  drawHeader();
}

function drawRow(row) {
  let numberLines = layoutRichText(row.no, widths[0] - 2 * paddingX, true);
  let clauseLines = layoutRichText(row.clause, widths[1] - 2 * paddingX, true);
  let bodyLines = layoutRichText(row.text, widths[2] - 2 * paddingX, false);
  let firstChunk = true;

  while (numberLines.length || clauseLines.length || bodyLines.length) {
    let available = pageHeight - bottom - y;
    if (available < 18) {
      newPage();
      available = pageHeight - bottom - y;
    }
    const maxLines = Math.max(1, Math.floor((available - 2 * paddingY) / lineHeight));
    const longest = Math.max(numberLines.length, clauseLines.length, bodyLines.length);
    const take = Math.min(longest, maxLines);
    const nChunk = firstChunk ? numberLines.splice(0, take) : [];
    const cChunk = firstChunk ? clauseLines.splice(0, take) : [];
    const bChunk = bodyLines.splice(0, take);
    if (!firstChunk) {
      numberLines = [];
      clauseLines = [];
    }
    const usedLines = Math.max(1, nChunk.length, cChunk.length, bChunk.length);
    const height = usedLines * lineHeight + 2 * paddingY;

    doc.setDrawColor(0);
    doc.setLineWidth(0.25);
    doc.rect(marginX, y, widths[0], height);
    doc.rect(xs[1], y, widths[1], height);
    doc.rect(xs[2], y, widths[2], height);
    drawRichLines(nChunk, marginX + paddingX, y + paddingY);
    drawRichLines(cChunk, xs[1] + paddingX, y + paddingY);
    drawRichLines(bChunk, xs[2] + paddingX, y + paddingY);
    y += height;
    firstChunk = false;

    if (bodyLines.length) newPage();
  }
}

drawHeader();
rows.forEach(drawRow);

const pages = doc.getNumberOfPages();
for (let page = 1; page <= pages; page += 1) {
  doc.setPage(page);
  setFont('normal', 7.2);
  doc.setTextColor(85);
  doc.text(`EEC clause review – draft for legal and operational confirmation | Page ${page} of ${pages}`, pageWidth / 2, pageHeight - 5.2, { align: 'center' });
  doc.setTextColor(0);
}

fs.writeFileSync(outputPath, Buffer.from(doc.output('arraybuffer')));
console.log(outputPath);

import xlsxwriter

wb = xlsxwriter.Workbook("EEC ML — Full Workflow & Model Connections.xlsx")

# ── Palette ─────────────────────────────────────────────────────────────────
DARK   = "#1E293B"; BLUE   = "#1D4ED8"; PURPLE = "#6D28D9"
TEAL   = "#0F766E"; ORANGE = "#C2410C"; ROSE   = "#BE123C"
INDIGO = "#3730A3"; GREEN  = "#166534"; AMBER  = "#92400E"
SLATE  = "#334155"; CYAN   = "#0E7490"

DONE_BG="#DCFCE7"; DONE_FG="#166534"
PART_BG="#FEF9C3"; PART_FG="#854D0E"
NO_BG  ="#FEE2E2"; NO_FG  ="#991B1B"
PLAN_BG="#EDE9FE"; PLAN_FG="#5B21B6"
HEAD_BG="#F1F5F9"; HEAD_FG="#0F172A"

def F(bold=False,bg="#FFFFFF",fg="#000000",sz=10,border=1,wrap=False,align="left",italic=False):
    return wb.add_format({"bold":bold,"bg_color":bg,"font_color":fg,"font_size":sz,
        "border":border,"border_color":"#CBD5E1","text_wrap":wrap,
        "valign":"vcenter","align":align,"italic":italic})

fTITLE = F(bold=True,bg=DARK,   fg="#FFFFFF",sz=15,border=0)
fSUB   = F(bold=True,bg=BLUE,   fg="#FFFFFF",sz=11)
fCAT   = F(bold=True,bg="#E2E8F0",fg=DARK,  sz=10)
fHEAD  = F(bold=True,bg=HEAD_BG,fg=HEAD_FG, sz=10)
fBOLD  = F(bold=True)
fPLAIN = F()
fWRAP  = F(wrap=True)
fITAL  = F(italic=True,fg="#64748B")

fDONE  = F(bg=DONE_BG,fg=DONE_FG)
fPART  = F(bg=PART_BG,fg=PART_FG)
fNO    = F(bg=NO_BG,  fg=NO_FG)
fPLAN  = F(bg=PLAN_BG,fg=PLAN_FG)

fST    = F(bold=True,bg="#DBEAFE",fg="#1E3A8A")   # student
fTE    = F(bold=True,bg="#D1FAE5",fg="#065F46")   # teacher
fAD    = F(bold=True,bg="#FEF3C7",fg="#92400E")   # admin
fPA    = F(bold=True,bg="#FCE7F3",fg="#9D174D")   # parent

fSTp   = F(bg="#DBEAFE",fg="#1E3A8A")
fTEp   = F(bg="#D1FAE5",fg="#065F46")
fADp   = F(bg="#FEF3C7",fg="#92400E")
fPAp   = F(bg="#FCE7F3",fg="#9D174D")

def status_fmt(s):
    return {"Built":fDONE,"Partial":fPART,"Planned":fPLAN,"Not Started":fNO}.get(s,fPLAIN)

def setup(name, color, title=None):
    ws = wb.add_worksheet(name)
    ws.set_tab_color(color)
    ws.freeze_panes(3,0)
    ws.set_row(0,32); ws.set_row(1,6); ws.set_row(2,18)
    ws.merge_range(0,0,0,20, title or f"EEC ML — {name}", fTITLE)
    return ws

def heads(ws, cols_widths, row=2):
    for c,(h,w) in enumerate(cols_widths):
        ws.set_column(c,c,w); ws.write(row,c,h,fHEAD)

def cat(ws, r, ncols, text):
    ws.merge_range(r,0,r,ncols-1,text,fCAT)
    return r+1

def row_write(ws, r, vals, fmts):
    for c,(v,f) in enumerate(zip(vals,fmts)):
        ws.write(r,c,v,f)
    return r+1


# ════════════════════════════════════════════════════════════════════════════
# SHEET 1 — MASTER WORKFLOW  (the big picture, top-down)
# ════════════════════════════════════════════════════════════════════════════
ws1 = setup("01 Master Workflow", INDIGO, "EEC ML — Master AI Workflow (All Systems)")
heads(ws1, [
    ("Step #",6),("Actor",14),("Action / Event",38),("Models Triggered",36),
    ("AI Service Called",28),("Output / Result",40),("Next Step",10),("Status",12)
])

master = [
# TEACHER SIDE
["TEACHER — CONTENT CREATION & UPLOAD"],
["T-1","Teacher","Uploads PDF / DOCX / PPTX teaching material via portal",
 "TeachingMaterial.js","POST /api/teaching-material",
 "File stored on Cloudinary; TeachingMaterial record created in MongoDB","T-2","Built"],
["T-2","AI Service","OCR + text extraction + chunking",
 "TeachingMaterial.js","POST /ingest/material → documents module",
 "Raw text extracted; split into chunks with start_char offsets","T-3","Built"],
["T-3","AI Service","Embedding generation (nomic-embed-text)",
 "—","embeddings module → Ollama",
 "768-dim vector per chunk","T-4","Built"],
["T-4","AI Service","Upsert chunks into Qdrant with metadata",
 "—","Qdrant upsert",
 "Chunks searchable by school_id / class_id / subject / chapter / topic","T-5","Built"],
["T-5","AI Service","[PLANNED] Auto-generate Learning Outcomes per chapter",
 "TeachingMaterial.js","PLANNED: Bloom Engine → LLM",
 "Learning outcome tags stored on TeachingMaterial record","T-6","Planned"],
["T-6","AI Service","[PLANNED] Bloom-classify each chunk",
 "—","PLANNED: bloom module",
 "Each chunk tagged: remember / understand / apply / analyze / evaluate / create","—","Planned"],

# STUDENT — BASELINE
["STUDENT — ONBOARDING & BASELINE"],
["S-1","Student","Takes Baseline Quiz on joining",
 "BaselineQuiz.js + BaselineResult.js","POST /api/baseline/attempt",
 "Initial mastery estimate per subject recorded","S-2","Built"],
["S-2","Backend","[PLANNED] Baseline result auto-feeds Mastery Engine",
 "MasteryScore.js","masteryEngine.js → upsert MasteryScore",
 "Starting mastery score (0-100) set per topic for the student","S-3","Planned"],

# STUDENT — AI TUTOR SESSION
["STUDENT — AI TUTOR SESSION (RAG)"],
["R-1","Student","Asks question / selects mode in AI Tutor",
 "TutorConversation.js","POST /api/ai-tutor/chat",
 "Request routed to ai-service with school/class/subject context","R-2","Built"],
["R-2","AI Service","Embed student question → retrieve relevant chunks from Qdrant",
 "TeachingMaterial.js (via Qdrant)","retrieval module",
 "Top-N chunks returned (chapter-scoped first, subject-wide fallback)","R-3","Built"],
["R-3","AI Service","Strip teacher notes from retrieved context",
 "—","parser/cleaner.py → _strip_teacher_notes()",
 "Clean context passed to LLM","R-4","Built"],
["R-4","AI Service","LLM generates mode-specific response (Qwen / llama3.2)",
 "—","chat module → ChatOllama",
 "Response: explanation / quiz JSON / flashcard JSON / mindmap / notes / homework hint","R-5","Built"],
["R-5","Student","Receives response in mode-specific UI",
 "TutorConversation.js","—",
 "QuizUI / FlashcardUI / MindMapUI / NotesUI / HomeworkHelpUI rendered","R-6","Built"],
["R-6","Backend","[PLANNED] Save quiz result → trigger Mastery Engine",
 "MasteryScore.js + TryoutResult.js","masteryEngine.js",
 "Mastery score updated; badge check; spaced rep scheduled; teacher alert if low","—","Planned"],

# STUDENT — ASSESSMENT
["STUDENT — FORMAL ASSESSMENT (Quiz / Exam / Practice Paper)"],
["A-1","Student","Attempts Practice Paper / Exam / Mock Exam",
 "PracticeAttempt.js / ExamAttempt.js","POST /api/practice/attempt or /api/exam/attempt",
 "Attempt recorded with answers","A-2","Built"],
["A-2","Backend / AI","[PLANNED] Answer Evaluation Engine scores each answer",
 "ExamResult.js","PLANNED: ai-service /evaluate/answer",
 "Returns: marks / rubric / strengths / weaknesses / missing concepts / Bloom level","A-3","Planned"],
["A-3","AI Service","[PLANNED] Error Classification",
 "ExamAttempt.js","PLANNED: error_classifier module",
 "Each wrong answer tagged: Concept / Calculation / Reading / Logic error","A-4","Planned"],
["A-4","Backend","[PLANNED] Mastery Engine auto-update",
 "MasteryScore.js","masteryEngine.js",
 "Score updated using: accuracy + attempts + recency + time. Badge awarded if threshold hit.","A-5","Partial"],
["A-5","Backend","[PLANNED] Spaced Repetition scheduler",
 "SpacedRepetitionSchedule.js","spacedRepetitionRoutes.js (SM-2 logic)",
 "Next review date calculated per topic; added to due-list","A-6","Partial"],
["A-6","Backend","[PLANNED] Engagement Score update",
 "—","engagementScorer.js",
 "Engagement score recalculated: timeSpent × 0.4 + views × 0.3 + attempts × 0.3","—","Partial"],

# GAP DETECTION & PATH
["GAP DETECTION & PERSONALISED LEARNING PATH"],
["G-1","Backend","[PLANNED] Gap Detection Engine runs after Mastery update",
 "MasteryScore.js + CurriculumMap.js","PLANNED: gap_detector module",
 "Walks prerequisite graph; finds root-cause weak topic (e.g. LCM causes Fraction failure)","G-2","Planned"],
["G-2","AI Service","[PLANNED] AI Learning Path generated for student",
 "TeacherLearningPath.js","POST /learning-path (chat/router.py — partially built)",
 "5-7 node scaffold: title + Bloom level + tier (foundation→assessment)","G-3","Partial"],
["G-3","Backend","[PLANNED] Recommendation Engine selects next material",
 "SpacedRepetitionSchedule.js + MasteryScore.js","recommendationRoutes.js",
 "Surfaces weakest topic + due spaced-rep items + never-attempted topics","G-4","Partial"],
["G-4","Student","Sees personalised study plan on dashboard",
 "StudentProgress.js","—",
 "Week-by-week plan; next recommended topic highlighted","—","Planned"],

# LANGUAGE ASSESSMENT
["LANGUAGE ASSESSMENT (Reading + Writing + Speech)"],
["L-1","Teacher","Creates Reading Passage / Writing Prompt",
 "ReadingMaterial.js / WritingPrompt.js","POST /api/reading-assessment/material",
 "Content published and visible to students","L-2","Built"],
["L-2","Student","Records audio (reading) OR types response (writing)",
 "—","POST /api/reading-assessment/attempt or /writing-assessment/attempt",
 "Audio/text sent to Node → forwarded to ai-service","L-3","Built"],
["L-3","AI Service","Speech transcription (faster-whisper) + pronunciation (SpeechBrain)",
 "ReadingAssessment.js","speech module → /speech/transcribe + /speech/pronunciation",
 "Transcript + pronunciation score returned","L-4","Built"],
["L-4","AI Service","Qwen3 8B evaluates reading/writing quality",
 "ReadingAssessment.js / WritingAssessment.js","assessment module → /reading/evaluate or /writing/evaluate",
 "JSON: scores per dimension + strengths + weaknesses + improved version","L-5","Built"],
["L-5","Backend","Language Profile updated in Qdrant",
 "StudentLanguageProfile.js","language_memory module → /memory/store",
 "Adaptive difficulty recommendations stored for next session","L-6","Built"],
["L-6","Student","Views ReadingScoreCard / WritingScoreCard",
 "ReadingAssessment.js / WritingAssessment.js","—",
 "Circular score ring + radar chart + strengths/weaknesses + transcript","—","Built"],

# ANALYTICS
["ANALYTICS & ALERTS"],
["AN-1","Backend (ML Engine)","Computes weighted mastery per student (EMA decay)",
 "MasteryScore.js + StudentProgress.js","mlEngine.js",
 "Weighted score per topic; tier: high/mid/low assigned","AN-2","Partial"],
["AN-2","Backend (ML Engine)","Detects at-risk students (mastery < threshold)",
 "StudentUser.js + MasteryScore.js","mlRoutes.js GET /class/at-risk",
 "At-risk student list returned for teacher","AN-3","Partial"],
["AN-3","Backend","[PLANNED] Teacher alert + escalation",
 "Notification.js + InterventionLog.js","NotificationService",
 "Push notification sent to teacher; intervention log created","AN-4","Planned"],
["AN-4","Teacher","Views analytics: class mastery heatmap + at-risk list",
 "MasteryScore.js","teacherAnalyticsRoutes.js",
 "Per-topic mastery heatmap; engagement scores; at-risk flags","AN-5","Partial"],
["AN-5","Admin","Views school-level AI performance report",
 "MasteryScore.js + StudentProgress.js","adminAnalyticsRoutes.js",
 "Subject weak-area report; school-wide mastery trends","—","Partial"],
]

r = 3
for entry in master:
    if len(entry)==1:
        r = cat(ws1, r, 8, entry[0]); continue
    s = entry[7]
    sf = status_fmt(s)
    fmts=[fBOLD,fPLAIN,fWRAP,fWRAP,fWRAP,fWRAP,fPLAIN,sf]
    row_write(ws1, r, entry, fmts); r+=1

ws1.autofilter(2,0,r-1,7)


# ════════════════════════════════════════════════════════════════════════════
# SHEET 2 — MODEL CONNECTION MAP
# Every model, what it connects TO and FROM, what it produces
# ════════════════════════════════════════════════════════════════════════════
ws2 = setup("02 Model Connections", TEAL, "EEC ML — Model Connection Map (Full Detail)")
heads(ws2,[
    ("Model File",28),("Domain",16),("Key Fields",42),
    ("Fed BY (these models/events)",38),("Feeds INTO (these models/systems)",38),
    ("Data Produced / Result",38),("Status",12)
])

models = [
["── CONTENT & CURRICULUM ──────────────────────────────────────────────────────────────────────────────"],
["TeachingMaterial.js","Content","subjectName, chapterTitle, topicTitle, cloudinaryUrl, schoolId, classId, sectionId, isPublished",
 "Teacher upload action","Qdrant (chunks via ai-service); TutorConversation (RAG retrieval)",
 "Searchable knowledge base; source for all RAG tutor answers","Built"],
["CurriculumMap.js","Curriculum","topicTitle, prerequisites[], nextTopics[], subject, schoolId",
 "Teacher manual input","PLANNED: Gap Detector traversal; LearningPath generation",
 "Prerequisite graph; tells system WHICH topic to teach before another","Partial"],
["ExamQuestion.js","Question Bank","questionText, options[], correctAnswer, subject, chapter, topic, bloomLevel[PLANNED], difficulty[PLANNED]",
 "Teacher creation; PLANNED: AI Question Generator","ExamAttempt, PracticeAttempt, MockExam",
 "Source question for all assessments","Partial"],
["PracticeQuestion.js","Question Bank","questionText, options[], subject, topic, marks",
 "Teacher creation","PracticeAttempt, PracticeSection",
 "Practice paper questions","Partial"],

["── ASSESSMENT & ATTEMPTS ─────────────────────────────────────────────────────────────────────────────"],
["BaselineQuiz.js","Assessment","questions[], subject, bloomLevel, schoolId",
 "Admin/Teacher creation","BaselineResult → PLANNED: MasteryScore initial seed",
 "Starting point questions for new student","Built"],
["BaselineResult.js","Assessment","studentId, schoolId, subject, score, answers[]",
 "BaselineQuiz attempt by student","PLANNED: MasteryScore (initial seed); StudentProgress",
 "First mastery estimate for onboarding","Partial"],
["ExamAttempt.js","Assessment","studentId, examId, answers[], startTime, endTime, schoolId",
 "Student taking exam","ExamResult; PLANNED: Error Classifier; PLANNED: MasteryScore update",
 "Raw attempt record; triggers downstream scoring pipeline","Built"],
["ExamResult.js","Assessment","studentId, examId, totalMarks, obtainedMarks, percentage, subjectResults[]",
 "ExamAttempt (after marking)","MasteryScore update; StudentProgress; ParentDashboardReport",
 "Final exam score visible to student, teacher, parent","Built"],
["PracticeAttempt.js","Assessment","studentId, paperId, answers[], score, timeTaken",
 "Student taking practice paper","PLANNED: MasteryScore update; PLANNED: Error Classifier",
 "Practice performance record","Partial"],
["TryoutResult.js","Assessment","studentId, subject, topic, mode, score, createdAt",
 "AI Tutor quiz/tryout completion","PLANNED: MasteryScore update; FlashcardResult ratings",
 "AI session outcome — not yet feeding mastery","Partial"],
["FlashcardResult.js","Assessment","studentId, topic, rating (got_it/still_learning), reviewedAt",
 "Student rating flashcard","PLANNED: SpacedRepetitionSchedule; PLANNED: MasteryScore",
 "Indicates recall confidence per topic","Partial"],

["── MASTERY & INTELLIGENCE ────────────────────────────────────────────────────────────────────────────"],
["MasteryScore.js","Mastery","studentId, schoolId, subject, topicTitle, chapterTitle, score (0-100), attemptCount, lastAttemptAt",
 "PLANNED auto-feed from: ExamResult, PracticeAttempt, TryoutResult, BaselineResult, FlashcardResult",
 "masteryEngine.js (badge/alert/SR trigger); mlEngine.js (EMA weighting); recommendationRoutes.js; Gap Detector",
 "Core intelligence score — drives ALL personalisation downstream","Partial"],
["SpacedRepetitionSchedule.js","Memory","studentId, subject, topicTitle, stage (0-4), nextReviewAt, lastScore",
 "MasteryScore update (SM-2 trigger); FlashcardResult rating",
 "recommendationRoutes.js (due topics surfaced to student)",
 "SM-2 review schedule: intervals 1/3/7/14/30 days per topic","Partial"],
["StudentProgress.js","Progress","studentId, schoolId, subjectProgress[], overallScore, lastUpdated",
 "ExamResult, MasteryScore updates, mlEngine",
 "StudentDashboard; ParentDashboardReport; adminAnalytics",
 "Rolling progress snapshot shown to student and parent","Partial"],
["StudentMemorySummary.js","Memory","studentId, weakTopics[], strengths[], recentMistakes[], studiedChapters[]",
 "PLANNED: TutorConversation sessions; Error Classifier output",
 "PLANNED: RAG retrieval (personalise context); PLANNED: AI Tutor system prompt",
 "Long-term academic memory — personalises tutor across sessions","Partial"],
["TutorConversation.js","Memory","studentId, schoolId, messages[], subject, mode, createdAt",
 "AI Tutor session (student ↔ LLM)","PLANNED: StudentMemorySummary (summarised nightly)",
 "Session chat log; enables session history view","Partial"],
["TeacherLearningPath.js","Path","teacherId, studentId, nodes[]{title, bloom, tier, status}, subject, focus",
 "Teacher manual creation; PLANNED: AI /learning-path endpoint (chat/router.py)",
 "LearningPathMapView.jsx (student sees their path); PLANNED: StudyPlan generator",
 "Scaffolded learning path: foundation→intermediate→advanced→assessment","Partial"],

["── LANGUAGE ASSESSMENT ───────────────────────────────────────────────────────────────────────────────"],
["ReadingMaterial.js","Language","title, passage, subject, gradeLevel, schoolId, isPublished",
 "Teacher creation via LanguagePracticeManager","ReadingAssessment (student attempt)",
 "Reading passages available to students","Built"],
["ReadingAssessment.js","Language","studentId, materialId, audioUrl, transcript, pronunciationScore, comprehensionScore, fluencyScore, strengths[], weaknesses[]",
 "Student audio recording → speech module → assessment module",
 "StudentLanguageProfile (memory update); ReadingScoreCard.jsx",
 "Full reading scorecard: pronunciation + comprehension + fluency","Built"],
["WritingPrompt.js","Language","promptText, type (essay/creative/analytical), subject, schoolId",
 "Teacher creation via LanguagePracticeManager","WritingAssessment (student attempt)",
 "Writing prompts available to students","Built"],
["WritingAssessment.js","Language","studentId, promptId, submittedText, grammarScore, coherenceScore, vocabularyScore, improvedVersion, suggestions[]",
 "Student text submission → assessment module (Qwen3 8B)",
 "StudentLanguageProfile (memory update); WritingScoreCard.jsx",
 "Full writing scorecard: grammar + coherence + vocab + improved version","Built"],
["StudentLanguageProfile.js","Language","studentId, readingLevel, writingLevel, weakAreas[], strongAreas[], recommendedDifficulty",
 "ReadingAssessment result; WritingAssessment result → language_memory module (Qdrant)",
 "PLANNED: adaptive difficulty for next reading/writing session",
 "Adaptive language profile — difficulty auto-adjusts per student","Built"],

["── STUDENT WELFARE & ENGAGEMENT ─────────────────────────────────────────────────────────────────────"],
["StudentBadge.js","Engagement","studentId, badgeType, title, subject, topicTitle, awardedAt, iconEmoji",
 "masteryEngine.js (auto-award when mastery ≥ threshold)",
 "AchievementsView.jsx (student sees badges); NotificationService (push notification sent)",
 "Gamification: mastery milestone badge + push notification","Partial"],
["Wellbeing.js","Welfare","studentId, checkInDate, mood, stressLevel, comments, flaggedForSupport",
 "Student wellbeing check-in; Admin view","PLANNED: Teacher escalation / InterventionLog",
 "Wellbeing signal — PLANNED to trigger teacher alert if distressed","Partial"],
["InterventionLog.js","Welfare","teacherId, studentId, interventionType, notes, outcome, createdAt",
 "PLANNED: auto-created from at-risk detection or wellbeing flag",
 "PLANNED: Intervention Effectiveness analytics",
 "Tracks teacher actions taken for struggling students","Partial"],
["StudentObservation.js","Welfare","teacherId, studentId, observationType, notes, date",
 "Teacher manual entry","PLANNED: InterventionLog; PLANNED: Analytics",
 "Teacher observations on student behaviour/progress","Partial"],

["── COMMUNICATION & NOTIFICATIONS ────────────────────────────────────────────────────────────────────"],
["Notification.js","Comms","userId, title, message, type, priority, relatedEntity, isRead",
 "masteryEngine.js (badge earned); PLANNED: at-risk alert; PLANNED: teacher escalation",
 "StudentNotificationCenter.jsx; PushSubscription (browser push)",
 "In-app + push notification to student/teacher/parent","Built"],
["PushSubscription.js","Comms","userId, endpoint, keys{}, schoolId",
 "Student/teacher browser permission grant",
 "Notification.js → NotificationService (VAPID web push)",
 "Browser push notifications delivered","Built"],

["── ANALYTICS ─────────────────────────────────────────────────────────────────────────────────────────"],
["ParentDashboardReport.js","Analytics","studentId, parentId, subjectReports[], attendance, teacherRemarks, generatedAt",
 "ExamResult; StudentProgress; TeacherFeedback",
 "Parent portal dashboard; parent app",
 "Parent-facing progress summary per term","Built"],
["AuditLog.js","Admin","userId, role, action, entityType, entityId, ipAddress, timestamp",
 "Every key API action (auth, delete, modify)","Admin audit dashboard; security review",
 "Full tamper-evident audit trail for compliance","Built"],
]

r=3
for entry in models:
    if len(entry)==1:
        r=cat(ws2,r,7,entry[0]); continue
    sf=status_fmt(entry[6])
    row_write(ws2,r,[entry[0],entry[1],entry[2],entry[3],entry[4],entry[5],entry[6]],
              [fBOLD,fPLAIN,fWRAP,fWRAP,fWRAP,fWRAP,sf]); r+=1
ws2.autofilter(2,0,r-1,6)


# ════════════════════════════════════════════════════════════════════════════
# SHEET 3 — WORKFLOW DETAILS (per feature group)
# ════════════════════════════════════════════════════════════════════════════
ws3 = setup("03 Workflow Details", PURPLE, "EEC ML — Detailed Workflow Per Feature Group")
heads(ws3,[
    ("Feature Group",20),("Step",6),("Who",12),("What Happens",40),
    ("Models Read",30),("Models Written",28),("API / Service",28),
    ("Output to User",36),("Status",12)
])

details = [
["── A. CONTENT INGESTION PIPELINE ────────────────────────────────────────────────────────────────────"],
["Content Ingestion","1","Teacher","Uploads PDF/DOCX/PPTX via teaching material portal","—","TeachingMaterial.js","POST /api/teaching-material","File URL saved; record created","Built"],
["Content Ingestion","2","AI Service","Downloads file from Cloudinary; runs OCR / text extraction","TeachingMaterial.js","—","POST /ingest/material → documents/service.py","Raw text extracted","Built"],
["Content Ingestion","3","AI Service","Chunks text with LangChain (RecursiveCharacterTextSplitter)","—","—","embeddings module","Overlapping chunks with start_char","Built"],
["Content Ingestion","4","AI Service","Generates 768-dim embedding per chunk (nomic-embed-text)","—","—","Ollama nomic-embed-text","Vector per chunk","Built"],
["Content Ingestion","5","AI Service","Upserts chunks + metadata into Qdrant collection","—","—","Qdrant upsert","Knowledge base ready for retrieval","Built"],
["Content Ingestion","6","AI Service","[PLANNED] Bloom Engine classifies chunks","—","TeachingMaterial.js (bloomTags)","PLANNED: bloom module","Each chunk tagged with Bloom level","Planned"],
["Content Ingestion","7","AI Service","[PLANNED] Learning Outcomes extracted per chapter","TeachingMaterial.js","TeachingMaterial.js (outcomes[])","PLANNED: LLM extraction","Outcomes list stored on material","Planned"],
["Content Ingestion","8","AI Service","[PLANNED] Knowledge Graph updated with new topics","—","CurriculumMap.js","PLANNED: graph update service","Graph node created for chapter/topic","Planned"],

["── B. AI TUTOR RAG SESSION ──────────────────────────────────────────────────────────────────────────"],
["AI Tutor","1","Student","Types question or selects mode (explain/quiz/notes/mindmap/flashcards/homework)","StudentUser.js","TutorConversation.js","POST /api/ai-tutor/chat","Request routed with school/class/subject","Built"],
["AI Tutor","2","AI Service","Embeds question → searches Qdrant (chapter-scope first, subject fallback)","TeachingMaterial (via Qdrant)","—","retrieval/service.py","Top-N relevant chunks","Built"],
["AI Tutor","3","AI Service","Strips teacher notes from retrieved context","—","—","parser/cleaner.py","Clean context for LLM","Built"],
["AI Tutor","4","AI Service","LLM generates mode-specific response (random seed per call)","—","—","ChatOllama (llama3.2:3b / Qwen3)","Explain text / Quiz JSON / Flashcard JSON / MindMap / Notes / Socratic hint","Built"],
["AI Tutor","5","Frontend","Renders response in mode-specific UI component","—","TutorConversation.js (saved)","—","QuizUI / FlashcardUI / MindMapUI / NotesUI / HomeworkHelpUI","Built"],
["AI Tutor","6","Backend","[PLANNED] Quiz result → Mastery Engine trigger","TuyoutResult.js / ExamResult.js","MasteryScore.js","masteryEngine.js","Mastery score updated; badge check fires","Planned"],
["AI Tutor","7","Backend","[PLANNED] Session summarised → Student Memory updated","TutorConversation.js","StudentMemorySummary.js","PLANNED: nightly summariser","Weak topics + studied chapters added to memory","Planned"],

["── C. FORMAL ASSESSMENT PIPELINE ──────────────────────────────────────────────────────────────────"],
["Assessment","1","Student","Starts Practice Paper / Exam / Mock Exam","ExamQuestion.js / PracticeQuestion.js","ExamAttempt.js / PracticeAttempt.js","POST /api/exam/attempt","Attempt record created with answers","Built"],
["Assessment","2","Backend","[PLANNED] AI Answer Evaluator scores each answer","ExamAttempt.js","ExamResult.js","PLANNED: ai-service /evaluate/answer","Marks + rubric + strengths + weaknesses + missing concepts + Bloom level","Planned"],
["Assessment","3","AI Service","[PLANNED] Error Classifier labels each wrong answer","ExamAttempt.js","ExamAttempt.js (errorType field)","PLANNED: error_classifier module","Error type: Concept / Calculation / Reading / Logic","Planned"],
["Assessment","4","Backend","[PLANNED] Mastery Engine recalculates score","ExamResult.js + MasteryScore.js","MasteryScore.js","masteryEngine.js","New mastery score; formula: accuracy + attempts + recency + time","Planned"],
["Assessment","5","Backend","Badge awarded if mastery ≥ threshold","MasteryScore.js","StudentBadge.js","masteryEngine.js → NotificationService","Push notification: 'You earned a mastery badge!'","Partial"],
["Assessment","6","Backend","[PLANNED] Spaced Repetition scheduled for weak topics","MasteryScore.js","SpacedRepetitionSchedule.js","spacedRepetitionRoutes.js (SM-2)","Review reminder set: 1/3/7/14/30 day intervals","Partial"],
["Assessment","7","Backend","Engagement score recalculated","PracticeAttempt.js + TeachingMaterial (viewCount)","—","engagementScorer.js","Engagement score 0-100 per topic","Partial"],
["Assessment","8","Teacher","Views result analytics + at-risk flags","MasteryScore.js + ExamResult.js","—","teacherAnalyticsRoutes.js","Class heatmap; per-student mastery; at-risk list","Partial"],

["── D. GAP DETECTION & LEARNING PATH ───────────────────────────────────────────────────────────────"],
["Gap & Path","1","Backend","[PLANNED] Gap Detector reads MasteryScore for student","MasteryScore.js + CurriculumMap.js","—","PLANNED: gap_detector module","Weakest topic identified","Planned"],
["Gap & Path","2","AI Service","[PLANNED] Traverse CurriculumMap prerequisite chain","CurriculumMap.js","—","PLANNED: graph traversal","Root-cause weak topic found (e.g. LCM → Fraction → Ratio failure)","Planned"],
["Gap & Path","3","AI Service","AI generates personalised learning path (5-7 nodes, Bloom-levelled)","TeacherLearningPath.js + MasteryScore.js","TeacherLearningPath.js","POST /learning-path (chat/router.py)","Path: foundation→intermediate→advanced→assessment nodes","Partial"],
["Gap & Path","4","Backend","Recommendation Engine surfaces next topic","MasteryScore.js + SpacedRepetitionSchedule.js","—","recommendationRoutes.js","Weakest topic + due spaced-rep + new topics recommended","Partial"],
["Gap & Path","5","Student","Sees personalised path + recommendations on dashboard","TeacherLearningPath.js + StudentProgress.js","—","—","LearningPathMapView.jsx + RecommendationWidget.jsx","Partial"],
["Gap & Path","6","Backend","[PLANNED] Weekly study plan generated from path","TeacherLearningPath.js","StudentProgress.js","PLANNED: study plan generator","Week-by-week schedule: which topic, which day","Planned"],

["── E. LANGUAGE ASSESSMENT ─────────────────────────────────────────────────────────────────────────"],
["Language","1","Teacher","Creates reading passage / writing prompt","—","ReadingMaterial.js / WritingPrompt.js","POST /api/reading-assessment/material","Content published for student access","Built"],
["Language","2","Student","Records audio (reading) OR submits written response","—","ReadingAssessment.js / WritingAssessment.js","POST /api/reading-assessment/attempt","Audio/text forwarded to ai-service","Built"],
["Language","3","AI Service","faster-whisper transcribes audio → SpeechBrain scores pronunciation","—","—","speech module: /speech/transcribe + /speech/pronunciation","Transcript + pronunciation score (0-100)","Built"],
["Language","4","AI Service","Qwen3 8B evaluates reading comprehension / writing quality","ReadingMaterial.js / WritingPrompt.js","ReadingAssessment.js / WritingAssessment.js","assessment module: /reading/evaluate or /writing/evaluate","Score JSON: dimensions + strengths + weaknesses + improved version","Built"],
["Language","5","Backend","Language Profile updated with new scores","ReadingAssessment.js / WritingAssessment.js","StudentLanguageProfile.js","language_memory module: /memory/store","Qdrant stores adaptive difficulty recommendation","Built"],
["Language","6","Student","Views score card with radar chart","ReadingAssessment.js / WritingAssessment.js","—","—","ReadingScoreCard / WritingScoreCard: circular ring + radar + feedback","Built"],
["Language","7","Teacher","Views student results in Language Practice Manager","ReadingAssessment.js / WritingAssessment.js","—","readingAssessmentRoutes.js","All student attempts visible; scores + transcripts","Built"],

["── F. SPACED REPETITION & ENGAGEMENT ──────────────────────────────────────────────────────────────"],
["Spaced Rep","1","Backend","SM-2 stage updated after each assessment","MasteryScore.js / FlashcardResult.js","SpacedRepetitionSchedule.js","spacedRepetitionRoutes.js POST /schedule","Stage 0-4; intervals: 1/3/7/14/30 days","Partial"],
["Spaced Rep","2","Student","Due topics surfaced in recommendation widget","SpacedRepetitionSchedule.js","—","GET /api/spaced-repetition/due","'Review due today' list shown to student","Partial"],
["Spaced Rep","3","Backend","Engagement scored per topic (time + views + attempts)","TeachingMaterial.js + PracticeAttempt.js","—","engagementScorer.js","Normalised score 0-100 per topic","Partial"],
["Spaced Rep","4","Teacher","Low-engagement topics flagged with swap suggestions","—","—","engagementRoutes.js GET /student","Teacher sees which topics students avoid","Partial"],

["── G. ML ENGINE & AT-RISK ──────────────────────────────────────────────────────────────────────────"],
["ML Engine","1","Backend","EMA weighted mastery computed per student","MasteryScore.js + StudentProgress.js","—","mlEngine.js → computeWeightedMastery()","Weighted score per topic with recency decay","Partial"],
["ML Engine","2","Backend","At-risk students detected (mastery below threshold)","MasteryScore.js + StudentUser.js","—","mlRoutes.js GET /class/at-risk","At-risk student list for teacher","Partial"],
["ML Engine","3","Backend","Class engagement trends computed","StudentProgress.js","—","mlRoutes.js GET /class/engagement","Class-level engagement trend data","Partial"],
["ML Engine","4","Teacher","Views class trends + at-risk dashboard","MasteryScore.js","—","mlRoutes.js GET /class/trends","Mastery trend chart; at-risk flags","Partial"],
["ML Engine","5","Backend","[PLANNED] Teacher escalation notification sent","InterventionLog.js","Notification.js","PLANNED: alert service","Teacher push notification for at-risk student","Planned"],
]

r=3
for entry in details:
    if len(entry)==1:
        r=cat(ws3,r,9,entry[0]); continue
    sf=status_fmt(entry[8])
    row_write(ws3,r,[entry[0],entry[1],entry[2],entry[3],entry[4],entry[5],entry[6],entry[7],entry[8]],
              [fBOLD,fPLAIN,fPLAIN,fWRAP,fWRAP,fWRAP,fWRAP,fWRAP,sf]); r+=1
ws3.autofilter(2,0,r-1,8)


# ════════════════════════════════════════════════════════════════════════════
# SHEET 4 — BENEFITS PER ROLE
# ════════════════════════════════════════════════════════════════════════════
ws4 = setup("04 Benefits Per Role", AMBER, "EEC ML — What Each User Gets (Benefits by Role)")

ws4.set_column(0,0,22); ws4.set_column(1,1,36); ws4.set_column(2,2,42)
ws4.set_column(3,3,42); ws4.set_column(4,4,12)

for c,h in enumerate(["Feature","Student Gets","Teacher Gets","Admin / Parent Gets","Status"]):
    ws4.write(2,c,h,fHEAD)

benefits = [
["── AI TUTOR & CONTENT ───────────────────────────────────────────────────"],
["AI Tutor (RAG Chat)",
 "Instant answers from their own school's textbooks — not generic internet answers",
 "Students use school materials correctly; no unrelated content leaks in",
 "School content stays within tenant; no cross-school data access","Built"],
["Quiz Mode",
 "5 MCQ questions generated on any topic instantly; animated score screen",
 "Student practice data available (partially); at-risk students flagged",
 "Admin sees overall quiz engagement per class","Partial"],
["Flashcard Mode",
 "3D flip cards for any topic; Got-it / Still-learning rating; progress dots",
 "Flashcard usage signals which topics students find hard",
 "—","Built"],
["Mind Map Mode",
 "Visual topic breakdown with animated SVG connections; 2-column branch layout",
 "Students build conceptual understanding, not just memorisation",
 "—","Built"],
["Notes Mode",
 "Chapter notes generated instantly; colour-coded cards per section",
 "Reduces note-sharing burden on teacher",
 "—","Built"],
["Homework Help (Socratic)",
 "Guided questioning — AI NEVER gives the answer; student reaches it themselves",
 "Students develop problem-solving skills; AI enforces pedagogy",
 "Evidence of Socratic practice in student sessions (planned)","Built"],
["Summarize Mode",
 "Any chapter summarised in seconds from school's own material",
 "Saves revision prep time for students",
 "—","Built"],
["Explain Mode",
 "Plain-language explanation of any concept from curriculum",
 "Reduces repetitive 'explain this again' queries to teacher",
 "—","Built"],

["── ASSESSMENT & MASTERY ─────────────────────────────────────────────────"],
["Baseline Quiz",
 "Onboarding quiz sets starting mastery level — learning path starts from the RIGHT place",
 "Teacher sees which students are behind from day 1",
 "Admin gets class baseline breakdown by subject","Built"],
["Mastery Score",
 "Personal 0-100 mastery score per topic; knows exactly where they stand",
 "At a glance: who has mastered what; no manual marking needed",
 "School-level mastery heatmap per subject (planned)","Partial"],
["Error Classification [Planned]",
 "Told WHY they got it wrong: Concept / Calculation / Reading / Logic error",
 "Identifies type of error per student; targets re-teaching accurately",
 "Common error types across school surfaced for curriculum review","Planned"],
["Answer Evaluation [Planned]",
 "Detailed rubric: marks + strengths + weaknesses + missing concepts + improved version",
 "AI does first-pass grading; teacher reviews edge cases only",
 "Faster reporting; consistent grading across teachers","Planned"],
["Gap Detection [Planned]",
 "Root cause of failure identified (e.g. 'You fail Fractions because LCM is weak')",
 "Per-student gap report without manual diagnosis",
 "School-level gap trends by subject / class","Planned"],

["── LEARNING PATH & PERSONALISATION ─────────────────────────────────────"],
["Learning Path (AI-generated) [Planned]",
 "Personalised 5-7 node path from weak topic → mastery; Bloom-levelled",
 "AI generates paths instead of teacher building them manually",
 "Every student on a personalised path — not one-size-fits-all","Planned"],
["Spaced Repetition",
 "'Review due today' list; topics resurface at optimal time intervals (SM-2)",
 "Students don't forget what they've learned; retention improves",
 "Measurable retention improvement over time (planned evidence testing)","Partial"],
["Recommendation Engine",
 "Next best topic/material recommended based on mastery + due reviews + never-tried",
 "Students self-direct learning with AI guidance; less hand-holding needed",
 "Engagement per recommendation visible to admin","Partial"],
["Adaptive Difficulty",
 "Quiz/practice difficulty auto-adjusts based on mastery score",
 "Struggling students get easier questions to rebuild confidence first",
 "—","Planned"],
["Personalised Study Plan [Planned]",
 "Week-by-week schedule: which topic, which day, which mode (read/quiz/flashcard)",
 "Students come to class prepared; teacher can plan lessons around gaps",
 "Parent sees child's weekly AI study plan","Planned"],

["── LANGUAGE ASSESSMENT ──────────────────────────────────────────────────"],
["Reading Assessment",
 "Reads passage aloud; gets pronunciation + comprehension + fluency scores instantly",
 "Data on reading level per student without manual assessment sessions",
 "School-wide reading level distribution","Built"],
["Writing Assessment",
 "Submits writing; gets grammar + coherence + vocabulary scores + improved version",
 "AI first-pass writing feedback; teacher focuses on high-level guidance",
 "Writing improvement trend over time","Built"],
["Pronunciation Scoring",
 "Knows exactly which words/sounds need improvement",
 "Pronunciation data for language classes without individual listening sessions",
 "—","Built"],
["Student Language Profile",
 "Difficulty auto-adapts — hard passages given as reading improves",
 "Adaptive content without teacher manually choosing levels",
 "—","Built"],

["── ANALYTICS & ALERTS ───────────────────────────────────────────────────"],
["At-risk Detection",
 "Student unaware (teacher acts on their behalf proactively)",
 "At-risk student list with mastery scores; intervene BEFORE exam failure",
 "Admin sees school-wide at-risk count; can allocate resources","Partial"],
["Engagement Analytics",
 "Sees which topics they've spent most/least time on",
 "Low-engagement topics flagged with swap suggestions",
 "Admin sees engagement by subject across school","Partial"],
["Teacher Analytics Dashboard",
 "—",
 "Per-topic mastery heatmap; class trends; at-risk students; gap insights",
 "—","Partial"],
["Admin Analytics Dashboard",
 "—",
 "—",
 "School-level subject performance; weak areas; AI usage metrics; at-risk count","Partial"],
["Parent Dashboard Report",
 "Parent sees child's subject-wise progress; attendance; teacher remarks",
 "Reduces parent inquiry calls; transparent communication",
 "Parent gets structured report per term; sees if child is at-risk","Built"],
["Badge & Gamification",
 "Earns mastery badges when topic score ≥ threshold; push notification delivered",
 "Students motivated to achieve mastery; engagement signal for teacher",
 "—","Partial"],
["Wellbeing Check-in",
 "Records mood + stress level; knows support is available",
 "Early wellbeing signal before it becomes a crisis",
 "Admin sees wellbeing flags; [Planned] escalation to counsellor","Partial"],
["Explainable AI [Planned]",
 "Told WHY AI recommended this topic or gave this answer",
 "Trust in AI system increases; teacher can validate AI reasoning",
 "Audit trail for AI decisions (important for school governance)","Planned"],
]

r=3
for entry in benefits:
    if len(entry)==1:
        r=cat(ws4,r,5,entry[0]); continue
    sf=status_fmt(entry[4])
    row_write(ws4,r,[entry[0],entry[1],entry[2],entry[3],entry[4]],
              [fBOLD,fSTp,fTEp,fADp,sf]); r+=1
ws4.autofilter(2,0,r-1,4)


# ════════════════════════════════════════════════════════════════════════════
# SHEET 5 — DATA FLOW MAP (what data moves where)
# ════════════════════════════════════════════════════════════════════════════
ws5 = setup("05 Data Flow Map", SLATE, "EEC ML — Data Flow Map (Input → Process → Output)")
heads(ws5,[
    ("Data Item",24),("Created By",18),("Stored In",22),
    ("Processed By",28),("Flows Into",30),("Final Output to User",36),("Status",12)
])

flows = [
["── RAW CONTENT ─────────────────────────────────────────────────────────"],
["PDF / DOCX / PPTX file","Teacher upload","Cloudinary (file) + TeachingMaterial.js (metadata)","OCR + chunker + embedder (ai-service)","Qdrant (768-dim vectors + metadata)","AI Tutor retrieves relevant chunks for student questions","Built"],
["Text chunks (with offsets)","documents/service.py","Qdrant collection: teacher_documents","retrieval/service.py (similarity search)","chat/router.py (LLM context)","Tutor answers grounded in school's own material","Built"],
["Bloom tag per chunk [Planned]","bloom module [Planned]","TeachingMaterial.js (bloomTags[])","question_generator; answer_evaluator","ExamQuestion.js (bloomLevel)","Questions generated at correct cognitive level","Planned"],

["── ASSESSMENT DATA ─────────────────────────────────────────────────────"],
["Student answer (MCQ/written)","Student attempt","ExamAttempt.js / PracticeAttempt.js","Answer Evaluator [Planned] + Error Classifier [Planned]","ExamResult.js + MasteryScore.js","Score + rubric + error type shown to student; mastery updated","Planned"],
["Mastery score (0-100)","masteryEngine.js","MasteryScore.js","mlEngine.js (EMA weighting); Gap Detector [Planned]; Recommendation Engine","SpacedRepetitionSchedule.js; TeacherLearningPath.js; Notification.js","Drives ALL personalisation: path, recommendations, difficulty, badges","Partial"],
["Error classification [Planned]","error_classifier module","ExamAttempt.js (errorType)","Misconception Engine [Planned]; Gap Detector [Planned]","StudentMemorySummary.js (recentMistakes)","Student told WHY they failed; teacher sees error patterns","Planned"],
["Spaced rep stage (0-4)","SM-2 algo (spacedRepetitionRoutes.js)","SpacedRepetitionSchedule.js","recommendationRoutes.js (due topics)","RecommendationWidget.jsx","'Review due today' list on student dashboard","Partial"],

["── LANGUAGE DATA ───────────────────────────────────────────────────────"],
["Audio recording","Student mic","Sent to ai-service (temp)","faster-whisper (transcription) + SpeechBrain (pronunciation)","ReadingAssessment.js","Transcript + pronunciation score shown on scorecard","Built"],
["Writing text","Student rich editor","WritingAssessment.js (submittedText)","Qwen3 8B (writing evaluator)","WritingAssessment.js (scores + improvedVersion)","Score bars + corrections + improved version shown","Built"],
["Language profile scores","language_memory/service.py","StudentLanguageProfile.js + Qdrant (student_language_memory)","language_memory/service.py (retrieve)","Next session difficulty parameter","Harder/easier passages auto-selected for next session","Built"],

["── INTELLIGENCE DATA ───────────────────────────────────────────────────"],
["Engagement score","engagementScorer.js (time + views + attempts)","Computed in-memory (not persisted yet)","mlEngine.js; engagementRoutes.js","Teacher analytics dashboard","Teacher sees which topics students avoid","Partial"],
["At-risk flag","mlEngine.js (mastery below threshold)","Computed on request (not persisted)","mlRoutes.js /class/at-risk","Teacher dashboard; [Planned] Notification.js","Teacher sees at-risk students before they fail","Partial"],
["Learning path nodes","AI: /learning-path endpoint (Qwen LLM)","TeacherLearningPath.js","LearningPathMapView.jsx","Student dashboard path view","Personalised scaffolded learning journey","Partial"],
["Gap (root-cause weak topic) [Planned]","gap_detector module","Student insight record [Planned]","Recommendation Engine; Learning Path Generator; Teacher alert","TeacherLearningPaths.jsx; NotificationService","Teacher and student both know the REAL reason for failure","Planned"],

["── MEMORY DATA ─────────────────────────────────────────────────────────"],
["Tutor conversation","Student ↔ AI chat session","TutorConversation.js (per session)","[Planned] Nightly summariser → LLM","StudentMemorySummary.js","AI Tutor remembers what student studied and struggled with","Planned"],
["Student academic memory [Planned]","masteryEngine + error classifier","StudentMemorySummary.js","RAG retrieval (personalise context); AI Tutor system prompt","TutorConversation.js (context injected)","Tutor references past mistakes: 'Last time you struggled with LCM...'","Planned"],
["Badge earned","masteryEngine.js (threshold check)","StudentBadge.js","Notification.js + PushSubscription.js","Student device (browser push) + AchievementsView.jsx","Student gets push notification + badge displayed on achievements page","Partial"],
]

r=3
for entry in flows:
    if len(entry)==1:
        r=cat(ws5,r,7,entry[0]); continue
    sf=status_fmt(entry[6])
    row_write(ws5,r,entry,[fBOLD,fPLAIN,fPLAIN,fWRAP,fWRAP,fWRAP,sf]); r+=1
ws5.autofilter(2,0,r-1,6)


# ════════════════════════════════════════════════════════════════════════════
# SHEET 6 — BLOOM + ADAPTIVE LEARNING DETAIL
# ════════════════════════════════════════════════════════════════════════════
ws6 = setup("06 Bloom & Adaptive", ORANGE, "EEC ML — Bloom Taxonomy & Adaptive Learning: Full Detail")
ws6.set_column(0,0,26); ws6.set_column(1,1,14); ws6.set_column(2,2,14)
ws6.set_column(3,3,38); ws6.set_column(4,4,38); ws6.set_column(5,5,12)

for c,h in enumerate(["Pipeline Stage","Bloom Today","Adaptive Today","What Should Happen (Full Vision)","Files Involved","Status"]):
    ws6.write(2,c,h,fHEAD)

bloom_rows = [
["── WHERE BLOOM EXISTS TODAY ─────────────────────────────────────────────"],
["Learning Path nodes","✅ Used","—","LLM assigns bloom level per node: remember→understand→apply→analyze→evaluate→create","ai-service/app/modules/chat/service.py:617 (_BLOOM_LEVELS)","Built"],
["Learning Path Teacher Routes","✅ Used","—","Teacher AI route auto-assigns Bloom to path nodes","backend/routes/aiTeacherRoutes.js:620","Built"],
["BaselineQuiz model field","✅ Field exists","—","bloomLevel field on BaselineQuiz schema; default='knowledge'","backend/models/BaselineQuiz.js","Partial"],
["StudentProgress model field","✅ Field exists","—","bloom: String field on StudentProgress","backend/models/StudentProgress.js","Partial"],
["TeacherLearningPath field","✅ Field exists","—","bloom: String field on path nodes","backend/models/TeacherLearningPath.js","Partial"],
["Quiz difficulty param","—","✅ Manual","Frontend can pass difficulty=easy/medium/hard; chat service adjusts prompt","ai-service/app/modules/chat/service.py:613-621","Built"],
["Writing assessment difficulty","—","✅ Manual","difficulty param accepted in writing evaluation request","ai-service/app/modules/assessment/service.py:250","Built"],
["Language memory difficulty","—","✅ Auto (language only)","Language profile stores recommended difficulty; next session uses it","ai-service/app/modules/language_memory/service.py","Built"],
["Extension-level prompt","—","✅ Partial","'EXTENSION-level practice for student approaching mastery' prompt tier exists","ai-service/app/modules/chat/service.py:110","Partial"],

["── WHERE BLOOM IS MISSING (but should exist) ───────────────────────────"],
["Document ingestion / chunk tagging","❌ Missing","—","Every chunk should be Bloom-tagged during ingestion so retrieval can filter by cognitive level","NEEDED: ai-service/app/modules/bloom/service.py","Planned"],
["ExamQuestion model","❌ Missing","—","bloomLevel field not on ExamQuestion schema — cannot filter question bank by Bloom level","backend/models/ExamQuestion.js needs bloomLevel field","Planned"],
["PracticeQuestion model","❌ Missing","—","No Bloom field on practice questions","backend/models/PracticeQuestion.js needs bloomLevel field","Planned"],
["Quiz generation (mode=quiz)","❌ Missing","❌ Not auto","Quiz generates 5 MCQs with NO Bloom level specified; all at same cognitive level","ai-service/app/modules/chat/service.py — needs bloomLevel param in request","Planned"],
["Answer evaluation output","❌ Missing","—","Answer evaluator should return the Bloom level of student's response","ai-service/app/modules/assessment/service.py — needs bloomLevel in response JSON","Planned"],
["Mastery → next Bloom level","—","❌ Not wired","System should read MasteryScore and decide: if score<40% send 'remember' level Q; if 40-70% send 'apply' level Q; if >70% push to 'evaluate'","NEEDED: adaptive router in quiz generation","Planned"],
["Student difficulty auto-select","—","❌ Not wired","Difficulty is manually chosen by student — should auto-derive from MasteryScore per topic","NEEDED: mastery_score → difficulty_level mapping function","Planned"],
["Teacher Bloom report","❌ Missing","—","Teacher should see Bloom distribution of questions used per class (how many recall vs analysis)","NEEDED: analytics query over ExamQuestion.bloomLevel","Planned"],

["── FULL VISION: HOW BLOOM + ADAPTIVE SHOULD WORK TOGETHER ─────────────"],
["Step 1: Ingest","Tagged","—","Chunk ingested → Bloom Engine classifies → stored as metadata in Qdrant + TeachingMaterial","bloom module → Qdrant payload + MongoDB","Planned"],
["Step 2: Baseline","Used","Sets level","BaselineQuiz results → MasteryScore per topic → initial difficulty level derived","BaselineResult → masteryEngine → MasteryScore","Planned"],
["Step 3: Student asks question","Filtered","Auto-selected","RAG retrieves chunks at student's current Bloom level; LLM generates at that level","retrieval + chat modules + MasteryScore","Planned"],
["Step 4: Quiz generated","Bloom-tagged","Auto-difficulty","Quiz questions generated at correct Bloom level for student's mastery; difficulty auto-set","quiz module + MasteryScore → bloomLevel param","Planned"],
["Step 5: Student answers","Classified","—","Answer evaluated; Bloom level of response classified; error type classified","answer_evaluator + error_classifier modules","Planned"],
["Step 6: Mastery updated","—","Adjusts","MasteryScore updated → difficulty auto-adjusts for next question","masteryEngine → MasteryScore → next request difficulty","Planned"],
["Step 7: Path progression","Bloom ladder","—","Student progresses through Bloom levels: remember→understand→apply→analyze→evaluate→create","gap_detector + TeacherLearningPath nodes","Planned"],
["Step 8: Teacher sees Bloom map","Reported","—","Teacher dashboard shows Bloom distribution: how many students at each cognitive level per topic","analyticsRoutes + ExamQuestion.bloomLevel","Planned"],
]

r=3
for entry in bloom_rows:
    if len(entry)==1:
        r=cat(ws6,r,6,entry[0]); continue
    sf=status_fmt(entry[5])
    fmts=[fBOLD,fDONE if "✅" in entry[1] else (fNO if "❌" in entry[1] else fPLAIN),
          fDONE if "✅" in entry[2] else (fNO if "❌" in entry[2] else fPLAIN),
          fWRAP,fWRAP,sf]
    row_write(ws6,r,entry,fmts); r+=1


# ════════════════════════════════════════════════════════════════════════════
# SHEET 7 — SUMMARY DASHBOARD
# ════════════════════════════════════════════════════════════════════════════
ws7 = setup("07 Summary", GREEN, "EEC ML — Progress Summary Dashboard")
ws7.set_column(0,0,32); ws7.set_column(1,1,16); ws7.set_column(2,2,12)
ws7.set_column(3,3,12); ws7.set_column(4,4,14); ws7.set_column(5,5,42)

for c,h in enumerate(["Workflow / System","Status","Models Involved","API Endpoints","User Benefit","Next Build Step"]):
    ws7.write(2,c,h,fHEAD)

summary = [
["Content Ingestion Pipeline",       "Built",       "TeachingMaterial","3","School knowledge base ready for RAG","Add Bloom tagging + Learning Outcome extraction on ingest"],
["AI Tutor (RAG Chat — all 7 modes)","Built",       "TutorConversation, TeachingMaterial","4","Instant subject-grounded answers in 7 modes","Persist cross-session memory; wire quiz results to mastery"],
["Baseline Quiz → Mastery seed",     "Partial",     "BaselineQuiz, BaselineResult, MasteryScore","3","Starting mastery level set for new student","Wire BaselineResult → masteryEngine auto-update"],
["Formal Assessment Pipeline",       "Partial",     "ExamQuestion, ExamAttempt, ExamResult, MasteryScore","5","Exam recorded; scoring partially done","Build Answer Evaluator + Error Classifier + auto mastery update"],
["Mastery Engine",                   "Partial",     "MasteryScore, StudentBadge, Notification","3","Badge + notification when mastery milestone hit","Auto-trigger from ALL assessment types; add decay formula"],
["Spaced Repetition (SM-2)",         "Partial",     "SpacedRepetitionSchedule","3","Review reminders at optimal intervals","Auto-trigger from quiz/flashcard results; surface in student dashboard"],
["Engagement Scorer",                "Partial",     "TeachingMaterial, PracticeAttempt","2","Teacher sees low-engagement topics","Surface as teacher dashboard card; wire to ML Engine"],
["ML Engine (at-risk + trends)",     "Partial",     "MasteryScore, StudentProgress, StudentUser","5","Teacher sees at-risk students","Add teacher escalation notification; persist at-risk flag"],
["Recommendation Engine",            "Partial",     "MasteryScore, SpacedRepetitionSchedule, TeachingMaterial","1","Next best topic surfaced to student","Surface in student dashboard via RecommendationWidget"],
["Gap Detection Engine",             "Planned",     "CurriculumMap, MasteryScore","0","Root-cause of failure identified","Build graph traversal in ai-service; feed from mastery auto-update"],
["AI Learning Path Generation",      "Partial",     "TeacherLearningPath, MasteryScore","1","Personalised Bloom-levelled learning path","Connect gap detection output → path generator"],
["Error Classification Engine",      "Planned",     "ExamAttempt","0","Student knows WHY they failed","Build error_classifier module in ai-service; wire from answer eval"],
["Bloom Engine",                     "Planned",     "TeachingMaterial, ExamQuestion","0","Cognitive-level targeting for all content","Build bloom module; apply in ingestion + question gen + eval"],
["Language Assessment (Reading)",    "Built",       "ReadingMaterial, ReadingAssessment, StudentLanguageProfile","4","Pronunciation + comprehension scores instantly","Teacher review dashboard polish"],
["Language Assessment (Writing)",    "Built",       "WritingPrompt, WritingAssessment, StudentLanguageProfile","4","Grammar + coherence + improved version","Teacher review dashboard polish"],
["Speech / Pronunciation",           "Built",       "ReadingAssessment","2","Word-level pronunciation feedback","Real-device latency testing"],
["Adaptive Difficulty (Language)",   "Built",       "StudentLanguageProfile","1","Reading/Writing difficulty auto-adjusts per student","Extend to academic quiz difficulty"],
["Adaptive Difficulty (Academic)",   "Planned",     "MasteryScore, ExamQuestion","0","Quiz difficulty auto-matches student mastery level","Wire MasteryScore → difficulty param in quiz generation"],
["AI Orchestrator",                  "Planned",     "ALL","0","All AI calls routed through single coordinator","Build orchestrator module; fix Node calling endpoints directly"],
["Prompt Library",                   "Planned",     "ALL ai-service modules","0","Prompts maintainable without code changes","Extract all hardcoded prompts to /prompts/ directory"],
["Wellbeing Safeguards",             "Planned",     "Wellbeing, InterventionLog, Notification","0","At-risk students get human support early","Build escalation policy + teacher alert from wellbeing flags"],
["Parent Dashboard",                 "Built",       "ParentDashboardReport, ExamResult, StudentProgress","3","Parent sees child progress + teacher remarks","Add AI-generated learning summary for parent"],
["Teacher Analytics Dashboard",      "Partial",     "MasteryScore, ExamResult","4","Class heatmap + trends","Add per-topic Bloom distribution + gap insights"],
["Admin Analytics Dashboard",        "Partial",     "MasteryScore, StudentProgress","3","School-level subject performance","Add AI-generated narrative insights"],
]

r=3
for d in summary:
    sf=status_fmt(d[1])
    row_write(ws7,r,d,[fBOLD,sf,fPLAIN,fPLAIN,fSTp,fWRAP]); r+=1

r+=1
ws7.merge_range(r,0,r,5,"KEY DEPENDENCY CHAIN — must build in this order:",
    F(bold=True,bg=DARK,fg="#FFFFFF",sz=11,border=0))
r+=1
chain = [
    ("1st","Error Classification Engine","Nothing downstream works without knowing WHY an answer is wrong"),
    ("2nd","Mastery Engine Auto-Update","Must fire after EVERY quiz/test/assessment — not just manually"),
    ("3rd","Gap Detection Engine","Traverse CurriculumMap to find root-cause weak topic"),
    ("4th","Bloom Engine","Tag content + questions + answers with cognitive level"),
    ("5th","AI Orchestrator","Fix architecture: Node must call Orchestrator, not individual endpoints"),
    ("6th","Adaptive Difficulty (Academic)","Wire MasteryScore → quiz difficulty auto-select"),
    ("7th","AI Learning Path (full)","Gap output → Bloom-levelled path → personalised study plan"),
    ("8th","Prompt Library","Externalise all hardcoded prompts (architecture requirement)"),
]
for rank,title,why in chain:
    ws7.write(r,0,f"{rank}: {title}",fBOLD)
    ws7.merge_range(r,1,r,5,why,fWRAP)
    r+=1

wb.close()
print("Done: EEC ML — Full Workflow & Model Connections.xlsx")

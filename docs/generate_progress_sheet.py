import xlsxwriter

wb = xlsxwriter.Workbook("ML Progress Sheet.xlsx")

# ── Colour palette ─────────────────────────────────────────────────────────
DARK   = "#1E293B"; BLUE   = "#3B82F6"; PURPLE = "#7C3AED"
TEAL   = "#0D9488"; ORANGE = "#EA580C"; ROSE   = "#E11D48"
INDIGO = "#4F46E5"; AMBER  = "#B45309"; GREEN  = "#15803D"

DONE_BG="#DCFCE7"; DONE_FG="#166534"
PART_BG="#FEF9C3"; PART_FG="#854D0E"
NO_BG  ="#FEE2E2"; NO_FG  ="#991B1B"
MISS_BG="#EDE9FE"; MISS_FG="#5B21B6"   # purple = in CSV but wrong status
HEAD_BG="#F1F5F9"; HEAD_FG="#0F172A"

def fmt(wb, bold=False, color="#FFFFFF", font_color="#000000", size=10,
        border=1, wrap=False, align="left"):
    return wb.add_format({
        "bold": bold, "bg_color": color, "font_color": font_color,
        "font_size": size, "border": border, "border_color": "#CCCCCC",
        "text_wrap": wrap, "valign": "vcenter", "align": align,
    })

f_title  = fmt(wb, bold=True,  color=DARK,    font_color="#FFFFFF", size=14, border=0)
f_head   = fmt(wb, bold=True,  color=HEAD_BG, font_color=HEAD_FG,  size=10)
f_cat    = fmt(wb, bold=True,  color="#E2E8F0",font_color=DARK,    size=10)
f_done   = fmt(wb, color=DONE_BG, font_color=DONE_FG)
f_part   = fmt(wb, color=PART_BG, font_color=PART_FG)
f_no     = fmt(wb, color=NO_BG,   font_color=NO_FG)
f_miss   = fmt(wb, color=MISS_BG, font_color=MISS_FG)   # missing from old CSV
f_plain  = fmt(wb)
f_bold   = fmt(wb, bold=True)
f_pct_d  = fmt(wb, color=DONE_BG, font_color=DONE_FG, align="center")
f_pct_p  = fmt(wb, color=PART_BG, font_color=PART_FG, align="center")
f_pct_n  = fmt(wb, color=NO_BG,   font_color=NO_FG,   align="center")
f_pct_m  = fmt(wb, color=MISS_BG, font_color=MISS_FG, align="center")
f_center = fmt(wb, align="center")

SFMT = {"✅ Done":"done","🔶 Partial":"part","❌ Not Started":"no","⚠️ Missing from CSV":"miss"}

def sf(wb, status):
    return {"done":f_done,"part":f_part,"no":f_no,"miss":f_miss}.get(SFMT.get(status,""),f_plain)

def pf(wb, status):
    return {"done":f_pct_d,"part":f_pct_p,"no":f_pct_n,"miss":f_pct_m}.get(SFMT.get(status,""),f_center)


def make_sheet(wb, name, color, headers, widths, rows):
    ws = wb.add_worksheet(name)
    ws.set_tab_color(color)
    ws.freeze_panes(3, 0)
    ws.set_row(0, 30); ws.set_row(1, 6); ws.set_row(2, 18)
    ws.merge_range(0, 0, 0, len(headers)-1, f"EEC ML — {name}", f_title)
    for c,(h,w) in enumerate(zip(headers,widths)):
        ws.set_column(c,c,w); ws.write(2,c,h,f_head)
    r = 3
    for row in rows:
        if len(row)==1:
            ws.merge_range(r,0,r,len(headers)-1,row[0],f_cat); r+=1; continue
        status = row[2] if len(row)>2 else ""
        for c,val in enumerate(row):
            f = sf(wb,status) if c==2 else (pf(wb,status) if c==3 and "%" in str(val) else (f_bold if c==0 else f_plain))
            ws.write(r,c,val,f)
        r+=1
    ws.autofilter(2,0,r-1,len(headers)-1)
    return ws


# ══════════════════════════════════════════════════════════════════════════════
# SHEET 1 — COMPLETE AI FEATURE LIST  (the master checklist)
# ══════════════════════════════════════════════════════════════════════════════
# Columns: #, Feature, Status, Progress%, In Old CSV?, Files / Location, What's Missing

features = [
# ─ CORE PIPELINE ─────────────────────────────────────────────────────────────
["── 1. CORE AI PIPELINE ──────────────────────────────────────────────────────────────────────────────────────"],
["1",  "Document Ingestion (OCR → Parse → Chunk → Embed → Qdrant)",     "✅ Done",         "90%","Yes","ai-service/app/modules/documents/","Learning Outcomes + Bloom not auto-generated on ingest"],
["2",  "AI Orchestrator (central workflow coordinator)",                  "❌ Not Started",  "0%", "No", "NEEDED: ai-service/app/orchestrator/","Node calls endpoints directly — biggest arch violation"],
["3",  "RAG Engine (semantic retrieval with metadata filtering)",         "✅ Done",         "90%","Yes","ai-service/app/modules/retrieval/","Hybrid BM25+semantic not yet done"],
["4",  "Hybrid Search (BM25 keyword + semantic vector)",                  "❌ Not Started",  "0%", "No", "NEEDED in retrieval/service.py","Only pure vector search today"],
["5",  "Embedding Engine (nomic-embed-text via Ollama)",                  "✅ Done",         "95%","No", "ai-service/app/modules/embeddings/","Not listed as standalone in old CSV"],
["6",  "Prompt Library (externalised /prompts/ directory)",               "❌ Not Started",  "0%", "No", "NEEDED: ai-service/prompts/","All prompts hardcoded — architecture violation"],

# ─ CONTENT INTELLIGENCE ───────────────────────────────────────────────────────
["── 2. CONTENT INTELLIGENCE ─────────────────────────────────────────────────────────────────────────────────"],
["7",  "Curriculum Graph (topic → prerequisite map)",                     "🔶 Partial",      "30%","Yes","backend/models/CurriculumMap.js + curriculumMapRoutes.js","No traversal logic, no auto-update on ingest"],
["8",  "Learning Outcomes Auto-generation from documents",                "❌ Not Started",  "0%", "No", "NEEDED in documents/service.py","Not in ingestion pipeline at all"],
["9",  "Bloom Engine (tag documents + questions + answers)",              "❌ Not Started",  "0%", "No", "NEEDED: ai-service/app/modules/bloom/","Zero code exists; doc claims ✅ Strong (wrong)"],
["10", "Document Versioning (retain old versions, never auto-delete)",    "❌ Not Started",  "0%", "No", "NEEDED in TeachingMaterial.js","No version field on model"],
["11", "Question Bank (permanent store, teacher-editable)",               "🔶 Partial",      "50%","Yes","backend/models/ExamQuestion.js + PracticeQuestion.js","No Bloom level, not AI-auto-saved, no difficulty calibration"],

# ─ ASSESSMENT & EVALUATION ────────────────────────────────────────────────────
["── 3. ASSESSMENT & EVALUATION ─────────────────────────────────────────────────────────────────────────────"],
["12", "Academic Assessment Engine (MCQ + written answer eval)",          "🔶 Partial",      "40%","Yes","ai-service/app/modules/assessment/","Only language assessment wired; academic MCQ/written not done"],
["13", "Language Reading Assessment (Qwen3 8B scoring)",                  "✅ Done",         "90%","Yes","ai-service + ReadingAssessment.js + ReadingPracticePage.jsx","Teacher review dashboard polish needed"],
["14", "Language Writing Assessment (Qwen3 8B scoring)",                  "✅ Done",         "90%","Yes","ai-service + WritingAssessment.js + WritingPracticePage.jsx","Teacher review dashboard polish needed"],
["15", "Answer Evaluator — full rubric (marks/rubric/Bloom/confidence/missing concepts/mastery update)","🔶 Partial","40%","No","ai-service/app/modules/assessment/service.py","Only language eval complete; 6 of 10 planned fields missing"],
["16", "Error Classification Engine (Concept/Calculation/Reading/Logic)", "❌ Not Started",  "5%", "Yes","NEEDED: ai-service/app/modules/error_classifier/","Blocks gap detection and intervention logic"],
["17", "Baseline Quiz (initial mastery estimate)",                        "✅ Done",         "85%","Yes","backend/models/BaselineQuiz.js + BaselineQuiz.jsx","Results not feeding Mastery Engine pipeline"],

# ─ MASTERY & MEMORY ──────────────────────────────────────────────────────────
["── 4. MASTERY & MEMORY ─────────────────────────────────────────────────────────────────────────────────────"],
["18", "Mastery Engine (score calculate + auto-update after every attempt)","🔶 Partial",    "60%","Yes","backend/services/masteryEngine.js + MasteryScore.js","Auto-update not wired from quiz/test results; badge + notification triggers present"],
["19", "ML Engine (weighted EMA mastery, at-risk detection, class trends)","🔶 Partial",    "50%","No", "backend/services/mlEngine.js + mlRoutes.js","Service exists with EMA decay; at-risk endpoint live; NOT in old CSV"],
["20", "Engagement Scorer (time × views × attempts per topic)",           "🔶 Partial",      "50%","No", "backend/services/engagementScorer.js + engagementRoutes.js","Service built; low-engagement swap suggestions; NOT in old CSV"],
["21", "Spaced Repetition Engine (SM-2 algorithm, review scheduling)",    "🔶 Partial",      "55%","No", "backend/models/SpacedRepetitionSchedule.js + spacedRepetitionRoutes.js","SM-2 intervals built; not triggered from quiz results automatically; listed in old CSV as 'Future ML' — wrong"],
["22", "Student Academic Memory (weak topics, past mistakes, study history)","❌ Not Started","5%","No","NEEDED: extend StudentMemorySummary.js","Language memory done; academic memory not built"],
["23", "Conversation Memory (persisted cross-session)",                   "❌ Not Started",  "5%", "No", "TutorConversation.js exists; no cross-session recall","In-memory per request only"],

# ─ GAP & LEARNING PATH ───────────────────────────────────────────────────────
["── 5. GAP DETECTION & LEARNING PATH ───────────────────────────────────────────────────────────────────────"],
["24", "Gap Detection Engine (traverse graph → root-cause weak topics)",  "❌ Not Started",  "5%", "Yes","NEEDED: ai-service/app/modules/gap_detector/","Biggest missing engine; doc claims ✅ Strong (wrong)"],
["25", "Recommendation Engine (next topic + material based on mastery)",  "🔶 Partial",      "40%","No", "backend/routes/recommendationRoutes.js","Route built using mastery + spaced rep; NOT in old CSV; frontend widget is mocked"],
["26", "AI-generated Learning Path (bridge from gap → target topic)",     "❌ Not Started",  "0%", "Yes","NEEDED in ai-service; TeacherLearningPath.js exists for manual","Manual paths only; no AI bridge path generation"],
["27", "Personalised Study Plan (week-by-week schedule output)",          "❌ Not Started",  "0%", "Yes","NEEDED: integrate gap → path → study plan generator","No plan generation or calendar output"],

# ─ AI CONTENT GENERATION ─────────────────────────────────────────────────────
["── 6. AI CONTENT GENERATION (Student) ─────────────────────────────────────────────────────────────────────"],
["28", "AI Tutor Chat — Explain Mode",                                    "✅ Done",         "90%","No", "ai-service/app/modules/chat/ (mode=explain)","Mode works; not listed separately in old CSV"],
["29", "AI Tutor Chat — Homework Help (Socratic)",                        "✅ Done",         "95%","Yes","ai-service/app/modules/chat/ (mode=homework_help)","7-rule Socratic enforcement active"],
["30", "AI Tutor Chat — Summarize Mode",                                  "✅ Done",         "90%","Yes","ai-service/app/modules/summaries/","Works well"],
["31", "AI Tutor Chat — Notes Mode",                                      "✅ Done",         "90%","Yes","ai-service/app/modules/chat/ (mode=notes)","No save/export to student profile"],
["32", "AI Tutor Chat — Quiz Mode",                                       "✅ Done",         "90%","Yes","ai-service/app/modules/quiz/ + QuizUI","Results not auto-saved to Question Bank"],
["33", "AI Tutor Chat — Flashcard Mode",                                  "✅ Done",         "90%","Yes","ai-service/app/modules/flashcards/ + FlashcardUI","Ratings not persisted to Mastery Engine"],
["34", "AI Tutor Chat — Mind Map Mode",                                   "✅ Done",         "90%","Yes","ai-service/app/modules/chat/ (mode=mind_map) + MindMapUI","No export (PDF/image)"],
["35", "Worksheet / Homework Generation (personalised to mastery gaps)",  "❌ Not Started",  "0%", "No", "NEEDED in ai-service chat module","No personalised worksheet output"],
["36", "Adaptive Difficulty (adjust question hardness based on mastery)", "❌ Not Started",  "0%", "No", "NEEDED: wire MasteryScore into quiz/question generation","All content fixed difficulty today"],

# ─ AI CONTENT GENERATION (Teacher) ──────────────────────────────────────────
["── 7. AI CONTENT GENERATION (Teacher) ─────────────────────────────────────────────────────────────────────"],
["37", "AI Lesson Content Generator (teacher-facing)",                    "🔶 Partial",      "45%","No", "backend/routes/aiTeacherRoutes.js (mode=lesson-content)","Route exists calling /generate/teacher; NOT in old CSV"],
["38", "AI Hinge Question Generator (teacher-facing)",                    "🔶 Partial",      "45%","No", "backend/routes/aiTeacherRoutes.js (mode=hinge-questions)","Route exists; NOT in old CSV"],
["39", "AI Question Paper Generator (teacher selects topic + Bloom)",     "❌ Not Started",  "0%", "No", "mockExamRoutes.js generates questions; no Bloom param","No Bloom-level or difficulty selection"],
["40", "Teacher AI Override (correct/edit an AI answer)",                 "❌ Not Started",  "0%", "No", "NEEDED: teacher annotation layer","No mechanism for teacher to flag or override AI"],

# ─ LANGUAGE ASSESSMENT ───────────────────────────────────────────────────────
["── 8. LANGUAGE ASSESSMENT ─────────────────────────────────────────────────────────────────────────────────"],
["41", "Speech Transcription (faster-whisper)",                           "✅ Done",         "85%","Yes","ai-service/app/modules/speech/service.py","Latency on slow hardware untested"],
["42", "Pronunciation Scoring (SpeechBrain)",                             "✅ Done",         "85%","Yes","ai-service/app/modules/speech/pronunciation.py","Real-device mic testing needed"],
["43", "Student Language Profile (adaptive Qdrant memory)",               "✅ Done",         "80%","Yes","StudentLanguageProfile.js + language_memory module","Not surfaced as student dashboard card"],

# ─ ANALYTICS & INTELLIGENCE ──────────────────────────────────────────────────
["── 9. ANALYTICS & INTELLIGENCE ────────────────────────────────────────────────────────────────────────────"],
["44", "Teacher Analytics Dashboard (class performance)",                 "🔶 Partial",      "40%","Yes","teacherAnalyticsRoutes.js","No per-topic heatmap; no gap insights; no at-risk flag UI"],
["45", "Admin Analytics Dashboard (school-level AI metrics)",             "🔶 Partial",      "35%","Yes","adminAnalyticsRoutes.js","No AI-generated insights; no subject weak-area report"],
["46", "Student Progress Dashboard (unified mastery + gaps + path)",      "🔶 Partial",      "45%","Yes","MasteryView.jsx + LearningPathMapView.jsx","All views independent; no unified health card"],
["47", "At-risk Student Detection (ML engine flag)",                      "🔶 Partial",      "40%","No", "backend/services/mlEngine.js (GET /class/at-risk)","Logic built; not surfaced to teacher in UI; NOT in old CSV"],
["48", "Class Engagement Analytics (per-topic engagement scores)",        "🔶 Partial",      "40%","No", "backend/services/engagementScorer.js + engagementRoutes.js","Service built; no teacher dashboard card; NOT in old CSV"],
["49", "AI-generated Insights for Teacher ('Class struggles with X')",    "❌ Not Started",  "0%", "No", "NEEDED: LLM summarise analytics data","No AI narrative generation over analytics"],
["50", "Wellbeing Tracking (student check-in + admin visibility)",        "🔶 Partial",      "40%","No", "backend/models/Wellbeing.js + wellbeingRoute.js","Model + CRUD route exist; no safeguard/escalation layer; NOT in old CSV"],

# ─ RESEARCH-GRADE FEATURES ───────────────────────────────────────────────────
["── 10. RESEARCH-GRADE FEATURES (from Area to Cover doc) ───────────────────────────────────────────────────"],
["51", "Learner Confidence Tracking (dynamic self-perception)",           "❌ Not Started",  "0%", "No", "NEEDED: new model + AI check-in","No model, no UI, no data collection"],
["52", "Help-Seeking Behaviour (log when/how student asks for help)",     "❌ Not Started",  "0%", "No", "NEEDED: event logging in tutor session","No tracking mechanism"],
["53", "Retention / Forgetting Model (knowledge decay over time)",        "🔶 Partial",      "40%","No", "SpacedRepetitionSchedule.js + spacedRepetitionRoutes.js","SM-2 built; incorrectly listed as 'Future ML' in old CSV"],
["54", "Misconceptions Engine (explicit error model per topic/student)",  "❌ Not Started",  "0%", "No", "NEEDED: extend error classifier output","Error classifier itself not built yet"],
["55", "Multidimensional Engagement (situational + behavioural + emotional)","🔶 Partial",  "25%","No", "engagementScorer.js (behavioural only)","Only behavioural dimension built; situational + emotional missing"],
["56", "Intervention Effectiveness (measure what actually improves learning)","❌ Not Started","0%","No","NEEDED: analytics overlay on interventions","InterventionLog.js exists; no measurement framework"],
["57", "Teacher Escalation (auto-flag students for human support)",       "❌ Not Started",  "0%", "No", "NEEDED: alert system from gap detection / at-risk engine","No alerting or escalation workflow"],
["58", "Student Agency (learner control over learning path)",             "❌ Not Started",  "0%", "No", "NEEDED: student path selection UI + preference store","All paths teacher-assigned"],
["59", "Explainable AI (why did AI recommend / answer this?)",            "❌ Not Started",  "0%", "No", "NEEDED: reasoning trace in tutor response","Black box currently"],
["60", "Social / Belonging Dimension (peer signals + community)",         "❌ Not Started",  "0%", "No", "Alcove exists for posts; no belonging analytics","No social learning signals"],
["61", "Evidence Testing (prove platform improves learning outcomes)",    "❌ Not Started",  "0%", "No", "NEEDED: pre/post measurement framework","No outcome measurement"],
["62", "Equity / Bias Monitoring (detect uneven model performance)",      "❌ Not Started",  "0%", "No", "NEEDED: cohort-level analytics overlay","No bias detection"],
["63", "Wellbeing Safeguards (child protection + human support boundary)","❌ Not Started",  "0%", "No", "NEEDED: escalation policy + safeguard layer","Wellbeing CRUD exists; no safeguard framework"],
["64", "AI / Data Ethics Framework (child-centered, beyond RBAC)",        "🔶 Partial",      "20%","No", "JWT + RBAC + tenant isolation done","No child-ethics policy or consent framework"],

# ─ FUTURE FEATURES ───────────────────────────────────────────────────────────
["── 11. FUTURE FEATURES (Architecture doc roadmap) ─────────────────────────────────────────────────────────"],
["65", "Voice Tutor (speech-to-text + AI response + TTS)",                "❌ Not Started",  "0%", "No", "NEEDED: extend speech module","Speech transcription exists; full voice loop not wired"],
["66", "Image Understanding (student uploads photo of problem)",          "❌ Not Started",  "0%", "No", "NEEDED: vision model integration (LLaVA/Qwen-VL)","No vision model integrated"],
["67", "Video Understanding (lecture video → summary + quiz)",            "❌ Not Started",  "0%", "No", "NEEDED: video ingestion pipeline","No video processing"],
["68", "Code Tutor (programming support + code review)",                  "❌ Not Started",  "0%", "No", "NEEDED: code-specific prompt + execution sandbox","No code tutor mode"],
["69", "Math Solver (step-by-step equation solving)",                     "❌ Not Started",  "0%", "No", "NEEDED: math-aware model or tool (Qwen-Math)","No math-specific model"],
["70", "Topic Failure Prediction (predict fail before test happens)",     "❌ Not Started",  "0%", "No", "NEEDED: time-series model over mastery decay","Requires longitudinal mastery data"],
["71", "Learning Style Detection (visual/reading/quiz preference)",       "❌ Not Started",  "0%", "No", "NEEDED: interaction log clustering","No interaction preference tracking"],
["72", "Performance Forecasting (predicted score on next test)",          "❌ Not Started",  "0%", "Yes","NEEDED: regression over mastery + engagement data","Listed in old CSV as Future ML"],
["73", "At-risk / Dropout Risk Prediction (ML model)",                    "❌ Not Started",  "0%", "Yes","NEEDED: attendance + mastery + engagement pipeline","Listed in old CSV as Future ML"],
]

make_sheet(wb, "All AI Features", INDIGO,
    ["#","Feature","Status","Progress %","In Old CSV?","Files / Location","What's Missing"],
    [4, 48, 16, 11, 13, 45, 42],
    features)


# ══════════════════════════════════════════════════════════════════════════════
# SHEET 2 — What Was Missing from the Old CSV
# ══════════════════════════════════════════════════════════════════════════════
missed = [
["── ALREADY BUILT — but not in the old checklist ────────────────────────"],
["Embedding Engine",            "✅ Done",      "95%","ai-service/app/modules/embeddings/",              "Standalone engine; listed within ingestion only"],
["Explain Mode (AI Tutor)",     "✅ Done",      "90%","ai-service chat module (mode=explain)",            "One of 7 modes; not listed separately"],
["ML Engine (EMA mastery)",     "🔶 Partial",   "50%","backend/services/mlEngine.js",                     "Weighted mastery + at-risk + class trends; completely absent"],
["Engagement Scorer",           "🔶 Partial",   "50%","backend/services/engagementScorer.js",             "Topic-level engagement score; completely absent"],
["Spaced Repetition (SM-2)",    "🔶 Partial",   "55%","backend/models/SpacedRepetitionSchedule.js",       "SM-2 algorithm built; listed in old CSV as 'Future ML' — wrong"],
["Recommendation Engine",       "🔶 Partial",   "40%","backend/routes/recommendationRoutes.js",           "Route with mastery+spaced-rep logic; completely absent"],
["At-risk Student Detection",   "🔶 Partial",   "40%","backend/routes/mlRoutes.js (GET /class/at-risk)",  "Endpoint live; not in old CSV"],
["Engagement Analytics",        "🔶 Partial",   "40%","backend/routes/engagementRoutes.js",               "Endpoint live; not in old CSV"],
["AI Lesson Content (Teacher)", "🔶 Partial",   "45%","backend/routes/aiTeacherRoutes.js (lesson-content)","Teacher AI feature; completely absent"],
["AI Hinge Question (Teacher)", "🔶 Partial",   "45%","backend/routes/aiTeacherRoutes.js (hinge-questions)","Teacher AI feature; completely absent"],
["Wellbeing Tracking",          "🔶 Partial",   "40%","backend/models/Wellbeing.js + wellbeingRoute.js",  "Model + CRUD exist; completely absent"],
["Answer Evaluator (full)",     "🔶 Partial",   "40%","ai-service/app/modules/assessment/",               "Full 10-field evaluator; listed as 'Assessment Engine' only"],

["── ARCHITECTURAL — not in old checklist ────────────────────────────────"],
["AI Orchestrator",             "❌ Not Started","0%", "NEEDED: ai-service/app/orchestrator/",            "Central coordinator; Node calls endpoints directly"],
["Prompt Library",              "❌ Not Started","0%", "NEEDED: ai-service/prompts/",                     "All prompts hardcoded — arch violation"],
["Hybrid Search (BM25+vector)", "❌ Not Started","0%", "NEEDED in retrieval/service.py",                  "Only vector search today"],
["Document Versioning",         "❌ Not Started","0%", "NEEDED in TeachingMaterial.js",                   "Arch doc mandates: never auto-delete old versions"],
["Learning Outcomes Auto-gen",  "❌ Not Started","0%", "NEEDED in documents/service.py",                  "Key step in ingestion pipeline — missing"],
["Bloom Engine",                "❌ Not Started","0%", "NEEDED: ai-service/app/modules/bloom/",           "Zero code; doc claims ✅ Strong (incorrect)"],

["── CONTENT GENERATION — not in old checklist ──────────────────────────"],
["Worksheet / Homework Gen",    "❌ Not Started","0%", "NEEDED in chat module",                           "No personalised worksheet output"],
["Adaptive Difficulty",         "❌ Not Started","0%", "NEEDED: wire MasteryScore → content generation",  "Fixed difficulty today"],
["AI Question Paper (Teacher)", "❌ Not Started","0%", "NEEDED: Bloom + difficulty param in exam gen",    "No Bloom-level selection for teachers"],
["Teacher AI Override",         "❌ Not Started","0%", "NEEDED: annotation layer on AI responses",        "No mechanism to flag/correct AI answers"],

["── RESEARCH-GRADE — not in old checklist ──────────────────────────────"],
["Learner Confidence",          "❌ Not Started","0%", "NEEDED: new model + AI check-in flow",            "No data collection"],
["Help-Seeking Behaviour",      "❌ Not Started","0%", "NEEDED: event logging in tutor session",          "No tracking"],
["Misconceptions Engine",       "❌ Not Started","0%", "NEEDED: extend error classifier",                 "Error classifier itself not built"],
["Multidimensional Engagement", "🔶 Partial",   "25%","engagementScorer.js (behavioural only)",           "Situational + emotional dimensions missing"],
["Intervention Effectiveness",  "❌ Not Started","0%", "NEEDED: analytics on interventions",              "InterventionLog.js exists; no measurement"],
["Teacher Escalation",          "❌ Not Started","0%", "NEEDED: alert from gap/at-risk engine",           "No escalation workflow"],
["Student Agency",              "❌ Not Started","0%", "NEEDED: path selection UI",                       "All paths teacher-assigned"],
["Explainable AI",              "❌ Not Started","0%", "NEEDED: reasoning trace in tutor response",       "Black box"],
["Social / Belonging",          "❌ Not Started","0%", "Alcove posts exist; no belonging analytics",      "No social learning signals"],
["Evidence Testing",            "❌ Not Started","0%", "NEEDED: pre/post outcome measurement",            "No framework"],
["Equity / Bias Monitoring",    "❌ Not Started","0%", "NEEDED: cohort analytics overlay",               "No bias detection"],
["Wellbeing Safeguards",        "❌ Not Started","0%", "NEEDED: escalation policy + child protection",    "Wellbeing CRUD exists; no safeguard layer"],
["AI / Data Ethics Framework",  "🔶 Partial",   "20%","JWT + RBAC + tenant isolation done",              "Child-ethics policy not designed"],

["── FUTURE — not in old checklist ──────────────────────────────────────"],
["Voice Tutor",                 "❌ Not Started","0%", "Extend speech module",                            "Transcription exists; full voice loop not wired"],
["Image Understanding",         "❌ Not Started","0%", "NEEDED: vision model (LLaVA/Qwen-VL)",            "No vision model"],
["Video Understanding",         "❌ Not Started","0%", "NEEDED: video ingestion pipeline",                "No video processing"],
["Code Tutor",                  "❌ Not Started","0%", "NEEDED: code-mode prompt + sandbox",              "No code tutor mode"],
["Math Solver",                 "❌ Not Started","0%", "NEEDED: math model (Qwen-Math)",                  "No math-specific model"],
["Topic Failure Prediction",    "❌ Not Started","0%", "NEEDED: time-series over mastery decay",          "Not in old CSV at all"],
["Learning Style Detection",    "❌ Not Started","0%", "NEEDED: interaction log clustering",              "Not in old CSV at all"],
]

ws2 = wb.add_worksheet("Missing from Old CSV")
ws2.set_tab_color(ROSE)
ws2.freeze_panes(3,0)
ws2.set_row(0,30); ws2.set_row(1,6); ws2.set_row(2,18)
ws2.merge_range(0,0,0,5,"EEC ML — Features Missing from Old CSV Checklist", f_title)
heads = ["Feature","Status","Progress %","Files / Location","Why It Was Missing"]
widths= [38,16,11,42,48]
for c,(h,w) in enumerate(zip(heads,widths)): ws2.set_column(c,c,w); ws2.write(2,c,h,f_head)
r=3
for row in missed:
    if len(row)==1: ws2.merge_range(r,0,r,4,row[0],f_cat); r+=1; continue
    status=row[1]
    ws2.write(r,0,row[0],f_bold)
    ws2.write(r,1,status,sf(wb,status))
    ws2.write(r,2,row[2],pf(wb,status))
    ws2.write(r,3,row[3],f_plain)
    ws2.write(r,4,row[4],f_plain)
    r+=1
ws2.autofilter(2,0,r-1,4)


# ══════════════════════════════════════════════════════════════════════════════
# SHEET 3 — Backend Models
# ══════════════════════════════════════════════════════════════════════════════
model_rows = [
["── AUTH & USERS ─────────────────────────────────────────────────────────"],
["Admin.js","Admin user schema","✅ Done","100%","adminRoutes.js","Full CRUD + RBAC"],
["ParentUser.js","Parent account","✅ Done","100%","parentRoute.js","Full portal"],
["Principal.js","Principal account","✅ Done","100%","principalRoutes.js","Full portal"],
["StaffUser.js","Non-teaching staff","✅ Done","100%","staffRoutes.js","Full portal"],
["StudentUser.js","Student account","✅ Done","100%","studentRoute.js","Full portal"],
["TeacherUser.js","Teacher account","✅ Done","100%","teacherRoute.js","Full portal"],
["SuperAdminActivity.js","Super-admin audit log","✅ Done","100%","superAdminRoutes.js","Audit trail"],

["── SCHOOL STRUCTURE ────────────────────────────────────────────────────"],
["Organization.js","Top-level tenant","✅ Done","100%","organizationRoutes.js","Multi-tenant root"],
["School.js","School entity","✅ Done","100%","schoolRoutes.js","Full CRUD"],
["AcademicYear.js","Academic year","✅ Done","100%","academicRoutes.js","Full CRUD"],
["Class.js","Class / grade","✅ Done","100%","academicRoutes.js","Full CRUD"],
["Section.js","Section in class","✅ Done","100%","academicRoutes.js","Full CRUD"],
["Subject.js","Subject entity","✅ Done","100%","subjectRoute.js","Full CRUD"],
["Department.js","Teacher department","✅ Done","100%","departmentRoutes.js","Full CRUD"],
["Timetable.js","Class timetable","✅ Done","100%","timetableRoutes.js","Full CRUD"],
["Building.js","Campus building","✅ Done","100%","—","Reference data"],
["Floor.js","Floor in building","✅ Done","100%","—","Reference data"],
["Room.js","Classroom entity","✅ Done","100%","—","Reference data"],
["Holiday.js","Holiday calendar","✅ Done","100%","holidayRoutes.js","Full CRUD"],
["TeacherAllocation.js","Teacher → class-subject","✅ Done","100%","teacherAllocationRoutes.js","Full CRUD"],

["── ACADEMIC & EXAMS ────────────────────────────────────────────────────"],
["Assignment.js","Assignment + submissions","✅ Done","100%","assignmentRoute.js","Full CRUD"],
["Exam.js","Exam entity","✅ Done","100%","examRoute.js","Full CRUD"],
["ExamAttempt.js","Student exam attempt","✅ Done","100%","examRoute.js","Recorded"],
["ExamGroup.js","Exam grouping","✅ Done","100%","examRoute.js","Full CRUD"],
["ExamQuestion.js","MCQ/short/long question","🔶 Partial","50%","examRoute.js","No Bloom level; no difficulty calibration"],
["ExamResult.js","Exam result record","✅ Done","100%","examRoute.js","Full CRUD"],
["LessonPlan.js","Teacher lesson plan","✅ Done","100%","lessonPlanRoutes.js","Full CRUD"],
["LessonPlanCompletion.js","Lesson completion track","✅ Done","100%","lessonPlanRoutes.js","Tracked"],
["ReportCardTemplate.js","Report card template","✅ Done","100%","reportRoutes.js","Full CRUD"],
["TeachingMaterial.js","Teacher-uploaded material","✅ Done","100%","teachingMaterialRoutes.js","Cloudinary + Qdrant ingest"],
["Rubric.js","Grading rubric","🔶 Partial","60%","rubricRoutes.js","Not linked to answer evaluator"],
["PromotionHistory.js","Student promotion record","✅ Done","100%","promotionRoutes.js","Full CRUD"],

["── AI & LEARNING ───────────────────────────────────────────────────────"],
["CurriculumMap.js","Topic prerequisite graph","🔶 Partial","30%","curriculumMapRoutes.js","No traversal; no auto-update on ingest"],
["MasteryScore.js","Per-topic mastery score","🔶 Partial","60%","masteryRoutes.js","Not auto-updated after quiz/test"],
["BaselineQuiz.js","Baseline quiz schema","✅ Done","85%","baselineRoutes.js","Results not feeding mastery"],
["BaselineResult.js","Baseline quiz result","🔶 Partial","60%","baselineRoutes.js","Not wired to mastery update"],
["PracticePaper.js","Practice paper","✅ Done","100%","practicePaperRoutes.js","Full CRUD"],
["PracticeQuestion.js","Practice question","🔶 Partial","50%","practiceRoutes.js","No Bloom; not AI-generated"],
["PracticeSection.js","Practice paper section","✅ Done","100%","practiceSectionRoutes.js","Full CRUD"],
["PracticeAttempt.js","Practice attempt","🔶 Partial","60%","practiceRoutes.js","Not feeding mastery"],
["TryoutResult.js","AI tryout result","✅ Done","90%","aiLearningRoute.js","Ratings not feeding mastery"],
["FlashcardResult.js","Flashcard rating result","🔶 Partial","40%","—","Model exists; not persisted from UI"],
["ExternalResource.js","External study links","✅ Done","100%","externalResourceRoutes.js","Full CRUD"],
["SpacedRepetitionSchedule.js","SM-2 review schedule","🔶 Partial","55%","spacedRepetitionRoutes.js","SM-2 logic built; not auto-triggered from results"],
["TeacherLearningPath.js","Teacher learning path","🔶 Partial","45%","learningPathRoutes.js","Manual only; no AI generation"],
["StudentProgress.js","Student progress snapshot","🔶 Partial","50%","progressRoute.js","Not linked to mastery/gap"],
["StudentMemorySummary.js","AI student memory summary","🔶 Partial","30%","—","Academic memory pipeline partial"],
["TutorConversation.js","AI tutor chat session","🔶 Partial","40%","aiTutorRoutes.js","Per-session only; no cross-session recall"],
["ReadingMaterial.js","Reading passage upload","✅ Done","100%","readingAssessmentRoutes.js","Full CRUD"],
["ReadingAssessment.js","Reading attempt + scores","✅ Done","95%","readingAssessmentRoutes.js","End-to-end pipeline working"],
["WritingPrompt.js","Writing prompt upload","✅ Done","100%","writingAssessmentRoutes.js","Full CRUD"],
["WritingAssessment.js","Writing submission + scores","✅ Done","95%","writingAssessmentRoutes.js","End-to-end pipeline working"],
["StudentLanguageProfile.js","Adaptive language profile","✅ Done","85%","—","Qdrant memory active"],

["── STUDENT WELFARE ─────────────────────────────────────────────────────"],
["StudentBadge.js","Achievement badge","🔶 Partial","60%","achievementRoutes.js","Badge model + masteryEngine award logic; no full auto-award UI"],
["StudentJournalEntry.js","Personal journal","🔶 Partial","40%","—","Model exists; no UI"],
["StudentObservation.js","Teacher observation note","🔶 Partial","50%","studentObservationRoutes.js","Not linked to intervention"],
["Wellbeing.js","Wellbeing check-in","🔶 Partial","40%","wellbeingRoute.js","No safeguard/escalation layer"],
["InterventionLog.js","Teacher intervention record","🔶 Partial","30%","—","No auto-trigger from gaps"],
["Behaviour.js","Behaviour incident","✅ Done","100%","behaviourRoute.js","Full CRUD"],
["ExcuseLetter.js","Excuse letter submission","✅ Done","100%","excuseLetterRoutes.js","Full CRUD"],

["── COMMUNICATION & FINANCE ─────────────────────────────────────────────"],
["ChatThread.js","Real-time chat thread","✅ Done","100%","chatRoutes.js","Socket.IO active"],
["ChatMessage.js","Chat message","✅ Done","100%","chatRoutes.js","Active"],
["Notification.js","Push notification","✅ Done","100%","notificationRoutes.js","Web push + in-app"],
["PushSubscription.js","Browser push sub","✅ Done","100%","notificationRoutes.js","VAPID keys active"],
["AlcovePost.js","Academic Alcove post","✅ Done","100%","alcoveRoute.js","Full CRUD"],
["AlcoveComment.js","Alcove comment","✅ Done","100%","alcoveRoute.js","Full CRUD"],
["AlcoveSubmission.js","Alcove submission","✅ Done","100%","alcoveRoute.js","Full CRUD"],
["FeeStructure.js","Fee structure","✅ Done","100%","feeRoutes.js","Full CRUD"],
["FeeInvoice.js","Fee invoice","✅ Done","100%","feeRoutes.js","Full CRUD"],
["FeePayment.js","Razorpay payment","✅ Done","100%","feeRoutes.js","Razorpay integrated"],
["PaymentAudit.js","Payment audit trail","✅ Done","100%","paymentSettingsRoutes.js","Full audit log"],
["AuditLog.js","System audit log","✅ Done","100%","auditLogRoutes.js","All key events logged"],
]

make_sheet(wb,"Backend Models", BLUE,
    ["Model File","Purpose","Status","Progress %","Route File","Notes / Gaps"],
    [30,35,16,11,30,42], model_rows)


# ══════════════════════════════════════════════════════════════════════════════
# SHEET 4 — AI Service Modules
# ══════════════════════════════════════════════════════════════════════════════
ai_rows = [
["── BUILT ──────────────────────────────────────────────────────────────"],
["documents",     "Document ingestion","OCR → parse → chunk → embed → Qdrant upsert","✅ Done","90%","Topic auto-detect + Bloom tagging missing"],
["parser",        "Text extract + cleaner","PyMuPDF/Tesseract/docx/pptx; strip teacher notes","✅ Done","90%","_strip_teacher_notes() active"],
["embeddings",    "Embedding generation","nomic-embed-text → Qdrant","✅ Done","95%","Fully wired"],
["retrieval",     "Semantic retrieval","Qdrant metadata filters: school/class/section/subject/chapter","✅ Done","90%","Hybrid BM25+semantic not yet done"],
["chat",          "RAG tutor — all modes","explain/quiz/flashcards/notes/mindmap/summarize/homework_help","✅ Done","90%","Prompts hardcoded; no prompt library"],
["quiz",          "Quiz generation","5 MCQ per request via RAG","✅ Done","80%","No Bloom; not saved to question bank"],
["flashcards",    "Flashcard generation","Q:/A: format via RAG","✅ Done","85%","Ratings not persisted to mastery"],
["summaries",     "Summary generation","Chapter summaries; OCR + summarize endpoint","✅ Done","90%","Working well"],
["assessment",    "Language eval (Qwen3 8B)","Reading + writing rubric + score JSON","✅ Done","90%","Academic MCQ eval not wired"],
["speech",        "Audio transcription","faster-whisper + SpeechBrain pronunciation","✅ Done","85%","Real-device latency testing needed"],
["language_memory","Adaptive language memory","Qdrant student_language_memory; store/retrieve","✅ Done","80%","Academic memory not included"],
["admin",         "Admin module","Admin-facing AI controls","🔶 Partial","20%","Scaffolded; not fully implemented"],

["── NOT YET BUILT ──────────────────────────────────────────────────────"],
["orchestrator",  "Central AI coordinator","Node → Orchestrator → engines","❌ Not Started","0%","Biggest arch violation"],
["knowledge_graph","Graph traversal","Walk prerequisites; find root-cause weak topics","❌ Not Started","0%","Model in Node; no Python engine"],
["bloom",         "Bloom classifier","Tag documents, questions, answers","❌ Not Started","0%","Not in any pipeline step"],
["mastery_engine","Mastery calculator","accuracy + attempts + time + recency; auto-update","❌ Not Started","0%","masteryEngine.js in Node; no Python module"],
["error_classifier","Error type classifier","Concept/Calculation/Reading/Logic","❌ Not Started","0%","No service, no route, no model"],
["gap_detector",  "Gap detection","Prerequisite traversal → root-cause weak topic","❌ Not Started","0%","Blocked by error classifier"],
["recommendation","Recommendation engine","Next topic based on mastery + curriculum graph","❌ Not Started","0%","Node route exists; no AI engine"],
["analytics",     "AI analytics insights","Per-topic heatmap; at-risk; AI narrative","❌ Not Started","0%","Basic Node routes exist"],
["prompt_library","Prompt directory","externalise all prompts from Python modules","❌ Not Started","0%","Arch violation — all prompts hardcoded"],
]

make_sheet(wb,"AI Service Modules", PURPLE,
    ["Module","Responsibility","What It Does","Status","Progress %","Notes / Gaps"],
    [20,24,46,16,11,44], ai_rows)


# ══════════════════════════════════════════════════════════════════════════════
# SHEET 5 — Summary
# ══════════════════════════════════════════════════════════════════════════════
ws5 = wb.add_worksheet("Summary")
ws5.set_tab_color(GREEN)
ws5.set_column(0,0,38); ws5.set_column(1,1,14); ws5.set_column(2,2,12)
ws5.set_column(3,3,12); ws5.set_column(4,4,14); ws5.set_column(5,5,40)
ws5.set_row(0,30); ws5.set_row(1,6); ws5.set_row(2,18)
ws5.merge_range(0,0,0,5,"EEC ML — Master Progress Summary (2026-08-11)",f_title)
for c,h in enumerate(["Domain","Total Features","✅ Done","🔶 Partial","❌ Not Started","Next Action"]):
    ws5.write(2,c,h,f_head)

summary=[
["Core AI Pipeline",               6,  3, 0, 3,"Build Orchestrator + Prompt Library first"],
["Content Intelligence",           5,  0, 2, 3,"Bloom Engine + Learning Outcomes + Doc Versioning"],
["Assessment & Evaluation",        6,  3, 1, 2,"Wire academic MCQ eval + full Answer Evaluator"],
["Mastery & Memory",               6,  1, 4, 1,"Auto-update mastery + build academic memory"],
["Gap & Learning Path",            4,  0, 0, 4,"Error Classifier → Gap Detector → AI Path"],
["AI Content Generation (Student)",9,  7, 0, 2,"Adaptive Difficulty + Worksheet Generation"],
["AI Content Generation (Teacher)",4,  0, 2, 2,"Bloom param for question paper + Teacher Override"],
["Language Assessment",            3,  3, 0, 0,"Complete — minor polish only"],
["Analytics & Intelligence",       7,  0, 5, 2,"Surface at-risk + engagement into teacher UI"],
["Research-Grade Features",       14,  0, 3,11,"Post-foundation — requires mastery+gap pipeline first"],
["Future Features",                9,  0, 0, 9,"Architecture-ready; build after core is solid"],
]

r=3
for d in summary:
    ws5.write(r,0,d[0],f_bold)
    ws5.write(r,1,d[1],f_center)
    ws5.write(r,2,d[2],f_pct_d if d[2]>0 else f_center)
    ws5.write(r,3,d[3],f_pct_p if d[3]>0 else f_center)
    ws5.write(r,4,d[4],f_pct_n if d[4]>0 else f_center)
    ws5.write(r,5,d[5],f_plain)
    r+=1

totals=[sum(d[i] for d in summary) for i in range(1,5)]
r+=1
ws5.write(r,0,"TOTAL",f_bold)
ws5.write(r,1,totals[0],fmt(wb,bold=True,align="center"))
ws5.write(r,2,totals[1],fmt(wb,bold=True,color=DONE_BG,font_color=DONE_FG,align="center"))
ws5.write(r,3,totals[2],fmt(wb,bold=True,color=PART_BG,font_color=PART_FG,align="center"))
ws5.write(r,4,totals[3],fmt(wb,bold=True,color=NO_BG,font_color=NO_FG,align="center"))
ws5.write(r,5,"",f_plain)
r+=2

pct=round(totals[1]/totals[0]*100)
ws5.merge_range(r,0,r,5,
    f"Overall: {totals[1]} Done + {totals[2]} Partial out of {totals[0]} total features ({pct}% fully done)",
    fmt(wb,bold=True,color=INDIGO,font_color="#FFFFFF",size=12,border=0))
r+=2

ws5.merge_range(r,0,r,5,"OLD CSV HAD 31 ITEMS — ACTUAL TOTAL IS 73 AI FEATURES",
    fmt(wb,bold=True,color=ROSE,font_color="#FFFFFF",size=11,border=0))
r+=1
ws5.merge_range(r,0,r,5,"42 features were completely missing from the old checklist (see 'Missing from Old CSV' sheet)",
    fmt(wb,bold=True,color="#FEE2E2",font_color=ROSE,size=10,border=0))
r+=2

ws5.merge_range(r,0,r,5,"TOP 5 PRIORITIES",fmt(wb,bold=True,color=DARK,font_color="#FFFFFF",size=11,border=0))
r+=1
for rank,title,reason in [
    ("1","Error Classification Engine","Nothing downstream works without it — blocks Gap Detection + Intervention"),
    ("2","Mastery Engine Auto-Update","Wire quiz/test/assessment results → MasteryScore after every attempt"),
    ("3","Gap Detection Engine","Core intelligence: traverse curriculum graph → root-cause weak topics"),
    ("4","AI Orchestrator","Fix arch violation — Node must call Orchestrator, not individual endpoints"),
    ("5","Prompt Library","Externalise all hardcoded prompts — required by architecture doc"),
]:
    ws5.write(r,0,f"{rank}. {title}",f_bold)
    ws5.merge_range(r,1,r,5,reason,f_plain)
    r+=1

wb.close()
print("Done: ML Progress Sheet.xlsx")

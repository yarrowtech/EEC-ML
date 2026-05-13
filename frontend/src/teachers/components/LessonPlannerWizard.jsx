import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  FileText,
  Map,
  ClipboardCheck,
  Layers,
  BookMarked,
  GraduationCap,
  Eye,
} from "lucide-react";

const SUBJECTS = ["Mathematics", "Science", "English", "Social Studies", "Hindi"];

const CHAPTERS = {
  Mathematics: ["Number System", "Algebra", "Geometry", "Statistics", "Probability"],
  Science: ["Matter & Its States", "Cell Biology", "Motion & Force", "Light & Sound", "Ecosystems"],
  English: ["Prose", "Poetry", "Grammar", "Writing Skills", "Literature"],
  "Social Studies": ["History", "Geography", "Civics", "Economics"],
  Hindi: ["Gadya", "Padya", "Vyakaran", "Lekhan"],
};

const TOPICS = {
  "Number System": ["Natural Numbers", "Integers", "Rational Numbers", "Irrational Numbers"],
  Algebra: ["Linear Equations", "Polynomials", "Quadratic Equations", "Sequences"],
  "Cell Biology": ["Cell Structure", "Cell Division", "Organelles", "Osmosis & Diffusion"],
  "Matter & Its States": ["Solid", "Liquid", "Gas", "Plasma", "Changes of State"],
};

const LEARNING_PATHS = [
  { id: "concept", label: "Concept-first", desc: "Theory -> Examples -> Practice" },
  { id: "inquiry", label: "Inquiry-based", desc: "Question -> Explore -> Conclude" },
  { id: "activity", label: "Activity-led", desc: "Hands-on -> Reflect -> Synthesise" },
  { id: "flipped", label: "Flipped classroom", desc: "Pre-read -> Discuss -> Apply" },
];

const MATERIAL_TYPES = [
  "Lecture slides", "Video lesson", "Worksheet", "Lab manual",
  "Mind map", "Case study", "Infographic", "Textbook reference",
];

const ASSESSMENT_TYPES = [
  "MCQ quiz", "Short answer", "HOTS questions",
  "Project / assignment", "Class participation", "Unit test",
];

const STEPS = [
  { id: "subject", label: "Subject", icon: BookOpen },
  { id: "chapter", label: "Chapter", icon: BookMarked },
  { id: "topic", label: "Topic", icon: Layers },
  { id: "subtopic", label: "Sub-topic", icon: FileText },
  { id: "path", label: "Learning path", icon: Map },
  { id: "materials", label: "Materials", icon: GraduationCap },
  { id: "assess", label: "Assessments", icon: ClipboardCheck },
];

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function PreviewPane({ plan }) {
  const isEmpty = !plan.subject && !plan.chapter;
  return (
    <div className="flex flex-col gap-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Eye size={14} />
        Live preview
      </div>

      {isEmpty ? (
        <p className="text-xs italic text-muted-foreground">
          Fill the steps on the left to see your lesson plan take shape here.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {plan.subject && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
              <Badge variant="secondary">{plan.subject}</Badge>
            </div>
          )}
          {plan.chapter && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Chapter</p>
              <p className="font-medium">{plan.chapter}</p>
            </div>
          )}
          {plan.topic && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Topic</p>
              <p className="font-medium">{plan.topic}</p>
            </div>
          )}
          {plan.subtopic && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Sub-topic</p>
              <p className="text-foreground/80">{plan.subtopic}</p>
            </div>
          )}
          {plan.learningPath && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Learning path</p>
              <Badge>{plan.learningPath.label}</Badge>
              <p className="mt-1 text-xs text-muted-foreground">{plan.learningPath.desc}</p>
            </div>
          )}
          {plan.materials?.length > 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Materials</p>
              <div className="flex flex-wrap gap-1">
                {plan.materials.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          )}
          {plan.assessments?.length > 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Assessments</p>
              <div className="flex flex-wrap gap-1">
                {plan.assessments.map((a) => (
                  <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepSubject({ plan, update }) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Assigned subject</Label>
        <Select value={plan.subject || ""} onValueChange={(v) => update({ subject: v, chapter: "", topic: "", subtopic: "" })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a subject..." />
          </SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {plan.subject && (
        <div>
          <Label className="mb-2 block">Class / grade</Label>
          <Select value={plan.grade || ""} onValueChange={(v) => update({ grade: v })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose class..." />
            </SelectTrigger>
            <SelectContent>
              {["Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function StepChapter({ plan, update }) {
  const chapters = CHAPTERS[plan.subject] || [];
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Chapter</Label>
        <Select value={plan.chapter || ""} onValueChange={(v) => update({ chapter: v, topic: "", subtopic: "" })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a chapter..." />
          </SelectTrigger>
          <SelectContent>
            {chapters.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepTopic({ plan, update }) {
  const topics = TOPICS[plan.chapter] || ["Topic A", "Topic B", "Topic C"];
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Topic</Label>
        <Select value={plan.topic || ""} onValueChange={(v) => update({ topic: v, subtopic: "" })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a topic..." />
          </SelectTrigger>
          <SelectContent>
            {topics.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepSubtopic({ plan, update }) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Sub-topic / focus area</Label>
        <Textarea
          placeholder="Describe the specific sub-topic or learning focus for this lesson..."
          value={plan.subtopic || ""}
          onChange={(e) => update({ subtopic: e.target.value })}
          rows={4}
          className="resize-none"
        />
      </div>
      <div>
        <Label className="mb-2 block">Duration</Label>
        <Select value={plan.duration || ""} onValueChange={(v) => update({ duration: v })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Lesson duration..." />
          </SelectTrigger>
          <SelectContent>
            {["30 minutes", "45 minutes", "60 minutes", "90 minutes", "2 hours"].map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StepPath({ plan, update }) {
  return (
    <div className="space-y-3">
      <Label className="mb-2 block">Choose a learning path</Label>
      {LEARNING_PATHS.map((p) => {
        const selected = plan.learningPath?.id === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => update({ learningPath: p })}
            className={cn(
              "w-full rounded-lg border p-4 text-left transition-all",
              selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
            )}
          >
            <p className={cn("text-sm font-medium", selected && "text-primary")}>{p.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

function StepMaterials({ plan, update }) {
  const selected = plan.materials || [];
  return (
    <div className="space-y-3">
      <Label className="mb-2 block">Select materials to prepare</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MATERIAL_TYPES.map((m) => {
          const checked = selected.includes(m);
          return (
            <div
              key={m}
              onClick={() => update({ materials: toggle(selected, m) })}
              className={cn(
                "flex cursor-pointer select-none items-center gap-2 rounded-lg border p-3 transition-all",
                checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <Checkbox checked={checked} onCheckedChange={() => update({ materials: toggle(selected, m) })} className="pointer-events-none" />
              <span className="text-sm">{m}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepAssessments({ plan, update }) {
  const selected = plan.assessments || [];
  return (
    <div className="space-y-3">
      <Label className="mb-2 block">Assessment methods</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ASSESSMENT_TYPES.map((a) => {
          const checked = selected.includes(a);
          return (
            <div
              key={a}
              onClick={() => update({ assessments: toggle(selected, a) })}
              className={cn(
                "flex cursor-pointer select-none items-center gap-2 rounded-lg border p-3 transition-all",
                checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <Checkbox checked={checked} onCheckedChange={() => update({ assessments: toggle(selected, a) })} className="pointer-events-none" />
              <span className="text-sm">{a}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepContent({ stepIndex, plan, update }) {
  switch (stepIndex) {
    case 0: return <StepSubject plan={plan} update={update} />;
    case 1: return <StepChapter plan={plan} update={update} />;
    case 2: return <StepTopic plan={plan} update={update} />;
    case 3: return <StepSubtopic plan={plan} update={update} />;
    case 4: return <StepPath plan={plan} update={update} />;
    case 5: return <StepMaterials plan={plan} update={update} />;
    case 6: return <StepAssessments plan={plan} update={update} />;
    default: return null;
  }
}

function CompletionView({ plan, onReset }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="text-green-600" size={32} />
      </div>
      <div>
        <h2 className="text-xl font-semibold">Lesson plan created!</h2>
        <p className="mt-1 text-sm text-muted-foreground">{plan.subject} · {plan.chapter} · {plan.topic}</p>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-3 text-left sm:grid-cols-2">
        {plan.learningPath && (
          <Card className="sm:col-span-2">
            <CardContent className="pb-3 pt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Learning path</p>
              <p className="text-sm font-medium">{plan.learningPath.label}</p>
              <p className="text-xs text-muted-foreground">{plan.learningPath.desc}</p>
            </CardContent>
          </Card>
        )}
        {plan.materials?.length > 0 && (
          <Card>
            <CardContent className="pb-3 pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Materials</p>
              <div className="flex flex-wrap gap-1">
                {plan.materials.map((m) => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}
        {plan.assessments?.length > 0 && (
          <Card>
            <CardContent className="pb-3 pt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Assessments</p>
              <div className="flex flex-wrap gap-1">
                {plan.assessments.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>Create another</Button>
        <Button>Save lesson plan</Button>
      </div>
    </div>
  );
}

const LessonPlannerWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [plan, setPlan] = useState({});

  const update = (partial) => setPlan((prev) => ({ ...prev, ...partial }));

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!plan.subject && !!plan.grade;
      case 1: return !!plan.chapter;
      case 2: return !!plan.topic;
      case 3: return !!plan.subtopic?.trim();
      case 4: return !!plan.learningPath;
      case 5: return (plan.materials?.length || 0) > 0;
      case 6: return (plan.assessments?.length || 0) > 0;
      default: return false;
    }
  };

  const goNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1);
    else setCompleted(true);
  };

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const reset = () => {
    setCurrentStep(0);
    setPlan({});
    setCompleted(false);
  };

  if (completed) return <CompletionView plan={plan} onReset={reset} />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Lesson planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length} - {STEPS[currentStep].label}
          </p>
        </div>

        <div className="mb-8 flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.id} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => isDone && setCurrentStep(idx)}
                  disabled={!isDone}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    isCurrent && "bg-primary text-primary-foreground",
                    isDone && "cursor-pointer text-primary hover:bg-primary/10",
                    !isCurrent && !isDone && "cursor-default text-muted-foreground"
                  )}
                >
                  {isDone ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && <ChevronRight size={14} className="shrink-0 text-border" />}
              </div>
            );
          })}
        </div>

        <div className="mb-8 h-1 w-full rounded-full bg-muted">
          <div className="h-1 rounded-full bg-primary transition-all duration-500" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  {(() => {
                    const Icon = STEPS[currentStep].icon;
                    return <Icon size={16} className="text-primary" />;
                  })()}
                  {STEPS[currentStep].label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StepContent stepIndex={currentStep} plan={plan} update={update} />
              </CardContent>
            </Card>

            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={goBack} disabled={currentStep === 0} className="gap-1">
                <ChevronLeft size={15} />
                Back
              </Button>
              <Button onClick={goNext} disabled={!canProceed()} className="gap-1">
                {currentStep === STEPS.length - 1 ? "Finish" : "Next"}
                {currentStep < STEPS.length - 1 && <ChevronRight size={15} />}
              </Button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardContent className="pt-5">
                <PreviewPane plan={plan} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonPlannerWizard;

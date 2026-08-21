import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AssignmentPortal from '../AssignmentPortal';

jest.mock('axios');

const submission = {
  submissionId: 'submission-1',
  studentId: 'student-1',
  studentName: 'Asha Student',
  grade: '5',
  assignmentId: 'assignment-1',
  assignmentTitle: 'Fractions activity',
  type: 'Assignment',
  totalMarks: 20,
  submissionText: 'My submitted answer about equivalent fractions.',
  attachmentUrl: '',
  status: 'graded',
  score: 17,
  feedback: 'Good explanation',
  publishedByTeacher: false,
  aiGradingStatus: 'skipped',
  submittedAt: '2026-08-20T10:00:00.000Z',
};

const assignedClass = {
  academicYearId: 'year-1',
  sessionName: '2026-27',
  classId: 'class1',
  className: '5',
  sectionId: 'section1',
  sectionName: 'A',
  subjects: [{ id: 'subject1', name: 'Mathematics' }],
};

const publishedLessonPlan = {
  _id: 'lessonplan1',
  title: 'Fractions Learning Plan',
  classId: 'class1',
  sectionId: 'section1',
  subjectId: 'subject1',
  subject: 'Mathematics',
  status: 'published',
  isDraft: false,
  plannerContent: {
    chapters: [{ id: 'fractions-chapter', title: 'Fractions' }],
  },
};

const draftAssignment = {
  _id: 'assignment-draft-1',
  title: 'Fractions homework',
  description: 'Solve the fraction questions.',
  subject: 'Mathematics',
  topic: 'Equivalent Fractions',
  type: 'Assignment',
  difficulty: 'Medium',
  class: '5',
  section: 'A',
  classId: { _id: 'class1', name: '5' },
  sectionId: { _id: 'section1', name: 'A' },
  academicYearId: 'year-1',
  sessionName: '2026-27',
  marks: 20,
  status: 'draft',
  submissionFormat: 'text',
  dueDate: '2026-09-01T00:00:00.000Z',
  attachments: [],
};

const CurrentPath = () => {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}{location.search}</span>;
};

const renderPortal = (initialEntry = '/teacher/classes/current/assignments/manage') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <CurrentPath />
    <Routes>
      <Route path="/teacher/classes/:classId/assignments/manage" element={<AssignmentPortal view="manage" />} />
      <Route path="/teacher/classes/:classId/assignments/evaluate" element={<AssignmentPortal view="evaluate" />} />
      <Route path="/teacher/classes/:classId/teaching/practice-questions" element={<div>Practice question editor</div>} />
    </Routes>
  </MemoryRouter>
);

describe('AssignmentPortal workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'teacher-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/academic/active-year')) {
        return Promise.resolve({ data: { _id: 'year-1', name: '2026-27' } });
      }
      if (url.includes('/teacher/my-classes')) return Promise.resolve({ data: [assignedClass] });
      if (url.includes('/teacher/my-assignments')) return Promise.resolve({ data: [] });
      if (url.includes('/teacher/submissions')) return Promise.resolve({ data: [submission] });
      if (url.includes('/tryout-submissions')) return Promise.resolve({ data: { results: [] } });
      if (url.includes('/api/lesson-plans/teacher/my')) return Promise.resolve({ data: [publishedLessonPlan] });
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: { publishedCount: 1 } });
  });

  afterEach(() => {
    localStorage.clear();
    delete global.fetch;
  });

  test('opens in management mode and allows switching to submission evaluation', async () => {
    const user = userEvent.setup();
    renderPortal();

    expect(await screen.findByText('No assignments found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Evaluate Submissions/i }));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/teacher/classes/current/assignments/evaluate');
    expect(await screen.findByText('My submitted answer about equivalent fractions.')).toBeInTheDocument();
  });

  test('opens the evaluation route directly', async () => {
    const user = userEvent.setup();
    renderPortal('/teacher/classes/5-a/assignments/evaluate');

    expect(screen.getByTestId('current-path')).toHaveTextContent('/teacher/classes/5-a/assignments/evaluate');
    expect(await screen.findByText('My submitted answer about equivalent fractions.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Manage Assignments/i }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/teacher/classes/5-a/assignments/manage');
    expect(await screen.findByText('No assignments found')).toBeInTheDocument();
  });

  test('opens the MCQ editor inside the manage page', async () => {
    const user = userEvent.setup();
    renderPortal('/teacher/classes/5-a/assignments/manage');

    await user.click(await screen.findByRole('button', { name: /MCQ Multiple choice/i }));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/teacher/classes/5-a/assignments/manage');
    expect(screen.getByText('MCQ Editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close editor/i })).toBeInTheDocument();
  });

  test('links a new assignment to a published lesson plan chapter', async () => {
    const user = userEvent.setup();
    renderPortal('/teacher/classes/5-a/assignments/manage');

    await user.click(await screen.findByRole('button', { name: /Assignment Text or PDF work/i }));
    await user.selectOptions(screen.getByLabelText(/Class & Section/i), 'class1-section1');
    await user.selectOptions(screen.getByLabelText(/Subject/i), 'Mathematics');

    expect(screen.getByLabelText('Lesson Plan')).toHaveTextContent('Fractions Learning Plan');
    await user.selectOptions(screen.getByLabelText('Lesson Plan'), 'lessonplan1');
    expect(screen.getByLabelText(/Chapter/i)).toHaveTextContent('Fractions');
    await user.selectOptions(screen.getByLabelText(/Chapter/i), 'fractions-chapter');

    expect(screen.getByLabelText('Lesson Plan')).toHaveValue('lessonplan1');
    expect(screen.getByLabelText(/Chapter/i)).toHaveValue('fractions-chapter');
  });

  test('generates an editable assignment draft from the selected lesson material', async () => {
    const user = userEvent.setup();
    axios.post.mockImplementation((url) => {
      if (url.includes('/api/ai-teacher/assignment-draft')) {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              groundedInMaterial: true,
              draft: {
                title: 'AI Fractions Challenge',
                description: '1. Compare the equivalent fractions.\n2. Explain your reasoning.',
                marks: 25,
                difficulty: 'Medium',
                type: 'Assignment',
                submissionFormat: 'text',
                isEssay: false,
                rubric: '',
              },
            },
          },
        });
      }
      return Promise.resolve({ data: { publishedCount: 1 } });
    });
    renderPortal('/teacher/classes/current/assignments/manage');

    await user.click(await screen.findByRole('button', { name: /AI Generate/i }));
    await user.selectOptions(screen.getByLabelText(/Class & Section/i), 'class1-section1');
    await user.selectOptions(screen.getByLabelText(/Subject/i), 'Mathematics');
    await user.selectOptions(screen.getByLabelText('Lesson Plan'), 'lessonplan1');
    await user.selectOptions(screen.getByLabelText(/Chapter/i), 'fractions-chapter');
    await user.click(screen.getByRole('button', { name: /Generate draft/i }));

    expect(await screen.findByDisplayValue('AI Fractions Challenge')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Compare the equivalent fractions/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/generated from indexed class material/i);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai-teacher/assignment-draft'),
      expect.objectContaining({
        classId: 'class1',
        sectionId: 'section1',
        subjectId: 'subject1',
        subject: 'Mathematics',
        topic: 'Fractions',
        chapterTitle: 'Fractions',
      }),
      expect.objectContaining({ headers: { Authorization: 'Bearer teacher-token' } })
    );
  });

  test('publishes a saved draft to students through the dedicated endpoint', async () => {
    const user = userEvent.setup();
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/academic/active-year')) {
        return Promise.resolve({ data: { _id: 'year-1', name: '2026-27' } });
      }
      if (url.includes('/teacher/my-classes')) return Promise.resolve({ data: [assignedClass] });
      if (url.includes('/teacher/my-assignments')) return Promise.resolve({ data: [draftAssignment] });
      if (url.includes('/teacher/submissions')) return Promise.resolve({ data: [submission] });
      if (url.includes('/tryout-submissions')) return Promise.resolve({ data: { results: [] } });
      if (url.includes('/api/lesson-plans/teacher/my')) return Promise.resolve({ data: [publishedLessonPlan] });
      return Promise.resolve({ data: [] });
    });
    axios.patch.mockResolvedValue({
      data: {
        assignment: { ...draftAssignment, status: 'active', publishedForStudentPortal: true },
      },
    });
    renderPortal('/teacher/classes/current/assignments/manage');

    await user.click(await screen.findByRole('button', { name: /^Publish$/i }));

    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringContaining('/api/assignment/teacher/publish/assignment-draft-1'),
      {},
      expect.objectContaining({ headers: { Authorization: 'Bearer teacher-token' } })
    );
    expect(await screen.findByText(/is now published to students/i)).toBeInTheDocument();
  });

  test('publishes a saved result through the real API', async () => {
    const user = userEvent.setup();
    renderPortal('/teacher/classes/current/assignments/evaluate');

    await user.click(await screen.findByRole('button', { name: /^Review$/i }));
    await user.click(screen.getByRole('button', { name: /Publish Result/i }));

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/assignment/teacher/publish-grades'),
      { assignmentId: 'assignment-1', studentIds: ['student-1'] },
      expect.objectContaining({ headers: { Authorization: 'Bearer teacher-token' } })
    );
    expect(await screen.findByText(/now visible to the student/i)).toBeInTheDocument();
  });
});

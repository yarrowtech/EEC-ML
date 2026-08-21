import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PracticeQuestions from '../PracticeQuestions';

const allocation = {
  _id: 'allocation-1',
  academicYearId: { _id: 'year-1', name: '2026-27' },
  classId: { _id: 'class-1', name: '5' },
  sectionId: { _id: 'section-1', name: 'A' },
  subjectId: { _id: 'subject-1', name: 'Mathematics' },
};

const jsonResponse = (data, ok = true) => Promise.resolve({
  ok,
  json: async () => data,
});

describe('PracticeQuestions AI generation', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'teacher-token');
    global.fetch = jest.fn((url, options = {}) => {
      if (String(url).includes('/api/teacher/dashboard/allocations')) {
        return jsonResponse([allocation]);
      }
      if (String(url).includes('/api/practice/teacher/questions')) {
        return jsonResponse({ questions: [] });
      }
      if (String(url).includes('/api/ai-teacher/quiz-generate') && options.method === 'POST') {
        return jsonResponse({
          success: true,
          data: {
            groundedInMaterial: true,
            questions: [{
              questionText: 'Which number is the sum of two and two?',
              options: [
                { text: '3', isCorrect: false },
                { text: '4', isCorrect: true },
                { text: '5', isCorrect: false },
                { text: '6', isCorrect: false },
              ],
              correctAnswer: '4',
              explanation: 'Two plus two equals four.',
            }],
          },
        });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    localStorage.clear();
    delete global.fetch;
  });

  test('fills the question, all options, correct answer, and explanation fields', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticeQuestions initialType="mcq" /></MemoryRouter>);

    await screen.findByRole('option', { name: '5 - A • Mathematics' });
    await user.selectOptions(screen.getByLabelText('Class & Subject'), 'allocation-1');
    await user.click(screen.getByRole('button', { name: /AI Generate/i }));

    expect(await screen.findByLabelText('Question')).toHaveValue('Which number is the sum of two and two?');
    expect(screen.getByLabelText('Option A')).toHaveValue('3');
    expect(screen.getByLabelText('Option B')).toHaveValue('4');
    expect(screen.getByLabelText('Option C')).toHaveValue('5');
    expect(screen.getByLabelText('Option D')).toHaveValue('6');
    expect(screen.getByLabelText('Correct Answer')).toHaveValue('4');
    expect(screen.getByLabelText('Explanation (optional)')).toHaveValue('Two plus two equals four.');

    const aiCall = global.fetch.mock.calls.find(([url]) => String(url).includes('/api/ai-teacher/quiz-generate'));
    expect(JSON.parse(aiCall[1].body)).toEqual(expect.objectContaining({
      questionType: 'mcq',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      academicYearId: 'year-1',
    }));
  });
});

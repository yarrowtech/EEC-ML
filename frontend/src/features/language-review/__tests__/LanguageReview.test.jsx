import { render, screen } from '@testing-library/react';
import ReadingScoreCard from '../../../components/ReadingScoreCard';
import WritingScoreCard from '../../../components/WritingScoreCard';
import { AssessmentDetailModal } from '../../../teachers/LanguagePracticeManager';
jest.mock('../../../components/LanguageRadarChart', () => () => <div>Score chart</div>);
const assessment = { status: 'completed', createdAt: '2026-10-06', studentId: { name: 'Ada' }, scores: { overall: 80 }, strengths: ['Clear structure'], suggestions: ['Check tense'], corrections: [{ original: 'I go yesterday', corrected: 'I went yesterday', type: 'verb_tense', explanation: 'Use past tense.' }], rawEvaluation: { needsReview: true } };
test('teacher and student writing reports share corrections, suggestions and review flags', () => {
  const { unmount } = render(<WritingScoreCard assessment={assessment} />);
  expect(screen.getByText('Use past tense.')).toBeInTheDocument();
  expect(screen.getByText('This result needs teacher review.')).toBeInTheDocument();
  unmount();
  render(<AssessmentDetailModal assessment={assessment} mode="writing" onClose={() => {}} />);
  expect(screen.getByRole('dialog')).toHaveTextContent('Ada');
  expect(screen.getByText('Use past tense.')).toBeInTheDocument();
  expect(screen.getByText(/Clear structure/)).toBeInTheDocument();
});
test('reading explains speed units and failed evaluation is not shown as a zero grade', () => {
  const { rerender } = render(<ReadingScoreCard assessment={assessment} />);
  expect(screen.getByText(/words per minute/)).toBeInTheDocument();
  rerender(<ReadingScoreCard assessment={{ status: 'failed', scores: {} }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Scores are not available yet');
  expect(screen.queryByText('/ 100')).not.toBeInTheDocument();
});

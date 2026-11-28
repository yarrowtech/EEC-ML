import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentExamsView from '../StudentExamsView';
import { fetchCachedJson } from '../../utils/studentApiCache';
import { generateExamSchedulePdf } from '../../utils/examRoutinePdf';

jest.mock('../../utils/studentApiCache', () => ({ fetchCachedJson: jest.fn() }));
jest.mock('../../utils/examRoutinePdf', () => ({
  generateExamSchedulePdf: jest.fn().mockResolvedValue(),
  buildFullVenueLabel: (exam) => exam.venue || '—',
}));

const annual = {
  _id: 'annual', title: 'Annual Exams', status: 'completed',
  subjects: Array.from({ length: 6 }, (_, i) => ({
    _id: `exam-${i}`, subject: i === 5 ? 'Computer' : `Subject ${i + 1}`, venue: 'Lab 2',
  })),
};
const unit = { _id: 'unit', title: 'Unit Test', status: 'scheduled', subjects: [] };

function renderExams() {
  return render(<MemoryRouter><StudentExamsView /></MemoryRouter>);
}

beforeEach(() => {
  localStorage.setItem('token', 'student-token');
  fetchCachedJson.mockResolvedValue({ data: [annual, unit] });
});

afterEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

test('shows the selected exam beside the desktop list and keeps the full routine available', async () => {
  renderExams();
  const rail = within(await screen.findByRole('complementary', { name: 'Exam schedules' }));
  // upcoming exams are listed first, so pick the completed one
  fireEvent.click(rail.getByRole('button', { name: /Annual Exams/ }));
  const schedule = within(screen.getByRole('article'));
  expect(schedule.getByRole('rowheader', { name: 'Computer' })).toBeInTheDocument();
  expect(schedule.getByRole('link', { name: 'View results' })).toHaveAttribute('href', '/student/results');
  fireEvent.click(schedule.getByRole('button', { name: 'Download routine' }));
  expect(generateExamSchedulePdf).toHaveBeenCalledWith(annual, expect.any(Object));
  fireEvent.click(rail.getByRole('button', { name: /Unit Test/ }));
  expect(screen.getByText(/subject schedule will appear/)).toBeInTheDocument();
});

test('opens one schedule from the tablet cards and returns to the list', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn(() => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  try {
    renderExams();
    const card = await screen.findByRole('button', { name: /Annual Exams/ });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    fireEvent.click(card);
    expect(within(screen.getByRole('article')).getByRole('heading', { name: 'Annual Exams' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All exams' }));
    expect(screen.getByRole('button', { name: /Unit Test/ })).toBeInTheDocument();
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

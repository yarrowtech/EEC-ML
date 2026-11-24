import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultsView from '../ResultsView';
import { downloadSingleReportCardPdf } from '../../utils/reportCardPdf';

jest.mock('../../utils/reportCardPdf', () => ({
  downloadSingleReportCardPdf: jest.fn(),
}));

const jsonResponse = (payload) => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(payload),
});

describe('student published results', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    localStorage.setItem('userType', 'Student');
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/api/student/auth/results')) {
        return jsonResponse({
          results: [{
            _id: 'submission-1',
            examName: 'Fractions homework',
            subject: 'Mathematics',
            date: '2026-08-20T00:00:00.000Z',
            resultType: 'assignment',
            obtainedMarks: 18,
            totalMarks: 20,
            percentage: 90,
            grade: 'A+',
            status: 'pass',
            remarks: 'Clear working and explanation.',
          }],
        });
      }
      if (String(url).includes('/api/reports/report-cards/me')) {
        return jsonResponse({ template: null, reportCard: null });
      }
      return jsonResponse({ data: [] });
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('shows marks and teacher feedback released for an assignment', async () => {
    render(
      <MemoryRouter initialEntries={['/student/results']}>
        <ResultsView />
      </MemoryRouter>
    );

    expect(await screen.findByText('Published Assignment Results')).toBeInTheDocument();
    expect(screen.getByText('Fractions homework')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('/ 20 marks')).toBeInTheDocument();
    expect(screen.getByText('Clear working and explanation.')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/student/auth/results'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer student-token' }),
        })
      );
    });
  });

  test('shows a published exam summary and subject marks in the same card', async () => {
    const fetchAssignmentAndReportCard = global.fetch.getMockImplementation();
    global.fetch.mockImplementation((url) => String(url).includes('/api/exam/results/me')
      ? jsonResponse({ academicContext: { activeSession: '2026-2027', className: '5' }, data: [{
        _id: 'result-1',
        examId: { _id: 'exam-1', groupId: 'group-1', term: 'Final', subject: 'Computer', marks: 100, date: '2026-11-18T12:00:00Z' },
        examGroupSchedule: { startDate: '2026-11-16', endDate: '2026-11-20' },
        marks: 100,
        grade: 'A+',
        published: true,
      }, {
        _id: 'result-2',
        examId: { _id: 'exam-2', term: 'Annual', subject: 'English', marks: 100, date: '2026-03-12T12:00:00Z' },
        examSession: '2025-2026',
        examClassName: '4',
        marks: 80,
        published: true,
      }] })
      : fetchAssignmentAndReportCard(url));

    render(
      <MemoryRouter initialEntries={['/student/results']}>
        <ResultsView />
      </MemoryRouter>
    );

    const card = within(await screen.findByRole('article'));
    expect(card.getByRole('heading', { name: 'Final' })).toBeInTheDocument();
    expect(card.getByText('2026-2027', { exact: false })).toBeInTheDocument();
    expect(card.getByText('16/11/2026 → 20/11/2026')).toBeInTheDocument();
    expect(card.getByText('Pass')).toBeInTheDocument();
    expect(card.getByRole('img', { name: 'Score: 100%' })).toBeInTheDocument();
    const subjects = within(card.getByRole('table'));
    expect(subjects.getByRole('rowheader', { name: 'Computer' })).toBeInTheDocument();
    expect(subjects.getByRole('cell', { name: '100/100' })).toBeInTheDocument();
    expect(subjects.getByRole('cell', { name: 'A+' })).toBeInTheDocument();

    fireEvent.click(card.getByRole('button', { name: 'Download', exact: true }));
    await waitFor(() => expect(downloadSingleReportCardPdf).toHaveBeenCalledWith(expect.objectContaining({
      reportCard: expect.objectContaining({ term: 'Final' }),
    })));

    expect(screen.queryByRole('button', { name: /Annual/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Session 2026-2027 · Class 5'));
    const active = screen.getByLabelText('2026-2027 · Class 5');
    const previous = screen.getByLabelText('2025-2026 · Class 4');
    expect(active).toBeChecked();
    expect(previous).not.toBeChecked();
    fireEvent.click(previous);
    expect(screen.getByText('2 sessions selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annual/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/exam/results/me?refresh=true'),
      expect.objectContaining({ cache: 'no-store' })
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh results' })).toBeEnabled());
    expect(screen.getByText('2 sessions selected')).toBeInTheDocument();
  });
});

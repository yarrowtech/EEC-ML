import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultsView from '../ResultsView';

jest.mock('../../utils/reportCardPdf', () => ({
  downloadSingleReportCardPdf: jest.fn(),
}));
jest.mock('../PostExamFeedbackView', () => () => null);

const jsonResponse = (payload) => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(payload),
});

describe('student published assignment results', () => {
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
    expect(screen.getByText('90%')).toBeInTheDocument();
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
});

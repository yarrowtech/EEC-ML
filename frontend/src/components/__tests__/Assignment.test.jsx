import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Assignment from '../Assignment';
import { fetchCachedJson, clearStudentApiCacheByUrl } from '../../utils/studentApiCache';

jest.mock('axios');
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../utils/studentApiCache', () => ({
  fetchCachedJson: jest.fn(),
  clearStudentApiCacheByUrl: jest.fn(),
}));
jest.mock('../WorksheetSubmitModal', () => () => null);
jest.mock('../assignmentLabModelUrl', () => ({ labModelUrl: (file) => file }));
jest.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({ GLTFLoader: jest.fn() }));
jest.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({ DRACOLoader: jest.fn() }));
jest.mock('three/examples/jsm/controls/OrbitControls.js', () => ({ OrbitControls: jest.fn() }));

const baseAssignment = {
  _id: 'assignment-1',
  title: 'Fractions homework',
  subject: 'Mathematics',
  description: 'Explain how equivalent fractions work.',
  dueDate: '2026-09-30T00:00:00.000Z',
  marks: 20,
  status: 'active',
  submissionStatus: 'not_submitted',
  teacherId: { name: 'Teacher One' },
  attachments: [],
};

const renderAssignment = () => render(
  <MemoryRouter initialEntries={['/student/assignments']}>
    <Assignment assignmentType="school" filter="all" setFilter={jest.fn()} />
  </MemoryRouter>
);

describe('student school assignment workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'student-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('loads a teacher assignment and submits a written answer', async () => {
    const user = userEvent.setup();
    fetchCachedJson.mockResolvedValue({
      data: [{ ...baseAssignment, submissionFormat: 'text' }],
    });
    axios.post.mockResolvedValue({
      data: {
        status: 'submitted',
        submittedAt: '2026-08-21T10:00:00.000Z',
        submissionText: 'Equivalent fractions have the same value.',
      },
    });

    renderAssignment();

    await user.click(await screen.findByText('Fractions homework'));
    const answer = screen.getByPlaceholderText(/write your answer/i);
    await user.type(answer, 'Equivalent fractions have the same value.');
    await user.click(screen.getByRole('button', { name: /submit assignment/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/assignment/submit'),
        {
          assignmentId: 'assignment-1',
          submissionText: 'Equivalent fractions have the same value.',
          attachmentUrl: undefined,
        },
        { headers: { Authorization: 'Bearer student-token' } }
      );
    });
    expect(clearStudentApiCacheByUrl).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  test('uploads a PDF and submits its returned URL', async () => {
    const user = userEvent.setup();
    fetchCachedJson.mockResolvedValue({
      data: [{ ...baseAssignment, _id: 'assignment-pdf', title: 'PDF worksheet', submissionFormat: 'pdf' }],
    });
    axios.post
      .mockResolvedValueOnce({
        data: {
          files: [{
            originalName: 'answer.pdf',
            secure_url: 'https://files.example.test/answer.pdf',
          }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'submitted',
          submittedAt: '2026-08-21T10:00:00.000Z',
          attachmentUrl: 'https://files.example.test/answer.pdf',
        },
      });

    renderAssignment();

    await user.click(await screen.findByText('PDF worksheet'));
    const file = new File(['pdf-data'], 'answer.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText(/select pdf/i), file);
    await screen.findByText('answer.pdf');
    await user.click(screen.getByRole('button', { name: /submit assignment/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/assignment/submit'),
        {
          assignmentId: 'assignment-pdf',
          submissionText: '',
          attachmentUrl: 'https://files.example.test/answer.pdf',
        },
        { headers: { Authorization: 'Bearer student-token' } }
      );
    });
  });
});

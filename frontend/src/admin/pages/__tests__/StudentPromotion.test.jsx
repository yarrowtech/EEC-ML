import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentPromotion from '../StudentPromotion';
import Swal from 'sweetalert2';

jest.mock('sweetalert2', () => ({
  fire: jest.fn((config) => {
    if (config?.title === 'Confirm Promotion') {
      return Promise.resolve({ isConfirmed: true });
    }
    return Promise.resolve({});
  }),
}));

const metaClasses = [
  { _id: 'class-5', name: 'Class 5', order: 5 },
  { _id: 'class-6', name: 'Class 6', order: 6 },
];

const metaYears = [
  { _id: 'year-1', name: '2023-24', isActive: false },
  { _id: 'year-2', name: '2024-25', isActive: true },
];

const metaStudents = [
  { _id: 'all-1', grade: 'Class 5', status: 'Active' },
  { _id: 'all-2', grade: 'Class 5', status: 'Active' },
  { _id: 'all-3', grade: 'Class 6', status: 'Left' },
];

const previewStudents = [
  {
    _id: 'prev-1',
    name: 'Student One',
    grade: 'Class 5',
    section: 'A',
    roll: 17,
    academicYear: '2024-25',
    studentCode: 'STU-1',
  },
];

const marksPreviewResponse = {
  students: [
    {
      _id: 'mark-1',
      name: 'Mark Eligible',
      grade: 'Class 5',
      section: 'A',
      academicYear: '2024-25',
      marksSummary: { percentage: 82, eligible: true },
    },
    {
      _id: 'mark-2',
      name: 'Mark Skip',
      grade: 'Class 5',
      section: 'B',
      academicYear: '2024-25',
      marksSummary: { percentage: 45, eligible: false },
    },
  ],
  eligibleIds: ['mark-1'],
  minPercentage: 60,
};

const sections = [{ _id: 'sec-a', name: 'A' }];

const jsonResponse = (payload, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(payload),
  });

const setupFetchMock = (overrides = {}) => {
  global.fetch = jest.fn((url, options = {}) => {
    const overrideKey = Object.keys(overrides).find((key) => url.includes(key));
    if (overrideKey) {
      return overrides[overrideKey](url, options);
    }
    if (url.includes('/api/academic/classes')) {
      return jsonResponse(metaClasses);
    }
    if (url.includes('/api/academic/years')) {
      return jsonResponse(metaYears);
    }
    if (url.includes('/api/admin/users/get-students')) {
      return jsonResponse(metaStudents);
    }
    if (url.includes('/api/academic/sections')) {
      return jsonResponse(sections);
    }
    if (url.includes('/api/promotion/history')) {
      return jsonResponse({ history: [] });
    }
    throw new Error(`Unhandled request for ${url}`);
  });
};

describe('StudentPromotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads metadata and pre-selects the active academic year', async () => {
    setupFetchMock();
    const setHeader = jest.fn();
    render(<MemoryRouter><StudentPromotion setShowAdminHeader={setHeader} /></MemoryRouter>);

    await screen.findByRole('option', { name: /Class 5 \(2 students\)/i });
    expect(setHeader).toHaveBeenCalledWith(true);

    const comboboxes = await screen.findAllByRole('combobox');
    const fromAcademicYearSelect = comboboxes[2];
    await waitFor(() => expect(fromAcademicYearSelect).toHaveValue('2024-25'));
  });

  test('previews students and auto-selects them in bulk mode', async () => {
    setupFetchMock({
      '/api/promotion/preview': () => jsonResponse({ students: previewStudents }),
    });
    const user = userEvent.setup();
    const setHeader = jest.fn();
    render(<MemoryRouter><StudentPromotion setShowAdminHeader={setHeader} /></MemoryRouter>);

    await screen.findAllByRole('option', { name: /Class 5/ });
    const comboboxes = screen.getAllByRole('combobox');
    await user.selectOptions(comboboxes[0], 'class-5');
    await user.click(screen.getByText('Preview Students'));

    await screen.findByText('Student One');
    const previewCall = global.fetch.mock.calls.find(([url]) =>
      url.includes('/api/promotion/preview')
    );
    expect(previewCall?.[1]?.method).toBe('POST');
    expect(JSON.parse(previewCall?.[1]?.body)).toMatchObject({
      fromClass: 'Class 5',
      fromAcademicYear: '2024-25',
    });
    expect(screen.getByText('Promote All (1)')).toBeInTheDocument();
  });

  test('executes marks-based promotion after confirmation', async () => {
    setupFetchMock({
      '/api/promotion/preview-marks': () => jsonResponse(marksPreviewResponse),
      '/api/promotion/execute': () => jsonResponse({ message: 'Promoted' }),
    });
    const user = userEvent.setup();
    const setHeader = jest.fn();
    render(<MemoryRouter><StudentPromotion setShowAdminHeader={setHeader} /></MemoryRouter>);

    await screen.findAllByRole('option', { name: /Class 5/ });
    const comboboxes = screen.getAllByRole('combobox');
    await user.selectOptions(comboboxes[0], 'class-5');
    await user.selectOptions(comboboxes[3], 'class-6');

    await user.click(screen.getByText('Marks Based'));
    const minPercentageInput = screen.getByDisplayValue('50');
    await user.clear(minPercentageInput);
    await user.type(minPercentageInput, '75');

    await user.click(screen.getByText('Preview Students'));
    await screen.findByText('Mark Eligible');
    expect(screen.getByText('Promote Eligible (1)')).toBeInTheDocument();

    await user.click(screen.getByText('Promote Eligible (1)'));
    await waitFor(() =>
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Confirm Promotion' }))
    );

    await waitFor(() => {
      const executeCall = global.fetch.mock.calls.find(([url]) =>
        url.includes('/api/promotion/execute')
      );
      expect(executeCall).toBeDefined();
      expect(JSON.parse(executeCall[1].body)).toMatchObject({
        type: 'marks',
        marksConfig: { minPercentage: 75 },
        studentIds: ['mark-1'],
        toClass: 'Class 6',
      });
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentHealthReport from '../StudentHealthReport';
import StudentComplaints from '../StudentComplaints';
import StudentMeetings from '../StudentMeetings';
import StudentWellbeing from '../StudentWellbeing';

const response = (payload, ok = true) => Promise.resolve({
  ok,
  json: () => Promise.resolve(payload),
});

describe('student family-service parity', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('shows the real student health profile and shared observation', async () => {
    global.fetch = jest.fn(() => response({
      profile: {
        bloodGroup: 'O+',
        allergies: 'Peanuts',
        knownHealthIssues: 'Asthma',
        immunizationStatus: 'Up to date',
      },
      observations: [{
        id: 'observation-1',
        recordedAt: '2026-08-20T00:00:00.000Z',
        teacherName: 'Teacher One',
        healthObservations: { energy: 'Good' },
        additionalNotes: 'Participated normally.',
        followUpRequired: false,
      }],
    }));

    render(<StudentHealthReport />);

    expect(await screen.findByText('O+')).toBeInTheDocument();
    expect(screen.getByText('Peanuts')).toBeInTheDocument();
    expect(screen.getByText('Teacher One')).toBeInTheDocument();
    expect(screen.getByText('energy: Good')).toBeInTheDocument();
  });

  test('lets a student submit and track a complaint', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn()
      .mockImplementationOnce(() => response({ complaints: [] }))
      .mockImplementationOnce(() => response({
        id: 'ticket-1',
        ticketNumber: 'STU-100',
        title: 'Need help with homework',
        description: 'The assignment instructions are unclear.',
        owner: 'Teacher One',
        status: 'open',
      }));

    render(<StudentComplaints />);
    await screen.findByText('No complaints submitted.');
    await user.type(screen.getByLabelText('Complaint title'), 'Need help with homework');
    await user.type(screen.getByLabelText('Complaint description'), 'The assignment instructions are unclear.');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('STU-100 · Assigned to Teacher One')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/student/auth/complaints'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('shows a scheduled video meeting and its join link', async () => {
    global.fetch = jest.fn(() => response([{
      _id: 'meeting-1',
      title: 'Term progress review',
      topic: 'Mathematics progress',
      meetingDate: '2026-09-02T00:00:00.000Z',
      meetingTime: '10:30',
      meetingType: 'Video Call',
      meetingLink: 'https://meet.example.test/room',
      status: 'confirmed',
      teacherId: { name: 'Teacher One' },
    }]));

    render(<StudentMeetings />);

    expect(await screen.findByText('Term progress review')).toBeInTheDocument();
    expect(screen.getByText('With Teacher One')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /join meeting/i })).toHaveAttribute(
      'href',
      'https://meet.example.test/room'
    );
  });

  test('shows the latest school wellbeing assessment instead of placeholder data', async () => {
    global.fetch = jest.fn(() => response({
      assessment: {
        mood: 'good',
        academicStress: 4,
        socialEngagement: 8,
        notes: 'Settling into the new term well.',
        counselingSessions: 1,
        interventions: [],
        behaviorChanges: false,
        lastAssessment: '2026-08-20T00:00:00.000Z',
      },
    }));

    render(<StudentWellbeing />);

    expect(await screen.findByText('Good')).toBeInTheDocument();
    expect(screen.getByText('4/10')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('Settling into the new term well.')).toBeInTheDocument();
  });
});

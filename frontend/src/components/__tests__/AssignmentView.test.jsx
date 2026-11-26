import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AssignmentView from '../AssignmentView';
import Assignment from '../Assignment';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock('../Assignment', () => {
  const React = require('react');
  return jest.fn((props) =>
    React.createElement('div', { 'data-testid': 'assignment-mock' }, props.assignmentType)
  );
});

jest.mock('../Tryout', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'tryout-mock' });
});

jest.mock('../PointsBadge', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'points-badge' });
});

const setup = (defaultType = 'school', initialPath = '/student/assignments') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AssignmentView defaultType={defaultType} />
    </MemoryRouter>
  );
};

const createLocalStorage = (initialData = {}) => {
  const store = { ...initialData };
  return {
    getItem: jest.fn((key) => (key in store ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
  };
};

describe('AssignmentView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    const storage = createLocalStorage();
    global.localStorage = storage;
    window.localStorage = storage;
  });

  test('renders the supported assignment tabs and switches to practice', async () => {
    const user = userEvent.setup();
    setup();

    expect(await screen.findByTestId('assignment-mock')).toHaveTextContent('school');

    await user.click(screen.getByRole('button', { name: /Practice/i }));
    expect(screen.getByTestId('assignment-mock')).toHaveTextContent('eec');

    expect(Assignment).toHaveBeenLastCalledWith(
      expect.objectContaining({ assignmentType: 'eec' }),
      {}
    );
  });

  test('does not expose retired assignment tabs', async () => {
    setup();

    expect(screen.queryByRole('button', { name: /Tryout/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lab/i })).not.toBeInTheDocument();
  });

  test('renders journal layout when default type is journal', async () => {
    setup('journal');

    expect(await screen.findByRole('heading', { name: 'My Diary' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Write your diary page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New page/ })).toBeInTheDocument();
    expect(screen.queryByText(/Assignments/i)).not.toBeInTheDocument();
  });

  test('diary index lists every session month up to now, with only the days written on', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-26T10:00:00'), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    localStorage.setItem('token', 't');
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        session: { name: '2026-27', startDate: '2026-09-01T00:00:00.000Z' },
        entries: [
          { _id: 'a', title: 'Hi', content: 'testing', createdAt: '2026-09-11T09:00:00' },
          { _id: 'b', title: 'Hi again', content: 'again', createdAt: '2026-09-11T15:00:00' },
          { _id: 'c', title: 'Computer fundamentals', content: 'What is a computer?', createdAt: '2026-09-19T09:00:00' },
        ],
      }),
    }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    setup('journal');

    await screen.findByRole('button', { name: /November 2026/ });
    const labels = screen.getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-expanded') && /\d{4}/.test(b.textContent))
      .map((b) => b.textContent);
    // Sep → Nov, all present (newest first), even months with no pages.
    expect(labels.join('|')).toMatch(/November 2026/);
    expect(labels.join('|')).toMatch(/October 2026/);
    expect(labels.join('|')).toMatch(/September 2026/);
    expect(labels.find((l) => /October/.test(l))).toMatch(/No pages/);

    // Open September: two days (19th and 11th), the 11th holding both entries.
    await user.click(screen.getByRole('button', { name: /September 2026/ }));
    expect(screen.getByText('Computer fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('Hi again')).toBeInTheDocument();
    expect(screen.getAllByText('11')).toHaveLength(2); // each page on the 11th gets its own day card
    expect(screen.queryByText('12')).not.toBeInTheDocument(); // days without pages aren't listed
    jest.useRealTimers();
  });
});

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

    expect(await screen.findByText(/My Learning Journal/i)).toBeInTheDocument();
    expect(screen.queryByText(/Assignments/i)).not.toBeInTheDocument();
  });
});

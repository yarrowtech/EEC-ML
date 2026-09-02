/* global beforeEach, describe, expect, global, it, jest */
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';

import AcademicReport from '../AcademicReport';
import AchievementsView from '../AchievementsView';
import AttendanceReport from '../AttendanceReport';
import ExcuseLetters from '../ExcuseLetters';
import HolidayList from '../HolidayList';
import ClassRoutine from '../ClassRoutine';
import ComplaintManagementSystem from '../ComplaintManagementSystem';
import HealthReport from '../HealthReport';
import ParentObservationNonAcademic from '../ParentObservationNonAcademic';
import PTMPortal from '../PTMPortal';
import ParentDashboard from '../ParentDashboard';
import ChildGrowthAnalytics from '../ChildGrowthAnalytics';
import ParentChat from '../ParentChat';
import FeesPayment from '../FeesPayment';
import ParentPortal from '../ParentPortal';

jest.mock('socket.io-client', () => ({
  io: () => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

expect.extend(toHaveNoViolations);

// jsdom has no matchMedia (framer-motion's useReducedMotion needs it).
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  });
}

// Every parent screen goes through fetch / parentApiFetch. Return an empty but
// well-shaped payload for anything so each screen renders its loaded state.
const emptyPayload = {
  reportCards: [], children: [], data: [], holidays: [], complaints: [],
  observations: [], parentEntries: [], stats: {}, meetings: [],
  template: null, routine: {}, school: {},
};

beforeEach(() => {
  global.localStorage.setItem('token', 'test-token');
  global.localStorage.setItem('userType', 'Parent');
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: async () => emptyPayload,
    text: async () => JSON.stringify(emptyPayload),
  }));
});

const SCREENS = {
  AcademicReport,
  AchievementsView,
  AttendanceReport,
  ExcuseLetters,
  HolidayList,
  ClassRoutine,
  ComplaintManagementSystem,
  HealthReport,
  ParentObservationNonAcademic,
  PTMPortal,
  ParentDashboard,
  ChildGrowthAnalytics,
  ParentChat,
  FeesPayment,
  ParentPortal,
};

describe('Parent portal accessibility (axe)', () => {
  it.each(Object.keys(SCREENS))('%s has no detectable axe violations', async (name) => {
    const Screen = SCREENS[name];
    const { container } = render(<Screen />, { wrapper: MemoryRouter });

    // Let the initial data load settle so axe inspects the loaded UI.
    await waitFor(() => {
      expect(screen.queryByText(/loading|fetching/i)).not.toBeInTheDocument();
    }, { timeout: 3000 }).catch(() => {});
    // Flush any trailing effects triggered by the loaded state.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const results = await axe(container, {
      rules: {
        // jsdom cannot compute layout, so contrast is verified in the browser QA pass.
        'color-contrast': { enabled: false },
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});

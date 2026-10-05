import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ParentAiConsent from '../ParentAiConsent';
import { parentApiJson } from '../../../parents/parentApi';
jest.mock('../../../parents/parentApi', () => ({ parentApiJson: jest.fn() }));
beforeEach(() => jest.resetAllMocks());
test('loads status and persists explicit withdrawal', async () => {
  parentApiJson.mockResolvedValueOnce({ data: { allowed: true } }).mockResolvedValueOnce({ data: { allowed: false, reason: 'consent_withdrawn' } });
  render(<ParentAiConsent studentId="child-1" childName="Ada" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw AI personalisation' }));
  await screen.findByRole('button', { name: 'Allow AI personalisation' });
  expect(parentApiJson).toHaveBeenLastCalledWith('/api/ai-consent/parent/child-1', { method: 'PUT', body: JSON.stringify({ granted: false }) });
  expect(screen.getByText(/Future personalised requests are blocked/)).toBeInTheDocument();
});
test('failed save preserves known status and shows the error', async () => {
  parentApiJson.mockResolvedValueOnce({ data: { allowed: false } }).mockRejectedValueOnce(new Error('Unable to save'));
  render(<ParentAiConsent studentId="child-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Allow AI personalisation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');
  expect(screen.getByText('Personalisation: Off')).toBeInTheDocument();
});
test('failed status cannot be mistaken for consent being off and can be retried', async () => {
  parentApiJson.mockRejectedValueOnce(new Error('Forbidden')).mockResolvedValueOnce({ data: { allowed: false } });
  render(<ParentAiConsent studentId="child-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry consent status' }));
  expect(await screen.findByRole('button', { name: 'Allow AI personalisation' })).toBeEnabled();
});
test('ignores previous-child responses after changing children', async () => {
  let completeFirst;
  parentApiJson.mockImplementationOnce(() => new Promise((resolve) => { completeFirst = resolve; }))
    .mockResolvedValueOnce({ data: { allowed: false } });
  const { rerender } = render(<ParentAiConsent studentId="first" />);
  rerender(<ParentAiConsent studentId="second" />);
  await screen.findByText('Personalisation: Off');
  completeFirst({ data: { allowed: true } });
  await waitFor(() => expect(screen.getByText('Personalisation: Off')).toBeInTheDocument());
});

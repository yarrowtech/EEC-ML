import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AiOperations from '../AiOperations';
jest.mock('../../../config/api', () => ({ API_BASE: '' }));
jest.mock('../../../admin/utils/adminScope', () => ({ getStoredAdminScope: () => ({ schoolId: 'school' }) }));
afterEach(() => { delete global.fetch; });
test('shows aggregate errors and latency and sends review filters', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [], summary: [{ _id: 'tutor_generate', total: 10, errors: 2, grounded: 7, needsReview: 3, avgLatencyMs: 1250 }] }) });
  render(<AiOperations />);
  expect(await screen.findByText('2 (20%)')).toBeInTheDocument();
  expect(screen.getByText('1250 ms')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Review needed'), { target: { value: 'true' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(global.fetch.mock.calls.at(-1)[0]).toContain('needsReview=true'));
  expect(global.fetch.mock.calls[0][1].headers['x-school-id']).toBe('school');
});
test('failed loads remain errors and retry can show a true empty state', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Forbidden' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], summary: [] }) });
  render(<AiOperations />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  expect(screen.queryByText('No interactions match these filters.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No interactions match these filters.');
});

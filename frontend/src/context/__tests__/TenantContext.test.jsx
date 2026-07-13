import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TenantProvider, useTenant } from '../TenantContext';

const TenantName = () => {
  const tenant = useTenant();
  return (
    <>
      <span>{tenant.name}</span>
      <button type="button" onClick={() => tenant.refreshBranding()}>Refresh branding</button>
    </>
  );
};

describe('TenantProvider browser branding', () => {
  beforeEach(() => {
    localStorage.clear();
    document.title = 'EEC';
    document.head.querySelectorAll("link[rel~='icon']").forEach((node) => node.remove());
  });

  test('uses the school name as the title and its logo as the favicon', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isMainDomain: false,
        organization: {
          id: 'org-1',
          name: "St. Xavier's School",
          logo: 'https://cdn.example.com/xaviers-logo.png',
          favicon: '',
        },
      }),
    });

    render(<TenantProvider><TenantName /></TenantProvider>);

    await waitFor(() => expect(screen.getByText("St. Xavier's School")).toBeInTheDocument());
    expect(document.title).toBe("St. Xavier's School");
    expect(document.querySelector("link[rel~='icon']").href).toBe('https://cdn.example.com/xaviers-logo.png');
  });

  test('keeps Electronic Educare branding on the main domain', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ isMainDomain: true, organization: null }),
    });

    render(<TenantProvider><TenantName /></TenantProvider>);

    await waitFor(() => expect(screen.getByText('Electronic Educare')).toBeInTheDocument());
    expect(document.title).toBe('Electronic Educare');
    expect(document.querySelector("link[rel~='icon']").getAttribute('href')).toBe('/logo_new.png');
  });

  test('reloads school branding when login completes on the main domain', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isMainDomain: true, organization: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          isMainDomain: false,
          organization: {
            id: 'org-2',
            name: 'Delhi Public School',
            logo: 'https://cdn.example.com/dps.png',
          },
        }),
      });

    render(<TenantProvider><TenantName /></TenantProvider>);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    localStorage.setItem('token', 'signed-school-token');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh branding' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Delhi Public School')).toBeInTheDocument());
    expect(global.fetch).toHaveBeenLastCalledWith('/api/tenant', expect.objectContaining({
      headers: { Authorization: 'Bearer signed-school-token' },
    }));
    expect(document.title).toBe('Delhi Public School');
    expect(document.querySelector("link[rel~='icon']").href).toBe('https://cdn.example.com/dps.png');
  });
});

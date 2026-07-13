jest.mock('../models/Organization', () => ({ findOne: jest.fn() }));
jest.mock('../utils/encryption', () => ({ decrypt: jest.fn((value) => `plain:${value}`) }));

const Organization = require('../models/Organization');
const paymentGatewayResolver = require('../middleware/paymentGatewayResolver');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe('paymentGatewayResolver tenant isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('resolves credentials from authenticated organization and ignores body organizationId', async () => {
    const organization = {
      _id: 'org-a',
      schoolId: 'school-a',
      paymentGateway: {
        enabled: true,
        provider: 'razorpay',
        mode: 'live',
        razorpay: { keyId: 'rzp_live_a', keySecret: 'encrypted-key', webhookSecret: 'encrypted-hook' },
      },
    };
    const select = jest.fn().mockResolvedValue(organization);
    Organization.findOne.mockReturnValue({ select });
    const req = { organizationId: 'org-a', schoolId: 'school-a', body: { organizationId: 'org-b' } };
    const res = response();
    const next = jest.fn();

    await paymentGatewayResolver(req, res, next);

    expect(Organization.findOne).toHaveBeenCalledWith({ _id: 'org-a' });
    expect(req.paymentGateway).toMatchObject({ organizationId: 'org-a', schoolId: 'school-a', keyId: 'rzp_live_a' });
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects a resolved organization that does not match the request tenant', async () => {
    Organization.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'org-b' }) });
    const req = { organizationId: 'org-a' };
    const res = response();
    const next = jest.fn();

    await paymentGatewayResolver(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(req.paymentGateway).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });
});

jest.mock('../models/Organization', () => ({
  findOne: jest.fn(),
}));

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const tenantResolver = require('../middleware/tenantResolver');

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('tenantResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ROOT_DOMAIN = 'electroniceducare.com';
  });

  test('bypasses the root domain', async () => {
    const req = { hostname: 'electroniceducare.com' };
    const next = jest.fn();
    await tenantResolver(req, response(), next);
    expect(next).toHaveBeenCalled();
    expect(req.isMainDomain).toBe(true);
    expect(Organization.findOne).not.toHaveBeenCalled();
  });

  test('resolves an active organization from the subdomain', async () => {
    const organization = { _id: new mongoose.Types.ObjectId(), slug: 'xaviers', status: 'active' };
    Organization.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(organization) });
    const req = { hostname: 'xaviers.electroniceducare.com' };
    const next = jest.fn();
    await tenantResolver(req, response(), next);
    expect(Organization.findOne).toHaveBeenCalledWith({ slug: 'xaviers', status: 'active' });
    expect(String(req.organizationId)).toBe(String(organization._id));
    expect(next).toHaveBeenCalled();
  });

  test('returns 404 for an unknown organization', async () => {
    Organization.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const res = response();
    await tenantResolver({ hostname: 'unknown.electroniceducare.com' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

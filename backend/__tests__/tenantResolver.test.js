jest.mock('../models/Organization', () => ({
  findOne: jest.fn(),
}));
jest.mock('../services/organizationProvisioningService', () => ({
  ensureOrganizationForSchool: jest.fn(),
}));

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Organization = require('../models/Organization');
const { ensureOrganizationForSchool } = require('../services/organizationProvisioningService');
const tenantResolver = require('../middleware/tenantResolver');

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('tenantResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ROOT_DOMAIN = 'electroniceducare.com';
    process.env.JWT_SECRET = 'tenant-resolver-test-secret';
  });

  test('bypasses the root domain', async () => {
    const req = { hostname: 'electroniceducare.com', headers: {} };
    const next = jest.fn();
    await tenantResolver(req, response(), next);
    expect(next).toHaveBeenCalled();
    expect(req.isMainDomain).toBe(true);
    expect(Organization.findOne).not.toHaveBeenCalled();
  });

  test('resolves a school organization from its signed token on the root domain', async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const organization = {
      _id: new mongoose.Types.ObjectId(),
      schoolId,
      status: 'active',
    };
    const token = jwt.sign({ schoolId }, process.env.JWT_SECRET);
    Organization.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(organization) });
    const req = {
      hostname: 'electroniceducare.com',
      headers: { authorization: `Bearer ${token}` },
    };
    const next = jest.fn();

    await tenantResolver(req, response(), next);

    expect(Organization.findOne).toHaveBeenCalledWith({ schoolId: String(schoolId), status: 'active' });
    expect(String(req.organizationId)).toBe(String(organization._id));
    expect(req.isMainDomain).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  test('automatically provisions a missing legacy school organization', async () => {
    const schoolId = new mongoose.Types.ObjectId();
    const organization = { _id: schoolId, schoolId, status: 'active' };
    const token = jwt.sign({ schoolId }, process.env.JWT_SECRET);
    Organization.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    ensureOrganizationForSchool.mockResolvedValue(organization);
    const req = {
      hostname: 'electroniceducare.com',
      headers: { authorization: `Bearer ${token}` },
    };
    const next = jest.fn();

    await tenantResolver(req, response(), next);

    expect(ensureOrganizationForSchool).toHaveBeenCalledWith({
      schoolId: String(schoolId),
      preferredOrganizationId: null,
    });
    expect(String(req.organizationId)).toBe(String(organization._id));
    expect(next).toHaveBeenCalled();
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

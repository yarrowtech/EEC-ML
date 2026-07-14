const BillingSetting = require('../models/BillingSetting');

const SETTINGS_KEY = 'global';
const TIER_KEYS = ['under500', 'midTier', 'over1000'];

/**
 * Resolve which pricing tier a student count belongs to.
 *   0..499 -> under500, 500..1000 -> midTier, 1001+ -> over1000
 */
const resolveTierKey = (studentCount = 0) => {
  const count = Number(studentCount) || 0;
  if (count <= 499) return 'under500';
  if (count <= 1000) return 'midTier';
  return 'over1000';
};

/** Fetch the singleton billing settings, creating defaults on first access. */
const getOrCreateBillingSetting = async () => {
  const setting = await BillingSetting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return setting;
};

const sanitizeBillingSetting = (setting) => ({
  currency: setting?.currency || 'INR',
  tiers: TIER_KEYS.reduce((acc, key) => {
    const tier = setting?.tiers?.[key] || {};
    acc[key] = {
      label: tier.label || key,
      pricePerStudent: Number(tier.pricePerStudent || 0),
    };
    return acc;
  }, {}),
  updatedAt: setting?.updatedAt || null,
});

/**
 * Compute the monthly bill for a school given its student count and the
 * current pricing settings. Returns tier key, unit price and total.
 */
const computeMonthlyBill = (studentCount, setting) => {
  const count = Number(studentCount) || 0;
  const tierKey = resolveTierKey(count);
  const pricePerStudent = Number(setting?.tiers?.[tierKey]?.pricePerStudent || 0);
  return {
    studentCount: count,
    tierKey,
    tierLabel: setting?.tiers?.[tierKey]?.label || tierKey,
    pricePerStudent,
    monthlyBill: Math.round(count * pricePerStudent * 100) / 100,
    currency: setting?.currency || 'INR',
  };
};

module.exports = {
  TIER_KEYS,
  resolveTierKey,
  getOrCreateBillingSetting,
  sanitizeBillingSetting,
  computeMonthlyBill,
};

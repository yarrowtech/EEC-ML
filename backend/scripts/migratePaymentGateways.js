require('dotenv').config();
const mongoose = require('../utils/registerTenantPlugin');
const Organization = require('../models/Organization');

const APPLY = process.argv.includes('--apply');

const migrate = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URL or MONGODB_URI is required');
  await mongoose.connect(mongoUri);
  const filter = { paymentGateway: { $exists: false } };
  const matched = await Organization.countDocuments(filter);
  let modified = 0;
  if (APPLY && matched) {
    const result = await Organization.updateMany(filter, {
      $set: {
        paymentGateway: {
          provider: 'razorpay',
          enabled: false,
          mode: 'test',
          razorpay: {},
        },
      },
    });
    modified = result.modifiedCount;
  }
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', matched, modified }, null, 2));
  if (!APPLY) console.log('No data was changed. Re-run with --apply after reviewing this output.');
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

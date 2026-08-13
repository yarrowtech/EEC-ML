// Moves the old single-slot paymentGateway.razorpay.{keyId,keySecret,...}
// shape into the new paymentGateway.razorpay.{test,live}.{keyId,keySecret,...}
// shape, placing the existing credentials under whichever mode they already
// represented (paymentGateway.mode). Uses the raw collection API (not the
// Mongoose model) so it works correctly regardless of whether the schema in
// code has already moved on to the new shape.
require('dotenv').config();
const mongoose = require('../utils/registerTenantPlugin');
const { decrypt } = require('../utils/encryption');

const APPLY = process.argv.includes('--apply');

const buildPreview = (encryptedValue) => {
  if (!encryptedValue) return '';
  try {
    const plain = decrypt(encryptedValue);
    return plain ? `••••${plain.slice(-4)}` : '';
  } catch {
    return '';
  }
};

const migrate = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URL or MONGODB_URI is required');
  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.collection('organizations');

  const filter = {
    'paymentGateway.razorpay.keyId': { $exists: true },
    'paymentGateway.razorpay.test': { $exists: false },
    'paymentGateway.razorpay.live': { $exists: false },
  };
  const candidates = await collection.find(filter).toArray();
  let modified = 0;

  for (const org of candidates) {
    const razorpay = org.paymentGateway?.razorpay || {};
    const mode = org.paymentGateway?.mode === 'live' ? 'live' : 'test';
    const movedSlot = {
      keyId: razorpay.keyId || '',
      keySecret: razorpay.keySecret || '',
      keySecretPreview: buildPreview(razorpay.keySecret),
      webhookSecret: razorpay.webhookSecret || '',
      webhookSecretPreview: buildPreview(razorpay.webhookSecret),
      connectedAt: razorpay.connectedAt || null,
      lastVerifiedAt: razorpay.lastVerifiedAt || null,
    };
    const otherMode = mode === 'live' ? 'test' : 'live';
    const emptySlot = {
      keyId: '', keySecret: '', keySecretPreview: '', webhookSecret: '', webhookSecretPreview: '',
      connectedAt: null, lastVerifiedAt: null,
    };

    // eslint-disable-next-line no-await-in-loop
    if (APPLY) {
      // eslint-disable-next-line no-await-in-loop
      await collection.updateOne(
        { _id: org._id },
        {
          $set: {
            [`paymentGateway.razorpay.${mode}`]: movedSlot,
            [`paymentGateway.razorpay.${otherMode}`]: emptySlot,
            'paymentGateway.razorpay.accountName': razorpay.accountName || '',
            'paymentGateway.razorpay.accountEmail': razorpay.accountEmail || '',
          },
          $unset: {
            'paymentGateway.razorpay.keyId': '',
            'paymentGateway.razorpay.keySecret': '',
            'paymentGateway.razorpay.webhookSecret': '',
            'paymentGateway.razorpay.connectedAt': '',
            'paymentGateway.razorpay.lastVerifiedAt': '',
          },
        }
      );
      modified += 1;
    }
  }

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', matched: candidates.length, modified }, null, 2));
  if (!APPLY) console.log('No data was changed. Re-run with --apply after reviewing this output.');
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

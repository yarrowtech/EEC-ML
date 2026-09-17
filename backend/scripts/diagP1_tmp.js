require('dotenv').config();
const mongoose = require('mongoose');
const StudentUser = require('../models/StudentUser');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const withPic = await StudentUser.find({ profilePic: { $exists: true, $ne: null, $ne: '' } })
    .select('name profilePic')
    .limit(10)
    .lean();
  console.log('students with a non-empty profilePic:', withPic.length);
  withPic.forEach((s) => console.log(' -', s.name, '| profilePic =', JSON.stringify(s.profilePic), '| typeof =', typeof s.profilePic));

  const total = await StudentUser.countDocuments({});
  const emptyOrMissing = await StudentUser.countDocuments({ $or: [{ profilePic: { $exists: false } }, { profilePic: null }, { profilePic: '' }] });
  console.log('\ntotal students:', total, 'with empty/missing profilePic:', emptyOrMissing);

  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

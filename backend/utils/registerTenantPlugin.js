const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

if (!mongoose.__tenantPluginRegistered) {
  mongoose.plugin(tenantPlugin);
  mongoose.__tenantPluginRegistered = true;
}

module.exports = mongoose;

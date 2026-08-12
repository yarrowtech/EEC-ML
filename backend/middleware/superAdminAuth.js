const crypto = require('crypto');
const { logger } = require('../utils/logger');

/**
 * Middleware to authenticate requests from Super Admin Portal
 * Verifies API key and HMAC signature
 */
const superAdminAuth = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const signature = req.headers['x-signature'];

    // Check if API key is provided
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required'
      });
    }

    // Verify API key
    const expectedApiKey = process.env.SUPER_ADMIN_INCOMING_API_KEY;
    if (!expectedApiKey) {
      logger.error('SUPER_ADMIN_INCOMING_API_KEY not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    if (apiKey !== expectedApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Verify HMAC signature if provided
    if (signature) {
      const secret = process.env.SUPER_ADMIN_INCOMING_SECRET;

      if (!secret) {
        logger.error('SUPER_ADMIN_INCOMING_SECRET not configured');
        return res.status(500).json({
          success: false,
          error: 'Server configuration error'
        });
      }

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const signatureMatches = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!signatureMatches) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    }

    // Authentication successful
    next();

  } catch (error) {
    logger.error({ err: error }, 'Super Admin authentication error');
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = superAdminAuth;

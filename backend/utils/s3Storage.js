const crypto = require('crypto');
const { GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const S3_URL_PREFIX = 's3://';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

const getS3Config = () => ({
  bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '',
  region: process.env.AWS_REGION || process.env.S3_REGION || '',
});

const isS3Configured = () => {
  const { bucket, region } = getS3Config();
  return Boolean(bucket && region);
};

const requireS3Config = () => {
  const config = getS3Config();
  if (!config.bucket || !config.region) {
    throw new Error('S3 storage is not configured. Set AWS_S3_BUCKET and AWS_REGION.');
  }
  return config;
};

const getClient = (region) => new S3Client({ region });

const safeFileName = (name = 'file') => {
  const normalized = String(name).trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '').slice(0, 160) || 'file';
};

const buildStudyMaterialKey = ({ schoolId, originalName }) => (
  `schools/${String(schoolId)}/study-materials/${crypto.randomUUID()}-${safeFileName(originalName)}`
);

const toS3Uri = (bucket, key) => `${S3_URL_PREFIX}${bucket}/${key}`;

const parseS3Uri = (value) => {
  const uri = String(value || '');
  if (!uri.startsWith(S3_URL_PREFIX)) return null;
  const withoutPrefix = uri.slice(S3_URL_PREFIX.length);
  const separator = withoutPrefix.indexOf('/');
  if (separator <= 0 || separator === withoutPrefix.length - 1) return null;
  return {
    bucket: withoutPrefix.slice(0, separator),
    key: withoutPrefix.slice(separator + 1),
  };
};

const uploadStudyMaterial = async ({ buffer, schoolId, originalName, contentType, size }) => {
  const { bucket, region } = requireS3Config();
  const key = buildStudyMaterialKey({ schoolId, originalName });
  await getClient(region).send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    ContentLength: size || buffer.length,
    ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(originalName))}`,
    ServerSideEncryption: 'AES256',
    Metadata: { school_id: String(schoolId) },
  }));

  return {
    storageProvider: 's3',
    storageUrl: toS3Uri(bucket, key),
    s3Key: key,
    s3Bucket: bucket,
    s3Region: region,
  };
};

const getSignedS3Url = async ({ bucket, key, region, expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS }) => {
  const config = requireS3Config();
  const resolvedBucket = bucket || config.bucket;
  const resolvedRegion = region || config.region;
  if (!key || !resolvedBucket || !resolvedRegion) return '';
  return getSignedUrl(
    getClient(resolvedRegion),
    new GetObjectCommand({ Bucket: resolvedBucket, Key: key }),
    { expiresIn }
  );
};

const getAttachmentDownloadUrl = async (attachment, options = {}) => {
  if (!attachment) return '';
  const key = attachment.s3Key || parseS3Uri(attachment.url)?.key;
  const isS3 = attachment.storageProvider === 's3' || Boolean(key);
  if (!isS3) return attachment.url || '';

  const parsed = parseS3Uri(attachment.url);
  return getSignedS3Url({
    bucket: attachment.s3Bucket || parsed?.bucket,
    key,
    region: attachment.s3Region,
    ...options,
  });
};

const signAttachmentUrls = async (attachments = [], options = {}) => Promise.all(
  attachments.map(async (attachment) => ({
    ...attachment,
    url: await getAttachmentDownloadUrl(attachment, options),
  }))
);

module.exports = {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  getAttachmentDownloadUrl,
  getS3Config,
  getSignedS3Url,
  isS3Configured,
  parseS3Uri,
  signAttachmentUrls,
  uploadStudyMaterial,
};

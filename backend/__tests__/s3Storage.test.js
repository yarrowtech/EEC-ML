jest.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: jest.fn((input) => ({ input })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  S3Client: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/material.pdf'),
}));

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  getAttachmentDownloadUrl,
  parseS3Uri,
  uploadStudyMaterial,
} = require('../utils/s3Storage');

describe('s3Storage', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AWS_REGION = 'ap-south-1';
    process.env.AWS_S3_BUCKET = 'eec-study-materials';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('creates a tenant-scoped object and returns stable S3 metadata', async () => {
    const result = await uploadStudyMaterial({
      buffer: Buffer.from('material'),
      schoolId: 'school-123',
      originalName: 'Fractions handout.pdf',
      contentType: 'application/pdf',
      size: 8,
    });

    expect(result).toMatchObject({
      storageProvider: 's3',
      storageUrl: expect.stringMatching(/^s3:\/\/eec-study-materials\/schools\/school-123\/study-materials\//),
      s3Bucket: 'eec-study-materials',
      s3Region: 'ap-south-1',
    });
    expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'eec-study-materials',
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
    }));
  });

  test('signs stored S3 attachments for delivery', async () => {
    const url = await getAttachmentDownloadUrl({
      storageProvider: 's3',
      s3Key: 'schools/school-123/study-materials/material.pdf',
      s3Bucket: 'eec-study-materials',
      s3Region: 'ap-south-1',
      url: 's3://eec-study-materials/schools/school-123/study-materials/material.pdf',
    });

    expect(url).toBe('https://signed.example/material.pdf');
    expect(getSignedUrl).toHaveBeenCalled();
  });

  test('parses canonical S3 URIs', () => {
    expect(parseS3Uri('s3://bucket/schools/school-123/material.pdf')).toEqual({
      bucket: 'bucket',
      key: 'schools/school-123/material.pdf',
    });
  });
});

const mockSend = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: jest.fn((input) => ({ input })),
  GetObjectCommand: jest.fn((input) => ({ input })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  S3Client: jest.fn(() => ({ send: mockSend })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/material.pdf'),
}));

const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const {
  deleteS3Object,
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

  test('deletes an S3 object using its stored bucket/key', async () => {
    const deleted = await deleteS3Object({
      storageProvider: 's3',
      s3Key: 'schools/school-123/study-materials/material.pdf',
      s3Bucket: 'eec-study-materials',
      s3Region: 'ap-south-1',
      url: 's3://eec-study-materials/schools/school-123/study-materials/material.pdf',
    });

    expect(deleted).toBe(true);
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'eec-study-materials',
      Key: 'schools/school-123/study-materials/material.pdf',
    });
  });

  test('falls back to parsing the s3:// URI when bucket/key fields are missing', async () => {
    const deleted = await deleteS3Object({
      url: 's3://eec-study-materials/schools/school-123/study-materials/legacy.pdf',
    });

    expect(deleted).toBe(true);
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'eec-study-materials',
      Key: 'schools/school-123/study-materials/legacy.pdf',
    });
  });

  test('skips deletion when the attachment has no identifiable S3 location', async () => {
    const deleted = await deleteS3Object({ url: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg' });
    expect(deleted).toBe(false);
    expect(DeleteObjectCommand).not.toHaveBeenCalled();
  });
});

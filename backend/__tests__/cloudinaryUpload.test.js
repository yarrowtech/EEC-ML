const mockDestroy = jest.fn().mockResolvedValue({ result: 'ok' });

jest.mock('../utils/cloudinary', () => ({
  uploader: { destroy: (...args) => mockDestroy(...args) },
}));

const {
  deleteCloudinaryAsset,
  extractCloudinaryPublicIdFromUrl,
} = require('../utils/cloudinaryUpload');

describe('cloudinaryUpload deletion helpers', () => {
  beforeEach(() => {
    mockDestroy.mockClear();
  });

  test('extracts the public_id and resource_type from an image URL', () => {
    const parsed = extractCloudinaryPublicIdFromUrl(
      'https://res.cloudinary.com/demo/image/upload/v1690000000/class_materials/handout-abc123.jpg'
    );
    expect(parsed).toEqual({ publicId: 'class_materials/handout-abc123', resourceType: 'image' });
  });

  test('keeps the extension in the public_id for raw resources', () => {
    const parsed = extractCloudinaryPublicIdFromUrl(
      'https://res.cloudinary.com/demo/raw/upload/v1690000000/class_materials/worksheet-abc123.pdf'
    );
    expect(parsed).toEqual({ publicId: 'class_materials/worksheet-abc123.pdf', resourceType: 'raw' });
  });

  test('returns null for a non-Cloudinary URL', () => {
    expect(extractCloudinaryPublicIdFromUrl('https://example.com/file.pdf')).toBeNull();
  });

  test('deletes using the stored public_id/resource_type when present', async () => {
    const deleted = await deleteCloudinaryAsset({ publicId: 'class_materials/handout-abc123', resourceType: 'image' });
    expect(deleted).toBe(true);
    expect(mockDestroy).toHaveBeenCalledWith('class_materials/handout-abc123', { resource_type: 'image', invalidate: true });
  });

  test('falls back to parsing the URL when no public_id was stored', async () => {
    const deleted = await deleteCloudinaryAsset({
      url: 'https://res.cloudinary.com/demo/raw/upload/v1690000000/class_materials/worksheet-abc123.pdf',
    });
    expect(deleted).toBe(true);
    expect(mockDestroy).toHaveBeenCalledWith('class_materials/worksheet-abc123.pdf', { resource_type: 'raw', invalidate: true });
  });

  test('skips deletion and does not call destroy when the asset cannot be identified', async () => {
    const deleted = await deleteCloudinaryAsset({ url: 'https://example.com/not-cloudinary.pdf' });
    expect(deleted).toBe(false);
    expect(mockDestroy).not.toHaveBeenCalled();
  });
});

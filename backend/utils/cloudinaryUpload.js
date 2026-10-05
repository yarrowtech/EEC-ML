const cloudinary = require("./cloudinary");

// Why stream: avoids temp files & works with multer.memoryStorage
function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", use_filename: true, unique_filename: true, overwrite: false, ...options },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Cloudinary URLs are cross-origin, so <a download> is ignored by the browser
// and the file just opens inline. Inserting the fl_attachment flag makes
// Cloudinary itself send Content-Disposition: attachment, which forces a
// real download regardless of origin. The flag's value can't contain dots,
// so the extension is stripped — Cloudinary still serves the real file bytes.
function buildCloudinaryAttachmentUrl(url, filename) {
  const raw = String(url || "");
  if (!raw.includes("res.cloudinary.com") || !raw.includes("/upload/") || raw.includes("/upload/fl_attachment")) {
    return raw;
  }
  const baseName = String(filename || "").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const flag = baseName ? `fl_attachment:${baseName}` : "fl_attachment";
  return raw.replace("/upload/", `/upload/${flag}/`);
}

// Attachments uploaded before this field existed never got a cloudinaryPublicId
// stored on them, so deletion falls back to recovering it from the URL itself:
// .../<resource_type>/upload/(v<version>/)?<public_id>[.<ext>]
// Raw resources (pdf/docx/pptx) keep their extension as part of the public_id;
// image/video resources don't, so the extension must be stripped for those.
function extractCloudinaryPublicIdFromUrl(url) {
  const raw = String(url || "");
  const match = raw.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?([^?#]+)$/);
  if (!match) return null;
  const resourceType = match[1];
  let publicId = match[2];
  if (resourceType !== "raw") {
    publicId = publicId.replace(/\.[^./]+$/, "");
  }
  return { publicId: decodeURIComponent(publicId), resourceType };
}

// Best-effort delete: resolves the public_id/resource_type from the stored
// field first, falling back to parsing the URL for attachments uploaded
// before cloudinaryPublicId was captured. Returns false (never throws) when
// the asset can't be identified, so callers can log-and-continue cleanup.
async function deleteCloudinaryAsset({ url, publicId, resourceType } = {}) {
  let resolvedId = publicId;
  let resolvedType = resourceType;
  if (!resolvedId) {
    const parsed = extractCloudinaryPublicIdFromUrl(url);
    if (!parsed) return false;
    resolvedId = parsed.publicId;
    resolvedType = resolvedType || parsed.resourceType;
  }
  await cloudinary.uploader.destroy(resolvedId, {
    resource_type: resolvedType || "image",
    invalidate: true,
  });
  return true;
}

module.exports = {
  uploadBufferToCloudinary,
  buildCloudinaryAttachmentUrl,
  extractCloudinaryPublicIdFromUrl,
  deleteCloudinaryAsset,
};
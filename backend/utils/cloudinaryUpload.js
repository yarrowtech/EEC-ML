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

module.exports = { uploadBufferToCloudinary, buildCloudinaryAttachmentUrl };
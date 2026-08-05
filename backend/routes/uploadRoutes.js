const express = require("express");
const multer = require("multer");
const authAnyUser = require("../middleware/authAnyUser");
const { uploadBufferToCloudinary } = require("../utils/cloudinaryUpload");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 25 }, // 20MB/file, max 25 files
});

const ALLOWED_FOLDERS = new Set([
  "nif_students",
  "worksheets",
  "notices",
  "report-card-logos",
  "class_materials",
  "smart_learning_materials",
  "teacher_expenses",
  "teacher_profiles",
  "exam-routines",
  "admin-avatars",
  "school-logos",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

const parseTags = (value) => String(value || "")
  .split(",")
  .map((tag) => tag.trim())
  .filter(Boolean)
  .slice(0, 10)
  .map((tag) => tag.slice(0, 64));

const validateFile = (file) => {
  if (!file) return "No file received";
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return "Unsupported file type";
  return null;
};

const resolveFolder = (req, res) => {
  const folder = String(req.body?.folder || "nif_students").trim();
  if (!ALLOWED_FOLDERS.has(folder)) {
    res.status(400).json({ message: "Unsupported upload folder" });
    return null;
  }
  return folder;
};

// POST /api/uploads/cloudinary/single   (field: "file")
router.post("/cloudinary/single", authAnyUser, upload.single("file"), async (req, res) => {
  // #swagger.tags = ['Uploads']
  try {
    const fileError = validateFile(req.file);
    if (fileError) return res.status(400).json({ message: fileError });
    const folder = resolveFolder(req, res);
    if (!folder) return;
    const tags = parseTags(req.body.tags);

    const isPdf = req.file.mimetype === "application/pdf";
    const r = await uploadBufferToCloudinary(req.file.buffer, {
      folder,
      tags,
      resource_type: isPdf ? "raw" : "auto",
      access_mode: "public",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    res.json({
      uploaded: 1,
      files: [{
        originalName: req.file.originalname,
        public_id: r.public_id,
        secure_url: r.secure_url,
        resource_type: r.resource_type,
        format: r.format,
        bytes: r.bytes,
        width: r.width,
        height: r.height,
      }],
    });
  } catch (e) {
    console.error("Cloudinary single upload error:", e);
    res.status(500).json({ message: "Upload failed" });
  }
});

// POST /api/uploads/cloudinary/bulk     (field: "files")
router.post("/cloudinary/bulk", authAnyUser, upload.array("files", 25), async (req, res) => {
  // #swagger.tags = ['Uploads']
  try {
    if (!req.files?.length) return res.status(400).json({ message: "No files received" });
    const invalidFile = req.files.map(validateFile).find(Boolean);
    if (invalidFile) return res.status(400).json({ message: invalidFile });

    const folder = resolveFolder(req, res);
    if (!folder) return;
    const tags = parseTags(req.body.tags);

    const files = await Promise.all(
      req.files.map(async (f) => {
        const isPdf = f.mimetype === "application/pdf";
        const r = await uploadBufferToCloudinary(f.buffer, {
          folder,
          tags,
          resource_type: isPdf ? "raw" : "auto",
          access_mode: "public",
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        });
        return {
          originalName: f.originalname,
          public_id: r.public_id,
          secure_url: r.secure_url,
          resource_type: r.resource_type,
          format: r.format,
          bytes: r.bytes,
          width: r.width,
          height: r.height,
        };
      })
    );

    res.json({ uploaded: files.length, files });
  } catch (e) {
    console.error("Cloudinary bulk upload error:", e);
    res.status(500).json({ message: "Cloudinary bulk upload failed" });
  }
});

module.exports = router;

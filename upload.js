const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ErrorResponse = require('../utils/errorResponse');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExt = /jpe?g|png|webp|gif/;
  const extOk = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowedExt.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new ErrorResponse('Only image files (jpg, png, webp, gif) are allowed', 400));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;

const multer = require("multer");
const path = require("path");
const fs = require("fs");


const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname +
        "-" +
        Date.now() +
        path.extname(file.originalname)
    );
  },
});


const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(null, false);
    req.fileValidationError =
      "Only jpeg, jpg, png, or pdf files are allowed";
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

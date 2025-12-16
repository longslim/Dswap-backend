const multer = require("multer")
const path = require("path")


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/") 
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    )
  }
})


const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowedTypes.test(ext)) {
    cb(null, true)
  } else {
    cb(new Error("Only images (jpeg, jpg, png, pdf) are allowed"), false)
  }
}

const upload = multer({ storage, fileFilter })

module.exports = upload

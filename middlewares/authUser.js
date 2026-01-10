const jwt = require("jsonwebtoken");
const { signupModel } = require("../models/signupModel");

async function verifyUser(req, res, next) {
  try {
    const token =
      req.cookies.signinToken ||
      (req.headers.authorization && req.headers.authorization.split(" ")[1]);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Not authorized, no token",
      });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET_MESSAGE);
    const user = await signupModel.findById(verified.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    req.user = user;
    req.user.role = verified.role || user.role
    next();
  } catch (err) {
    //console.error("JWT Error:", err.message);
    let message = "Not authorized, token failed";
    if (err.name === "TokenExpiredError") {
      message = "Session expired, please sign in again";
    }

    res.status(401).json({ success: false, error: message });
  }
}


function verifyAdmin(req, res, next) {
  if(!req.user || req.user.role !== "admin"){
    return res.status(403).json({
      success: false,
      message: "Access denied. Admins only."
    })
    

  }
  next()
}

module.exports = { verifyUser, verifyAdmin };

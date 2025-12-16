const { signupUser, loginUser, logoutUser, userProfile, resetPasswordMail, updatePassword, createAdmin, adminProfile, updateAdminProfile, createPin, maskedCard, getCardDetails, changePin } = require("../controllers/userController")
const { verifyUser, verifyAdmin } = require("../middlewares/authUser")
const { signupModel } = require("../models/signupModel")
const upload = require("../utilis/upload")

const userRouter = require("express").Router()


userRouter.post("/signup-user",upload.fields([
    {name: "frontId", maxCount: 1},
    {name: "backId", maxCount: 1}
]), signupUser)
userRouter.post("/login-user", loginUser)
userRouter.get("/logout-user", logoutUser)
userRouter.get("/dashboard", verifyUser , (req, res) => {
    res.status(200).json({
      success: true,
      msg: "Welcome to your dashboard",
      user: req.user,
    });
  })
userRouter.get("/verify-user", verifyUser, (req, res) => {
  res.status(200).json({
    success: true,
    message: "User is authenticated",
    user: req.user,
  })
})
userRouter.get("/user-profile", verifyUser, userProfile)
userRouter.post("/submitted-email", resetPasswordMail)
userRouter.post("/update-password/:id/:token", updatePassword)
userRouter.post("/create-admin",verifyUser, verifyAdmin, createAdmin)
userRouter.get("/admin-profile", verifyUser, verifyAdmin, adminProfile)
userRouter.put("/admin/update-profile", verifyAdmin, updateAdminProfile)
userRouter.get("/admin/all-users", verifyUser, verifyAdmin, async (req, res) => {
  try {
    const users = await signupModel.find().select("-password")
    res.status(200).json({
      success: true,
      count: users.length,
      users
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error fetching users",
      error: err.message
    })
  }
})

userRouter.post("/create-pin", verifyUser, createPin)
userRouter.put("/change-pin", verifyUser, changePin)
userRouter.get("/masked", verifyUser, maskedCard)
userRouter.post("/card-details", verifyUser, getCardDetails)









module.exports= {userRouter}
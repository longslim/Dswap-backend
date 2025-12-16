const { signupModel } = require("../models/signupModel")
const { errorHandler } = require("../utilis/handleError")
const { sendEmail } = require("../utilis/mail")



const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const moment = require("moment")



const period = 60 * 60 * 24 * 7
const generateToken = (user) => {
    return jwt.sign({id: user._id, role: user.role}, process.env.JWT_SECRET_MESSAGE, {expiresIn: period})
}


const generateAccountNumber = async () => {
    const prefix = "77"
    let accountNumber
    let exists = true

    while (exists) {
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000)
    accountNumber = prefix + randomDigits.toString().slice(0, 8)

    const existingUser = await signupModel.findOne({accountNumber})
    if (!existingUser) exists = false
    }

    return accountNumber

}


const generateRoutingNumber = async () => {
    const prefix = "9"
    const suffix = "6"
    let routingNumber
    let exists = true

    while (exists) {
        const randomDigits = Math.floor(100000000 + Math.random() * 900000000)
        routingNumber = prefix + randomDigits.toString().slice(0, 7) + suffix

        const existingUser = await signupModel.findOne({routingNumber})
        if (!existingUser) exists = false
    }

    return routingNumber
}


const generateCardNumber = async () => {
  let cardNumber;
  let exists = true;

  while (exists) {
    const prefix = Math.random() < 0.5 ? "4" : "5";

    
    const randomDigits = Math.floor(100000000000000 + Math.random() * 900000000000000);

    cardNumber = prefix + randomDigits.toString().slice(0, 15); 

    const existingUser = await signupModel.findOne({ cardNumber });
    if (!existingUser) exists = false;
  }

  return cardNumber;
};



const generateCvv = async () => {
  
  
  let cvv
  let exists = true

  while (exists) {
      const randomDigits = Math.floor(100 + Math.random() * 900)
      cvv =  randomDigits.toString() 

      const existingUser = await signupModel.findOne({cvv})
      if (!existingUser) exists = false
  }

  return cvv
}


const generateExpiryDate = async () => {
  
  const yearsToAdd = Math.floor(Math.random() * 3) + 3; 
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + yearsToAdd);

  
  const month = String(expiry.getMonth() + 1).padStart(2, "0");
  const year = String(expiry.getFullYear()).slice(-2);

  return `${month}/${year}`; 
};






const signupUser = async(req, res) => {
    try {
        const {firstname, lastname, email, dob, mobileNo, address, ssn, idType, password} = req.body

        if(!firstname || !lastname || !email || !dob || !mobileNo || !address || !ssn || !idType || !password){
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            })
        }
        const userExist = await signupModel.findOne({email})
        if(userExist){
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            })
        }
        const mobileExist = await signupModel.findOne({mobileNo})
        if(mobileExist){
            return res.status(400).json({
                success: false,
                message: "Number already exists"
            })
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password,salt)

        const accountNumber = await generateAccountNumber()
        const routingNumber = await generateRoutingNumber()
        const cardNumber = await generateCardNumber()
        const cvv = await generateCvv()
        const expiryDate = await generateExpiryDate()

        const parsedDate = moment(dob, ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD"], true)
        if (!parsedDate.isValid()) {
            throw new Error("Invalid date format. Use DD-MM-YYYY, MM-DD-YYYY, or YYYY-MM-DD")
        }

        const frontIdPath = req.files?.frontId ? req.files.frontId[0].path : null
        const backIdPath = req.files?.backId ? req.files.backId[0].path : null

        const userCount = await signupModel.countDocuments();
        const role = userCount === 0 ? "admin" : "user"

        const newUser = new signupModel({
            firstname,
            lastname,
            email,
            dob: parsedDate.toDate(),
            mobileNo,
            address,
            ssn,
            idType,
            frontId: frontIdPath,
            backId: backIdPath,
            password: hashedPassword,
            accountNumber,
            routingNumber,
            cardNumber,
            cvv,
            expiryDate,
            role
        })

        const savedUser = await newUser.save()

        //const token = generateToken(savedUser._id)

        const token = generateToken(savedUser)


        res.cookie("signinToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
          maxAge: 1000 * period,
        });
        
        res.status(201).json({
            success: true,
            message: role === "admin"
            ? "Admin account created successfully!"
            : "User account created successfully!",
            savedUser,
            token
        })
    } catch (err) {
       console.log(err.message)
       let error = errorHandler(err)
       res.status(400).json({
        success: false,
        error
       }) 
    }
}


const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    
    const user = await signupModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    
    const token = generateToken(user);

    
    res.cookie("signinToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    
    let redirectPath;
    if (user.role === "admin") {
      redirectPath = "/admin/dashboard";
    } else {
      redirectPath = "/user/dashboard";
    }

    
    res.status(200).json({
      success: true,
      message:
        user.role === "admin"
          ? "Admin login successful!"
          : "User login successful!",
      role: user.role,
      redirect: redirectPath,
      user,
      token,
    });
  } catch (err) {
    console.error("Login Error:", err.message);
    const error = errorHandler(err);
    res.status(400).json({
      success: false,
      error,
    });
  }
};



const logoutUser = async (req, res) => {
  try {
    res.clearCookie("signinToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
};


const createAdmin = async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;

    
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can create another admin.",
      });
    }

    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    const existingAdmin = await signupModel.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);


    const parsedDate = moment(dob, ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD"], true)
        if (!parsedDate.isValid()) {
            throw new Error("Invalid date format. Use DD-MM-YYYY, MM-DD-YYYY, or YYYY-MM-DD")
        }

    const newAdmin = new signupModel({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      role: "admin", // 👈 set role to admin
      dob: parsedDate.toDate(),
      mobileNo: "0000000000",
      address: "Head Office",
      ssn: "000-00-0000",
      idType: "State ID",
      frontId: "uploads/default/front.png",
      backId: "uploads/default/back.png",
      accountNumber: "77777777",
      routingNumber: "99999996",
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: "Admin created successfully.",
      admin: {
        id: newAdmin._id,
        firstname: newAdmin.firstname,
        lastname: newAdmin.lastname,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });
  } catch (err) {
    console.error("Error creating admin:", err.message);
    res.status(500).json({
      success: false,
      message: "Error creating admin.",
      error: err.message,
    });
  }
};



const userProfile = async (req, res) => {
    try {
        const user = await signupModel.findById(req.user.id).select("-password")
        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        res.status(200).json({
            success: true,
            user,
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error"
        })
    }
}


const adminProfile = async (req, res) => {
    try {
        const user = await signupModel.findById(req.user.id).select("-password")
        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }
        res.status(200).json({
            success: true,
            user,
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error"
        })
    }
}


const updateAdminProfile = async (req, res) => {
  try {
    const admin = await signupModel.findById(req.user._id)
    if(!admin || admin !== "admin"){
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can update their profile"
      })
    }

    const {firstname, lastname, email, password} = req.body

    if (firstname) admin.firstname = firstname
    if (lastname) admin.lastname = lastname
    if (email) admin.email = email
    if (password) {
      admin.password = await bcrypt.hash(password, 10)
    }

    await admin.save()

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        firstname: admin.firstname,
        lastname: admin.lastname,
        email: admin.email,
        role: admin.role,
      },
    })
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    })
  }
}



const resetPasswordMail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email address.",
      });
    }

    const user = await signupModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email does not exist.",
      });
    }


    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_MESSAGE, {
      expiresIn: "5m", 
    });

    
    const resetLink = `${process.env.CLIENT_URL}/update-password/${user._id}/${token}`;

    
    const emailTemplate = `
      <div style="font-family:Arial, sans-serif; padding:20px;">
        <h2>Password Reset Request</h2>
        <p>Hello ${user.firstname || "User"},</p>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <a href="${resetLink}" 
           style="display:inline-block; padding:10px 15px; color:white; background-color:#007bff; text-decoration:none; border-radius:5px;">
          Reset Password
        </a>
        <p>This link will expire in <b>5 minutes</b>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr/>
        <p style="font-size:12px;color:#888;">© ${new Date().getFullYear()} Bank App. All rights reserved.</p>
      </div>
    `;

    
    await sendEmail(
      user.email,
      "Reset Your Password - Bank App",
      emailTemplate
    );

    res.status(200).json({
      success: true,
      message: "Reset password email sent successfully!",
    });
  } catch (err) {
    console.error("Reset email error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to send reset email. Try again later.",
    });
  }
};






const updatePassword = async (req, res) => {
    try {
      const { id, token } = req.params;
      const { newPassword } = req.body;
  
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: "Please enter a new password.",
        });
      }
  
      const user = await signupModel.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }
  
      
      jwt.verify(token, process.env.JWT_SECRET_MESSAGE, async (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: "Reset link expired or invalid.",
          });
        }
  
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
  
        res.status(200).json({
          success: true,
          message: "Password updated successfully. Please log in.",
        });
      });
    } catch (err) {
      console.error("Password reset error:", err.message);
      res.status(500).json({
        success: false,
        message: "Server error. Please try again later.",
      });
    }
};



const createPin = async (req, res) => {
  try {
    const { cardPin } = req.body;
    const userId = req.user._id;

    if (!cardPin) {
      return res.status(400).json({
        success: false,
        message: "PIN is required",
      });
    }

    if (!/^\d{4}$/.test(cardPin)) {
      return res.status(400).json({
        success: false,
        message: "PIN must be exactly 4 digits",
      });
    }

    const user = await signupModel.findByIdAndUpdate(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.cardPin) {
      return res.status(400).json({
        success: false,
        message: "PIN already exists. Use change PIN instead.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.cardPin = await bcrypt.hash(cardPin, salt);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Transaction PIN created successfully",
    });
  } catch (err) {
    console.error("Create PIN Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create PIN",
    });
  }
};




const changePin = async (req, res) => {
  try {
    const { oldPin, newPin } = req.body;
    const userId = req.user._id;

    if (!oldPin || !newPin) {
      return res.status(400).json({
        success: false,
        message: "Old PIN and new PIN are required",
      });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: "New PIN must be exactly 4 digits",
      });
    }

    // ✅ FIX: findById + select cardPin
    const user = await signupModel
      .findById(userId)
      .select("+cardPin");

    if (!user || !user.cardPin) {
      return res.status(400).json({
        success: false,
        message: "Transaction PIN not set",
      });
    }

    const validOldPin = await bcrypt.compare(oldPin, user.cardPin);

    if (!validOldPin) {
      return res.status(401).json({
        success: false,
        message: "Old PIN is incorrect",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.cardPin = await bcrypt.hash(newPin, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "PIN changed successfully",
    });
  } catch (err) {
    console.error("Change PIN Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to change PIN",
    });
  }
};




  
  

const getCardDetails = async (req, res) => {
  try {
    const { cardPin } = req.body;
    const userId = req.user._id;

    if (!cardPin) {
      return res.status(400).json({ success: false, message: "PIN is required" });
    }

    const user = await signupModel
      .findById(userId)
      .select("+cardPin +cardNumber +cvv +expiryDate");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Verify PIN
    const valid = await bcrypt.compare(cardPin, user.cardPin);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Incorrect PIN" });
    }

    // PIN correct → return sensitive values
    return res.status(200).json({
      success: true,
      cardNumber: user.cardNumber,
      cvv: user.cvv,
      expiryDate: user.expiryDate,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to get card details",
    });
  }
};


const maskedCard = async (req, res) => {
  try {
    const user = await signupModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const masked = "**** **** **** " + user.cardNumber.slice(-4);

    return res.status(200).json({
      success: true,
      cardNumber: masked,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to get masked card",
    });
  }
};



module.exports= {signupUser, loginUser, logoutUser, userProfile, adminProfile, updateAdminProfile, resetPasswordMail, updatePassword, createAdmin, createPin, changePin, getCardDetails, maskedCard}
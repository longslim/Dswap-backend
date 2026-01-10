// const nodemailer = require("nodemailer")
// require('dotenv').config();


// const sendEmail = async (to, subject, html) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",  
//       auth: {
//         user: process.env.EMAIL_USER, 
//         pass: process.env.EMAIL_PASS, 
//       },
//     });

//     const mailOptions = {
//       from: `"Bank App" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html,
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log("✅ Email sent:", info.response);
//   } catch (err) {
//     console.error("❌ Email sending failed:", err);
//     throw new Error("Email could not be sent");
//   }
// };


// module.exports= {sendEmail}




const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    const { error } = await resend.emails.send({
      from: "Dswap <onboarding@resend.dev>", //no-reply@yourdomain.com
      to,
      subject,
      html,
    });

    if (error) {
      console.error("❌ Email sending failed:", error);
      throw new Error("Email could not be sent");
    }

    console.log("✅ Email sent successfully");
  } catch (err) {
    console.error("❌ Email error:", err.message);
    throw err;
  }
};

module.exports = { sendEmail };

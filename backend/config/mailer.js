const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SES_SMTP_HOST,
  port: Number(process.env.SES_SMTP_PORT),
  secure: false, // Port 587 uses STARTTLS
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SES SMTP connection failed:", error);
  } else {
    console.log("SES SMTP connection successful");
  }
});

module.exports = transporter;

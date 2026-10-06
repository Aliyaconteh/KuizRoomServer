const nodemailer = require("nodemailer");

const sendVerificationEmail = async (email, token) => {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    const error = new Error("Email delivery is not configured");
    error.code = "EMAIL_DELIVERY_FAILED";
    throw error;
  }

  const verificationUrl = new URL("/verify-email", process.env.CLIENT_URL || "http://localhost:5173");
  verificationUrl.searchParams.set("token", token);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || GMAIL_USER,
      to: email,
      subject: "Verify your KuizRoom email",
      text: `Verify your KuizRoom email by opening this link: ${verificationUrl.href}\n\nThis link expires in 24 hours.`,
      html: `<p>Thanks for creating a KuizRoom account.</p><p><a href="${verificationUrl.href}">Verify your email address</a></p><p>This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>`
    });
  } catch (cause) {
    console.error("[EMAIL_VERIFICATION] Failed to deliver verification email:", cause);
    const error = new Error("Unable to send verification email. Please try again later.");
    error.code = "EMAIL_DELIVERY_FAILED";
    throw error;
  }
};

module.exports = { sendVerificationEmail };

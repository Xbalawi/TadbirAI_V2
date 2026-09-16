const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log("Testing SMTP Connection...");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: "ichrimya@gmail.com",
      pass: "vftqspqzwbvdkuvd",
    },
  });

  try {
    console.log("Verifying connection configuration...");
    await transporter.verify();
    console.log("✅ Server is ready to take our messages");
    
    console.log("Sending test email...");
    const info = await transporter.sendMail({
      from: '"Test Tadbir AI" <ichrimya@gmail.com>',
      to: "ichrimya@gmail.com", // Send to self
      subject: "Localhost SMTP Test",
      text: "If you receive this, SMTP is working perfectly on localhost!",
    });
    console.log("✅ Test email sent successfully! Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ SMTP Error:", error);
  }
}

testSMTP();

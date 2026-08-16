const nodemailer = require('nodemailer');

// Sends an email via SMTP using credentials from environment variables.
// If SMTP isn't configured, the message is printed to the console instead
// of throwing - so registration / password-reset flows keep working in
// local development without a real mail provider set up.
const sendEmail = async ({ to, subject, text, html }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log('\n--- SMTP not configured, printing email instead of sending ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html);
    console.log('---------------------------------------------------------------\n');
    return { previewedOnly: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;

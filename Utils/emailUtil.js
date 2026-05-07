const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
  connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 5000),
  greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 5000),
  socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 5000),
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error.message);
  } else {
    console.log('✅ Email transporter ready to send messages');
  }
});

exports.sendEmail = async (options) => {
  try {
    console.log('📧 Sending email to:', options.to);

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'NoReply'} <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html || '',
      attachments: options.attachments || [], // ✅ Attachments included
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.response);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return null;
  }
};



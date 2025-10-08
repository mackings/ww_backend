// const twilio = require('twilio');

// const client = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// // Send SMS

// exports.sendSMS = async (options) => {
//   try {
//     const message = await client.messages.create({
//       body: options.message,
//       from: process.env.TWILIO_PHONE_NUMBER,
//       to: options.to
//     });

//     console.log('SMS sent:', message.sid);
//     return message;
//   } catch (error) {
//     console.error('Error sending SMS:', error);
//     throw new Error('Failed to send SMS');
//   }
// };
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });
admin.initializeApp();

/**
 * Here we're using Gmail to send
 */
let transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'info.towerapp@gmail.com',
    pass: process.env.APPKEY,
  },
});

exports.sendMail = functions.https.onRequest((req: any, res: any) => {
  cors(req, res, () => {
    // getting dest email by query string
    const dest = req.query.dest;
    const code = req.query.code;

    const mailOptions = {
      from: 'Tower Team <info.towerapp@gmail.com>',
      to: dest,
      subject: 'Tower Email Verification Code',
      html:
        `<p style="font-size: 16px;">Thanks for using our app! Here's your verification code: ` +
        code +
        `</p>
            `,
    };

    // returning result
    return transporter.sendMail(mailOptions, (erro: any, info: any) => {
      if (erro) {
        return res.send(erro.toString());
      }
      return res.send('Sended');
    });
  });
});

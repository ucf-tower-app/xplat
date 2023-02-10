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
  console.log(req);
  cors(req, res, () => {
    // getting dest email by query string
    const dest = req.query.dest;

    const mailOptions = {
      from: 'Tower Team <info.towerapp@gmail.com>', // Something like: Jane Doe <janedoe@gmail.com>
      to: dest,
      subject: 'Confirm Email', // email subject
      html: `<p style="font-size: 16px;">We're, uh, working on this part. Stay tuned.</p>
            `, // email content in HTML
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

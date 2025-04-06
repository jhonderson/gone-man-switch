var nodemailer = require('nodemailer');

const areEmailRecipientsValid = (recipients) => {
  const emails = (recipients || '').replace(/\s/g, '').split(",");
  for (const email of emails) {
    const isEmailValid = String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
    if (!isEmailValid) {
      return false;
    }
  }
  return emails.length > 0;
};

const sendEmail = async ({ host, port, secure, from, username, authMechanism, password }, { recipients, subject, body, attachments }) => {
  if (!host || !port || !from) {
    throw new Error("Can't send email because some required SMTP settings are missing");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
  });
  if (authMechanism && username && password) {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        type: authMechanism,
        user: username,
        pass: password,
      },
    });
  }

  var mailOptions = {
    from,
    to: recipients,
    subject,
    text: body,
    attachments
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  areEmailRecipientsValid,
  sendEmail,
}

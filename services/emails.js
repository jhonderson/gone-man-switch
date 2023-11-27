var nodemailer = require('nodemailer');

const systemSettings = require('../services/system').getSystemSettings();

const isSMTPConfigurationPresent = () => {
  return systemSettings.smtp.host
  && systemSettings.smtp.port
  && systemSettings.smtp.from
  && systemSettings.smtp.authMechanism
  && systemSettings.smtp.username
  && systemSettings.smtp.password;
}

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

const sendEmail = async ({ recipients, subject, body, attachments }) => {
  const transporter = nodemailer.createTransport({
    host: systemSettings.smtp.host,
    port: systemSettings.smtp.port,
    secure: systemSettings.smtp.secure,
    auth: {
      type: systemSettings.smtp.authMechanism,
      user: systemSettings.smtp.username,
      pass: systemSettings.smtp.password,
    },
  });

  var mailOptions = {
    from: systemSettings.smtp.from,
    to: recipients,
    subject,
    text: body,
    attachments
  };

  await transporter.sendMail(mailOptions);
}

const sendTestEmail = async (email) => {
  if (!isSMTPConfigurationPresent()) {
    throw new Error("Test email cannot be sent because not all the required SMTP settings are present");
  }
  if (!email) {
    throw new Error("Test email cannot be sent because your account doesn't have an email associated to it. Configure your email in the Account module");
  }
  try {
    await sendEmail({
      recipients: email,
      subject: "Gone Man's Switch - Test Email",
      body: 'Hello,\n\nIt looks like your SMTP configuration is correct!\n\nCheers'
    });
  } catch (err) {
    throw new Error(`Error while sending test email: ${err.message}`);
  }
}


module.exports = {
  isSMTPConfigurationPresent,
  areEmailRecipientsValid,
  sendEmail,
  sendTestEmail,
}

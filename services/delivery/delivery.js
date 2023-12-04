const { sendEmail } = require("./emails");
const { sendMessage } = require("./telegram");
const { getSMSServiceProviderClient } = require("./sms");

async function sendMessageByEmail(smtpSettings, { recipients, subject, attachmentName, attachmentContent }, body) {
  if (!smtpSettings) {
    throw new Error("Can't send message by email because SMTP settings are missing");
  }
  const attachments = [];
  if (attachmentContent) {
    attachments.push({
      filename: attachmentName,
      content: attachmentContent
    });
  }
  await sendEmail(smtpSettings, {
    recipients,
    subject,
    body,
    attachments
  });
}

async function sendMessageBySMS(smsSettings, { serviceProvider, phoneNumbers }, body) {
  if (!smsSettings) {
    throw new Error("Can't send message by SMS because SMS settings are missing");
  }
  if (!serviceProvider) {
    throw new Error("Can't send message by SMS because service provider is missing");
  }
  let serviceProviderClient = getSMSServiceProviderClient(serviceProvider);
  for (const phoneNumber of phoneNumbers.replace(' ', '').split(',')) {
    await serviceProviderClient.sendText(smsSettings, {
      to: phoneNumber,
      body
    });
  }
}

async function sendMessageByTelegram(telegramSettings, { parseMode, chatIds }, text) {
  if (!telegramSettings) {
    throw new Error("Can't send message by Telegram because Telegram settings are missing");
  }
  for (const chatId of chatIds.replace(' ', '').split(',')) {
    await sendMessage(telegramSettings, {
      chatId,
      text,
      parseMode
    });
  }
}

module.exports = {
  sendMessageByEmail,
  sendMessageBySMS,
  sendMessageByTelegram,
}

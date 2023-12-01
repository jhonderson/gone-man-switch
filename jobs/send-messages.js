const { isSMTPConfigurationPresent, sendEmail } = require("../services/emails");
const util = require('util');
const logger = require('../logger');

const messagesService = require("../services/messages");
const checkinService = require("../services/checkin");
const systemSettings = require('../services/system').getSystemSettings();

const sendMessages = async () => {
  logger.debug('[send-messages] starting...');
  if (!isSMTPConfigurationPresent()) {
    logger.error("SMTP configuration is not complete, aborting job since the system won't be able to deliver messages");
    return;
  }
  const messagesReadyToBeSent = await messagesService.getMessagesReadyToBeDelivered();
  for (const message of messagesReadyToBeSent) {
    await sendMessage(message);
  }
  // If a user has no more messages, delete its notifications
  await checkinService.deleteOrphanCheckinNotifications();
  logger.debug('[send-messages] done');
}

const sendMessage = async (message) => {
  const attachments = [];
  if (message.attachmentContent) {
    attachments.push({
      filename: message.attachmentName,
      content: message.attachmentContent
    });
  }
  const body = extractMessageBody(message);
  if (!body) {
    logger.error(`Message with id ${message.id} won't be delivered because it has an empty body`);
    return;
  }
  try {
    await sendEmail({
      recipients: message.recipients,
      subject: message.subject,
      body,
      attachments
    });
  } catch (err) {
    logger.error(`Error sending message: ${err.message}`);
    return;
  }
  await messagesService.deleteMessage(message.id);
  logger.info(`Message with id ${message.id} sent succesfully and deleted`);
}

const extractMessageBody = (message) => {
  if (message.encryption == messagesService.MessageBodyEncryption.encrypted_custom_encryption_password) {
    return util.format(systemSettings.message.customEncryptionBodyFormat,
      buildMessageBodyDecryptionUrl(message.encryptionPayload),
      message.customEncryptionPasswordHint);
  } else {
    return message.body;
  }
}

function buildMessageBodyDecryptionUrl(encryptionPayload) {
  return `${systemSettings.checkin.serverUrl}/messages/decrypt/${encryptionPayload}`
}

module.exports = {
  sendMessages,
};

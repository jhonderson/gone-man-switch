const util = require('util');
const logger = require('../logger');

const messagesService = require("../services/messages");
const checkinService = require("../services/checkin");
const deliveryService = require("../services/delivery/delivery");
const usersService = require("../services/users");
const systemSettings = require('../services/system').getSystemSettings();

const sendMessages = async () => {
  logger.debug('[send-messages] starting...');
  const messagesReadyToBeSent = await messagesService.getMessagesReadyToBeDelivered();
  const usersById = {};
  for (const message of messagesReadyToBeSent) {
    let user;
    if (message.userId in usersById) {
      user = usersById[message.userId];
    } else { 
      user = await usersService.getUser(message.userId);
      usersById[message.userId] = user;
    }
    await sendMessage(message, user);
  }
  // If a user has no more messages, delete its notifications
  await checkinService.deleteOrphanCheckinNotifications();
  logger.debug('[send-messages] done');
}

const sendMessage = async (message, { settings: userSettings }) => {
  const { id, destinations } = message;
  const { content, telegramContent, telegramParseMode } = extractMessageContent(message);
  if (!content) {
    logger.error(`Message with id ${id} won't be delivered because it has an empty body`);
    return;
  }
  if (!destinations || !Object.keys(destinations).length) {
    logger.error(`Message with id ${id} won't be delivered because it has no destinations`);
    return;
  }
  let messageDelivered = false;
  if (destinations.email) {
    try {
      await deliveryService.sendMessageByEmail(userSettings.smtp || systemSettings.smtp,
        destinations.email, content);
      messageDelivered = true;
    } catch(err) {
      logger.error(`Error delivering message by email: ${err.message}`);
    }
  }
  if (destinations.sms) {
    try {
      await deliveryService.sendMessageBySMS(userSettings.sms, destinations.sms, content);
      messageDelivered = true;
    } catch(err) {
      logger.error(`Error delivering message by SMS: ${err.message}`);
    }
  }
  if (destinations.telegram) {
    try {
      await deliveryService.sendMessageByTelegram(userSettings.telegram, {
        ...destinations.telegram,
        parseMode: telegramParseMode
      }, telegramContent);
      messageDelivered = true;
    } catch(err) {
      logger.error(`Error delivering message by Telegram: ${err.message}`);
    }
  }

  if (messageDelivered) {
    await messagesService.deleteMessage(id);
    logger.info(`Message with id ${id} sent succesfully and deleted`);
  } else {
    logger.error(`Message with id ${id} could not be delivered`);
  }
}

const extractMessageContent = (message) => {
  if (message.encryption == messagesService.MessageContentEncryption.encrypted_custom_encryption_password) {
    const decryptionUrl = buildMessageBodyDecryptionUrl(message.encryptionPayload);
    return {
      content: util.format(systemSettings.message.customEncryptionBodyFormat,
        decryptionUrl, message.customEncryptionPasswordHint),
      telegramContent: util.format(systemSettings.message.customEncryptionBodyFormat,
        formatLinkUsingHTML(decryptionUrl), message.customEncryptionPasswordHint),
      telegramParseMode: 'HTML'
    };
  } else {
    return {
      content: message.content,
      telegramContent: message.content,
      telegramParseMode: message.destinations?.telegram?.parseMode
    };
  }
}

function buildMessageBodyDecryptionUrl(encryptionPayload) {
  return `${systemSettings.checkin.serverUrl}/messages/decrypt/${encryptionPayload}`
}

function formatLinkUsingHTML(link) {
  return `<a href="${link}">${link}</a>`;
}

module.exports = {
  sendMessages,
};

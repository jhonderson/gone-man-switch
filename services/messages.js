const { getDb } = require('../db/sqlite');

const emailsService = require('./delivery/emails');
const smsService = require('./delivery/sms');
const encryptionService = require('../services/encryption');
const systemSettings = require('../services/system').getSystemSettings();

const MessageContentEncryption = {
  unencrypted: 'unencrypted',
  encrypted_system_encryption_password: 'encrypted_system_encryption_password',
  encrypted_custom_encryption_password: 'encrypted_custom_encryption_password'
};

const createMessage = async ({userId, content, encryption, customEncryptionPassword, customEncryptionPasswordHint, checkinFrequencyDays, checkinWaitingDays, destinations }) => {
  validateDestinations(destinations);

  let attachmentContent = undefined;
  let attachmentName = undefined;
  if (destinations.email) {
    attachmentContent = destinations.email.attachmentContent;
    attachmentName = destinations.email.attachmentName;
    // Prevent serialization of attachment fields in destinations field
    delete destinations.email['attachmentContent'];
    delete destinations.email['attachmentName'];
    delete destinations.email['attachmentSize'];
  }
  if (encryption == MessageContentEncryption.encrypted_system_encryption_password
    && !systemSettings.message.encryptionPassword) {
    throw new Error('System encryption password cannot be used because there is no message encryption password configured at the system level');
  }

  await getDb().run(`INSERT INTO messages(id, user_id, content, encryption, custom_encryption_pass_hint,
                        attachment_content, attachment_name, checkin_frequency_days, checkin_waiting_days, destinations)
                     VALUES (:id, :user_id, :content, :encryption, :custom_encryption_pass_hint,
                        :attachment_content, :attachment_name, :checkin_frequency_days, :checkin_waiting_days, :destinations)`, {
    ':id': require('crypto').randomUUID(),
    ':user_id': userId,
    ':content': encryptMessageContent(content, encryption, customEncryptionPassword),
    ':encryption': encryption,
    ':custom_encryption_pass_hint': encryption == MessageContentEncryption.encrypted_custom_encryption_password ? customEncryptionPasswordHint : undefined,
    ':attachment_content': attachmentContent,
    ':attachment_name': attachmentName,
    ':checkin_frequency_days': checkinFrequencyDays,
    ':checkin_waiting_days': checkinWaitingDays,
    ':destinations': JSON.stringify(destinations),
    });
}

const getMessage = async (id) => {
  return parseMessage(await getDb().get(`SELECT id, user_id AS userId,
      content, encryption, custom_encryption_pass_hint AS customEncryptionPasswordHint,
      attachment_content AS attachmentContent, attachment_name AS attachmentName,
      checkin_frequency_days AS checkinFrequencyDays, checkin_waiting_days AS checkinWaitingDays, destinations
    FROM messages WHERE id = ?;`, id));
}

const deleteMessage = async (id) => {
  await getDb().run('DELETE FROM messages WHERE id = ?', id);
}

const updateMessage = async ({ id, content, encryption, customEncryptionPassword, customEncryptionPasswordHint, checkinFrequencyDays, checkinWaitingDays, destinations }) => {
  validateDestinations(destinations);

  let attachmentContent = undefined;
  let attachmentName = undefined;
  if (destinations.email) {
    attachmentContent = destinations.email.attachmentContent;
    attachmentName = destinations.email.attachmentName;
    // Prevent serialization of attachment fields in destinations field
    delete destinations.email['attachmentContent'];
    delete destinations.email['attachmentName'];
    delete destinations.email['attachmentSize'];
  }
  if (encryption == MessageContentEncryption.encrypted_system_encryption_password
    && !systemSettings.message.encryptionPassword) {
    throw new Error('System encryption password cannot be used because there is no message encryption password configured at the system level');
  }
  if (!content) {
    if (encryption != MessageContentEncryption.encrypted_custom_encryption_password) {
      throw new Error('Message content is required');
    }
    const { encryption: currentMessageEncryption } = await getDb().get(`SELECT encryption FROM messages WHERE id = ?;`, id);
    if (currentMessageEncryption != MessageContentEncryption.encrypted_custom_encryption_password) {
      throw new Error('Message content is required');
    }
    // Message content is allowed to be empty only when updating a message with custom encryption password,
    // in which case the content field won't be updated in the database
  }
  const shouldOverrideContent = !!content;
  // Attachment fields will be overriden if there is a new attachment
  // or there is no email destination (to force attachment removal when the user
  // removes email as a destination)
  const shouldOverrideAttachmentFields = !!attachmentContent || !destinations.email;
  await getDb().run(`
    UPDATE messages
    SET
      ${shouldOverrideContent ? "content = :content,": ""}
      encryption = :encryption, custom_encryption_pass_hint = :custom_encryption_pass_hint,
      ${shouldOverrideAttachmentFields ? "attachment_content = :attachment_content, attachment_name = :attachment_name,": ""}
      checkin_frequency_days = :checkin_frequency_days, checkin_waiting_days = :checkin_waiting_days,
      destinations = :destinations
    WHERE id = :id`,
    {
      ':id': id,
      ':content': content ? encryptMessageContent(content, encryption, customEncryptionPassword) : undefined,
      ':encryption': encryption,
      ':custom_encryption_pass_hint': encryption == MessageContentEncryption.encrypted_custom_encryption_password ? customEncryptionPasswordHint : undefined,
      ':attachment_content': attachmentContent,
      ':attachment_name': attachmentName,
      ':checkin_frequency_days': checkinFrequencyDays,
      ':checkin_waiting_days': checkinWaitingDays,
      ':destinations': JSON.stringify(destinations),
    });
}

/**
 * Returns an array of messages ready to be delivered. A message is ready to be delivered
 * when 1) the number of days of absence of its associated user are greater than the
 * message check-in frequency days and 2) there is at least one pending check-in
 * notification with age days greater than the message check-in waiting days
 */
const getMessagesReadyToBeDelivered = async () => {
  const messages = await getDb().all(`
    SELECT DISTINCT messages.id, messages.user_id AS userId, messages.content, messages.encryption,
      messages.custom_encryption_pass_hint AS customEncryptionPasswordHint,
      messages.attachment_content AS attachmentContent, messages.attachment_name AS attachmentName,
      messages.destinations
    FROM checkin_notifications
      INNER JOIN users
        ON checkin_notifications.user_id = users.id
      INNER JOIN messages
        ON users.id = messages.user_id
    WHERE
      (julianday('now') - julianday(users.last_checkin_at)) > messages.checkin_frequency_days
      AND (julianday('now') - julianday(checkin_notifications.sent_at)) > messages.checkin_waiting_days`);
  return messages
    .map(message => parseMessage(message));
}

const getMessagesByUserId = async (userId) => {
  const userMessages = await getDb().all(`
    SELECT id, content, encryption,
      attachment_content AS attachmentContent, attachment_name AS attachmentName,
      destinations
    FROM messages
    WHERE user_id = ?;`, userId);
  return userMessages
    .map(message => parseMessage(message));
}

const isAttachmentSizeSupported = (attachmentSize) => {
  return attachmentSize <= systemSettings.message.maxAttachmentSizeInMB * 1000 * 1000;
}

const encryptMessageContent = (content, encryption, customEncryptionPassword) => {
  switch(encryption) {
    case MessageContentEncryption.encrypted_system_encryption_password:
      return encryptionService.encrypt(content, systemSettings.message.encryptionPassword);
    case MessageContentEncryption.encrypted_custom_encryption_password:
      return encryptionService.encrypt(content, customEncryptionPassword);
    default:
      return content;
  }
}

const generateMessageContentEncryptionPayload = (encryptedBody) => {
  return Buffer.from(encryptedBody).toString('base64');
}

const decryptMessageContentFromEncryptionPayload = (encryptionPayload, encryptionPassword) => {
  const encryptedContent = Buffer.from(encryptionPayload, 'base64').toString('ascii');
  return encryptionService.decrypt(encryptedContent, encryptionPassword);
}

const parseMessage = (message) => {
  if (!message) {
    return message;
  }
  return parseJSONFields(decryptMessageContent(message));
}

const decryptMessageContent = (message) => {
  if (message) {
    if (message.encryption == MessageContentEncryption.encrypted_system_encryption_password) {
      try {
        return {
          ...message,
          content: encryptionService.decrypt(message.content, systemSettings.message.encryptionPassword)
        };
      } catch (err) {
        return {
          ...message,
          // Error decrypting message body, most likely user changed the system message encryption password
          content: undefined,
        };
      }
    } else if (message.encryption == MessageContentEncryption.encrypted_custom_encryption_password) {
      return {
        ...message,
        content: undefined,
        encryptionPayload: generateMessageContentEncryptionPayload(message.content)
      };
    }
  }
  return message;
}

const parseJSONFields = (message) => {
  if (!message) {
    return message;
  }
  const destinations = JSON.parse(message.destinations);
  if (message.attachmentContent) {
    destinations.email = destinations.email || {};
    destinations.email.attachmentContent = message.attachmentContent;
    destinations.email.attachmentName = message.attachmentName;
    delete message['attachmentContent'];
    delete message['attachmentName'];
  }
  return {
    ...message,
    destinations
  };
}

const validateDestinations = (destinations) => {
  if (!isThereAtLeastOneDestination(destinations)) {
    throw new Error('At least one message destination is required');
  }
  if (destinations.email) {
    if (destinations.email.recipients
      && !emailsService.areEmailRecipientsValid(destinations.email.recipients)) {
      throw new Error('Invalid email recipients');
    }
    if (destinations.email.attachmentContent && !isAttachmentSizeSupported(destinations.email.attachmentSize)) {
      throw new Error(`Invalid attachment file size, max supported size is ${systemSettings.message.maxAttachmentSizeInMB}MB`);
    }
  }
  if (destinations.sms) {
    if (!smsService.getSupportedServiceProviders().includes(destinations.sms.serviceProvider)) {
      throw new Error(`SMS Service provider is not supported: ${destinations.sms.serviceProvider}`);
    }
  }
}

const isThereAtLeastOneDestination = (destinations) => {
  if (!destinations || !Object.keys(destinations).length) {
    return false;
  }
  const validEmailDestinationFound = destinations.email
    && destinations.email.recipients
    && destinations.email.subject;
  const validSMSDestinationFound = destinations.sms
    && destinations.sms.serviceProvider
    && destinations.sms.phoneNumbers;
  const validTelegramDestinationFound = destinations.telegram
    && destinations.telegram.chatIds;
  return validEmailDestinationFound || validSMSDestinationFound || validTelegramDestinationFound;
}

module.exports = {
  MessageContentEncryption,
  createMessage,
  getMessage,
  deleteMessage,
  updateMessage,
  getMessagesReadyToBeDelivered,
  getMessagesByUserId,
  decryptMessageContentFromEncryptionPayload,
}

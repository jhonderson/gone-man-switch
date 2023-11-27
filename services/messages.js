const { getDb } = require('../db/sqlite');

const emailsService = require('../services/emails');
const encryptionService = require('../services/encryption');
const systemSettings = require('../services/system').getSystemSettings();

const MessageCheckinStatus = {
  checked_in: 'checked_in',
  checkin_notification_sent: 'checkin_notification_sent'
};

const MessageBodyEncryption = {
  unencrypted: 'unencrypted',
  encrypted_system_encryption_password: 'encrypted_system_encryption_password',
  encrypted_custom_encryption_password: 'encrypted_custom_encryption_password'
};

const createMessage = async ({userId, recipients, subject, body, encryption, customEncryptionPassword, customEncryptionPasswordHint, attachmentName, attachmentSize, attachmentContent, checkinFrequencyDays, checkinWaitingDays}) => {
  if (!emailsService.areEmailRecipientsValid(recipients)) {
    throw new Error('Invalid email recipients');
  }
  if (attachmentContent && !isAttachmentSizeSupported(attachmentSize)) {
    throw new Error(`Invalid attachment file size, max supported size is ${systemSettings.message.maxAttachmentSizeInMB}MB`);
  }
  if (encryption == MessageBodyEncryption.encrypted_system_encryption_password
    && !systemSettings.message.encryptionPassword) {
    throw new Error('System encryption password cannot be used because there is no message encryption password configured at the system level');
  }
  await getDb().run(`INSERT INTO messages(id, user_id, recipients, subject, body, encryption, custom_encryption_pass_hint,
                        attachment_name, attachment_content, checkin_status, checkin_frequency_days, checkin_waiting_days, last_checkin_at)
                     VALUES (:id, :user_id, :recipients, :subject, :body, :encryption, :custom_encryption_pass_hint, :attachment_name,
                        :attachment_content, :checkin_status, :checkin_frequency_days, :checkin_waiting_days, :last_checkin_at)`, {
    ':id': require('crypto').randomUUID(),
    ':user_id': userId,
    ':recipients': recipients,
    ':subject': subject,
    ':body': encryptMessageBody(body, encryption, customEncryptionPassword),
    ':encryption': encryption,
    ':custom_encryption_pass_hint': encryption == MessageBodyEncryption.encrypted_custom_encryption_password ? customEncryptionPasswordHint : undefined,
    ':attachment_name': attachmentName,
    ':attachment_content': attachmentContent,
    ':checkin_status': MessageCheckinStatus.checked_in,
    ':checkin_frequency_days': checkinFrequencyDays,
    ':checkin_waiting_days': checkinWaitingDays,
    ':last_checkin_at': new Date().toISOString()
    });
}

const getMessage = async (id) => {
  return decryptMessage(await getDb().get(`SELECT id, user_id AS userId, recipients,
      subject, body, encryption, custom_encryption_pass_hint AS customEncryptionPasswordHint,
      attachment_name AS attachmentName, attachment_content AS attachmentContent,
      checkin_frequency_days AS checkinFrequencyDays, checkin_waiting_days AS checkinWaitingDays
    FROM messages WHERE id = ?;`, id));
}

const deleteMessage = async (id) => {
  await getDb().run('DELETE FROM messages WHERE id = ?', id);
}

const updateMessage = async ({id, recipients, subject, body, encryption, customEncryptionPassword, customEncryptionPasswordHint, attachmentName, attachmentSize, attachmentContent, checkinFrequencyDays, checkinWaitingDays}) => {
  if (!emailsService.areEmailRecipientsValid(recipients)) {
    throw new Error('Invalid email recipients');
  }
  if (attachmentContent && !isAttachmentSizeSupported(attachmentSize)) {
    throw new Error(`Invalid attachment file size, max supported size is ${systemSettings.message.maxAttachmentSizeInMB}MB`);
  }
  if (encryption == MessageBodyEncryption.encrypted_system_encryption_password
    && !systemSettings.message.encryptionPassword) {
    throw new Error('System encryption password cannot be used because there is no message encryption password configured at the system level');
  }
  if (!body) {
    if (encryption != MessageBodyEncryption.encrypted_custom_encryption_password) {
      throw new Error('Message body is required');
    }
    const { encryption: currentMessageEncryption } = await getDb().get(`SELECT encryption FROM messages WHERE id = ?;`, id);
    if (currentMessageEncryption != MessageBodyEncryption.encrypted_custom_encryption_password) {
      throw new Error('Message body is required');
    }
    // Message body is allowed to be empty only when updating a message with custom encryption password,
    // in which case the body field won't be updated in the database
  }
  await getDb().run(`UPDATE messages SET recipients = :recipients, subject = :subject,
                        ${body ? "body = :body,": ""}
                        encryption = :encryption, custom_encryption_pass_hint = :custom_encryption_pass_hint,
                        ${attachmentContent ? "attachment_name = :attachment_name, attachment_content = :attachment_content,": ""}
                        checkin_frequency_days = :checkin_frequency_days, checkin_waiting_days = :checkin_waiting_days
                        WHERE id = :id`,
    {
      ':id': id,
      ':recipients': recipients,
      ':subject': subject,
      ':body': body ? encryptMessageBody(body, encryption, customEncryptionPassword) : undefined,
      ':encryption': encryption,
      ':custom_encryption_pass_hint': encryption == MessageBodyEncryption.encrypted_custom_encryption_password ? customEncryptionPasswordHint : undefined,
      ':attachment_name': attachmentName,
      ':attachment_content': attachmentContent,
      ':checkin_frequency_days': checkinFrequencyDays,
      ':checkin_waiting_days': checkinWaitingDays,
    });
}

const getMessagesNeedingCheckedin = async () => {
  return getDb().all(`SELECT messages.id, messages.user_id as userId, users.email AS userEmail
    FROM messages INNER JOIN users
      ON messages.user_id = users.id
    WHERE checkin_status = '${MessageCheckinStatus.checked_in}'
      AND (julianday('now') - julianday(last_checkin_at)) > checkin_frequency_days;`);
}

const getMessagesReadyToBeDelivered = async () => {
  const messages = await getDb().all(`SELECT messages.id, messages.user_id AS userId, messages.recipients,
      messages.subject, messages.body, messages.encryption,
      messages.custom_encryption_pass_hint AS customEncryptionPasswordHint,
      messages.attachment_name AS attachmentName, messages.attachment_content AS attachmentContent,
      checkin_notifications.id AS checkinNotificationId
    FROM checkin_notifications INNER JOIN messages
      ON checkin_notifications.message_id = messages.id
    WHERE messages.checkin_status = '${MessageCheckinStatus.checkin_notification_sent}'
      AND (julianday('now') - julianday(checkin_notifications.sent_at)) > messages.checkin_waiting_days;`);
  return messages.map(message => decryptMessage(message));
}

const updateMessageCheckinStatus = async (id, newStatus) => {
  if (newStatus == MessageCheckinStatus.checked_in) {
    await getDb().run("UPDATE messages SET checkin_status = ?, last_checkin_at = ? WHERE id = ?",
      MessageCheckinStatus.checked_in, new Date().toISOString(), id);
  } else if (Object.keys(MessageCheckinStatus).includes(newStatus)) {
    await getDb().run("UPDATE messages SET checkin_status = ? WHERE id = ?", newStatus, id);
  } else {
    throw new Error(`Invalid message checkin status provided: ${newStatus}, see valid values: ${Object.keys(MessageCheckinStatus)}`);
  }
}

const getMessagesByUserId = async (userId) => {
  return getDb().all(`SELECT id, recipients, subject
                      FROM messages
                      WHERE user_id = ?;`, userId);
}

const isAttachmentSizeSupported = (attachmentSize) => {
  return attachmentSize <= systemSettings.message.maxAttachmentSizeInMB * 1000 * 1000;
}

const encryptMessageBody = (body, encryption, customEncryptionPassword) => {
  switch(encryption) {
    case MessageBodyEncryption.encrypted_system_encryption_password:
      return encryptionService.encrypt(body, systemSettings.message.encryptionPassword);
    case MessageBodyEncryption.encrypted_custom_encryption_password:
      return encryptionService.encrypt(body, customEncryptionPassword);
    default:
      return body;
  }
}

const decryptMessage = (message) => {
  if (message) {
    if (message.encryption == MessageBodyEncryption.encrypted_system_encryption_password) {
      try {
        return {
          ...message,
          body: encryptionService.decrypt(message.body, systemSettings.message.encryptionPassword)
        };
      } catch (err) {
        return {
          ...message,
          // Error decrypting message body, most likely user changed the system message encryption password
          body: undefined,
        };
      }
    } else if (message.encryption == MessageBodyEncryption.encrypted_custom_encryption_password) {
      return {
        ...message,
        body: undefined,
        encryptionPayload: generateMessageBodyEncryptionPayload(message.body)
      };
    }
  }
  return message;
}

const generateMessageBodyEncryptionPayload = (encryptedBody) => {
  return Buffer.from(encryptedBody).toString('base64');
}

const decryptMessageBodyFromEncryptionPayload = (encryptionPayload, encryptionPassword) => {
  const encryptedBody = Buffer.from(encryptionPayload, 'base64').toString('ascii');
  return encryptionService.decrypt(encryptedBody, encryptionPassword);
}

module.exports = {
  MessageCheckinStatus,
  MessageBodyEncryption,
  createMessage,
  getMessage,
  deleteMessage,
  updateMessage,
  getMessagesNeedingCheckedin,
  getMessagesReadyToBeDelivered,
  updateMessageCheckinStatus,
  getMessagesByUserId,
  decryptMessageBodyFromEncryptionPayload,
}

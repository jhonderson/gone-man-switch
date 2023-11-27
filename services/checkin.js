const { getDb } = require('../db/sqlite');
const messagesService = require('./messages');

const createCheckinNotificationForMessage = async (message_id) => {
  const notificationId = require('crypto').randomBytes(64).toString('hex');
  await getDb().run('INSERT INTO checkin_notifications(id, message_id, sent_at) VALUES (:id, :message_id, :sent_at)', {
    ':id': notificationId,
    ':message_id': message_id,
    ':sent_at': new Date().toISOString()
  });
  return notificationId;
}

const getCheckinNotification = async (id) => {
  return getDb().get('SELECT id, message_id AS messageId FROM checkin_notifications WHERE id = ?', id);
}

const doCheckin = async (checkinNotificationId) => {
  const notification = await getCheckinNotification(checkinNotificationId);
  if (!notification) {
    return false;
  }
  await deleteCheckinNotification(notification.id);
  await messagesService.updateMessageCheckinStatus(notification.messageId, messagesService.MessageCheckinStatus.checked_in);
  return true;
}

const deleteCheckinNotification = async (id) => {
  await getDb().run('DELETE FROM checkin_notifications WHERE id = ?', id);
}

const isThereAnActiveCheckinNotificationForMessage = async (messageId) => {
  const existingNotification = await getDb().get('SELECT id FROM checkin_notifications WHERE message_id = ?', messageId);
  return !!existingNotification;
}

module.exports = {
  createCheckinNotificationForMessage,
  doCheckin,
  deleteCheckinNotification,
  getCheckinNotification,
  isThereAnActiveCheckinNotificationForMessage
}

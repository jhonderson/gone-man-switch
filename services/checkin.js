const { getDb } = require('../db/sqlite');
const usersService = require('./users');

/**
 * Return a list of users needing check-in. A user needs check-in if 1) it
 * has at least one message for which the check-in frequency days is
 * lower than its days of absence, and 2) has no pending check-in notifications
 */
const getUsersNeedingCheckin = async () => {
  return getDb().all(`
    SELECT DISTINCT users.id AS id, users.email AS email
    FROM users
      INNER JOIN messages
        ON users.id = messages.user_id
      LEFT OUTER JOIN checkin_notifications
        ON users.id = checkin_notifications.user_id
    WHERE checkin_notifications.id IS NULL
      AND (julianday('now') - julianday(users.last_checkin_at)) > messages.checkin_frequency_days`);
}

const createCheckinNotificationForUser = async (userId) => {
  const notificationId = require('crypto').randomBytes(64).toString('hex');
  await getDb().run('INSERT INTO checkin_notifications(id, user_id, sent_at) VALUES (:id, :user_id, :sent_at)', {
    ':id': notificationId,
    ':user_id': userId,
    ':sent_at': new Date().toISOString()
  });
  return notificationId;
}

/**
 * Given a notification id, it retrieves its associated user, updates the
 * its last checkin timestamp, and delete the check-in notifications
 */
const doCheckin = async (checkinNotificationId) => {
  const notification = await getDb().get('SELECT user_id AS userId FROM checkin_notifications WHERE id = ?', checkinNotificationId);
  if (!notification) {
    return false;
  }
  await usersService.updateUserLastCheckin(notification.userId);
  await deleteCheckinNotification(checkinNotificationId);
  return true;
}

/**
 * Given an user id, it updates the user last checkin timestamp, and delete
 * its pending check-in notifications
 */
const doCheckinByUserId = async (userId) => {
  await usersService.updateUserLastCheckin(userId);
  await getDb().run('DELETE FROM checkin_notifications WHERE user_id = ?', userId);
}

const deleteCheckinNotification = async (id) => {
  await getDb().run('DELETE FROM checkin_notifications WHERE id = ?', id);
}

/**
 * Delete the check-in notifications of users with no more messages to deliver
 */
const deleteOrphanCheckinNotifications = async () => {
  const orphanNotifications = await getDb().all(`
    SELECT checkin_notifications.id AS id
    FROM checkin_notifications
      LEFT JOIN messages
        ON checkin_notifications.user_id = messages.user_id
    WHERE messages.user_id IS NULL`);
  for (const { id } of orphanNotifications) {
    await deleteCheckinNotification(id);
  }
}

module.exports = {
  getUsersNeedingCheckin,
  createCheckinNotificationForUser,
  doCheckin,
  doCheckinByUserId,
  deleteCheckinNotification,
  deleteOrphanCheckinNotifications,
}

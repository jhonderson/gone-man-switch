const { isSMTPConfigurationPresent, sendEmail } = require("../services/emails");
const util = require('util');
const logger = require('../logger');

const checkinService = require("../services/checkin");
const systemSettings = require('../services/system').getSystemSettings();

const sendCheckinNotifications = async () => {
  logger.debug('[checkin-notifications] starting...');
  if (!isSMTPConfigurationPresent()) {
    logger.error("SMTP configuration is not complete, aborting job since the system won't be able to send check-in notifications");
    return;
  }
  const usersNeedingCheckin = await checkinService.getUsersNeedingCheckin();
  for (const user of usersNeedingCheckin) {
    await sendMessageCheckinNotification(user);
  }
  logger.debug('[checkin-notifications] done');
}

const sendMessageCheckinNotification = async ({ id, email }) => {
  if (!email) {
    logger.error(`Notification for user with id ${id} cannot be sent because the associated user has no email configured`);
    return;
  }
  const checkinNotificationId = await checkinService.createCheckinNotificationForUser(id);
  try {
    await sendEmail({
      recipients: email,
      subject:  systemSettings.checkin.email.subject,
      body: util.format(systemSettings.checkin.email.bodyFormat, buildCheckinUrl(checkinNotificationId))
    });
  } catch (err) {
    logger.error(`Error sending checkin notification: ${err.message}`);
    await checkinService.deleteCheckinNotification(checkinNotificationId);
    return;
  }
  logger.info(`Notification sent succesfully for user with id ${id}`);
}

function buildCheckinUrl(checkinNotificationId) {
  return `${systemSettings.checkin.serverUrl}/checkin/${checkinNotificationId}`
}

module.exports = {
  sendCheckinNotifications,
};

const { isSMTPConfigurationPresent, sendEmail } = require("../services/emails");
const util = require('util');
const logger = require('../logger');
const messagesService = require("../services/messages");
const checkinService = require("../services/checkin");

const systemSettings = require('../services/system').getSystemSettings();

const sendCheckinNotifications = async () => {
  logger.debug('[checkin-notifications] starting...');
  if (!isSMTPConfigurationPresent()) {
    logger.error("SMTP configuration is not complete, aborting job since the system won't be able to send check-in notifications");
    return;
  }
  const messagesNeedingCheckin = await messagesService.getMessagesNeedingCheckedin();
  for (const message of messagesNeedingCheckin) {
    await sendMessageCheckinNotification(message);
  }
  logger.debug('[checkin-notifications] done');
}

const sendMessageCheckinNotification = async (message) => {
  if (await checkinService.isThereAnActiveCheckinNotificationForMessage(message.id)) {
    await messagesService.updateMessageCheckinStatus(message.id, 'checkin_notification_sent');
    logger.debug(`Notification already sent for message with id ${message.id}`);
    return;
  }
  if (!message.userEmail) {
    logger.error(`Notification for message with id ${message.id} cannot be sent because the associated user has no email configured`);
    return;
  }
  const checkinNotificationId = await checkinService.createCheckinNotificationForMessage(message.id);
  try {
    await sendEmail({
      recipients: message.userEmail,
      subject:  systemSettings.checkin.email.subject,
      body: util.format(systemSettings.checkin.email.bodyFormat, buildCheckinUrl(checkinNotificationId))
    });
  } catch (err) {
    logger.error(`Error sending checkin notification: ${err.message}`);
    await checkinService.deleteCheckinNotification(checkinNotificationId);
    return;
  }
  await messagesService.updateMessageCheckinStatus(message.id, 'checkin_notification_sent');
  logger.info(`Notification sent succesfully for message with id ${message.id}`);
}

function buildCheckinUrl(checkinNotificationId) {
  return `${systemSettings.checkin.serverUrl}/checkin/${checkinNotificationId}`
}

module.exports = {
  sendCheckinNotifications,
};

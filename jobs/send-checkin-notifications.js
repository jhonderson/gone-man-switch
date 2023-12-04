const util = require('util');
const logger = require('../logger');

const checkinService = require("../services/checkin");
const usersService = require("../services/users");
const deliveryService = require("../services/delivery/delivery");
const systemSettings = require('../services/system').getSystemSettings();

const sendCheckinNotifications = async () => {
  logger.debug('[checkin-notifications] starting...');
  const usersNeedingCheckin = await checkinService.getUsersNeedingCheckin();
  for (const user of usersNeedingCheckin) {
    await sendMessageCheckinNotification(user);
  }
  logger.debug('[checkin-notifications] done');
}

const sendMessageCheckinNotification = async ({ id }) => {
  const { settings: userSettings, checkinDestinations: destinations } = await usersService.getUser(id);
  const checkinNotificationId = await checkinService.createCheckinNotificationForUser(id);
  const notificationContent = util.format(systemSettings.checkin.email.bodyFormat, buildCheckinUrl(checkinNotificationId));

  let notificationDelivered = false;
  if (destinations.email) {
    try {
      await deliveryService.sendMessageByEmail(userSettings.smtp || systemSettings.smtp, {
          ...destinations.email,
          subject: systemSettings.checkin.email.subject
        }, notificationContent);
      notificationDelivered = true;
    } catch(err) {
      logger.error(`Error delivering check-in notification by email: ${err.message}`);
    }
  }
  if (destinations.sms) {
    try {
      await deliveryService.sendMessageBySMS(userSettings.sms, destinations.sms, notificationContent);
      notificationDelivered = true;
    } catch(err) {
      logger.error(`Error delivering check-in notification by SMS: ${err.message}`);
    }
  }
  if (destinations.telegram) {
    const htmlFormattedNotificationContent = util.format(systemSettings.checkin.email.bodyFormat,
      formatLinkUsingHTML(buildCheckinUrl(checkinNotificationId)));
    try {
      await deliveryService.sendMessageByTelegram(userSettings.telegram, {
          ...destinations.telegram,
          parseMode: 'HTML'
        }, htmlFormattedNotificationContent);
      notificationDelivered = true;
    } catch(err) {
      logger.error(`Error delivering check-in notification by Telegram: ${err.message}`);
    }
  }

  if (!notificationDelivered) {
    logger.error(`Check-in notification for message with id ${id} could not be delivered`);
    await checkinService.deleteCheckinNotification(checkinNotificationId);
  } else {
    logger.info(`Notification sent succesfully for user with id ${id}`);
  }
}

function buildCheckinUrl(checkinNotificationId) {
  return `${systemSettings.checkin.serverUrl}/checkin/${checkinNotificationId}`
}

function formatLinkUsingHTML(link) {
  return `<a href="${link}">${link}</a>`;
}

module.exports = {
  sendCheckinNotifications,
};

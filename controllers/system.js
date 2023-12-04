const asyncHandler = require("express-async-handler");
const systemService = require('../services/system');

const systemSettings = sanitizeSystemSettings();

exports.viewSystemSettings = asyncHandler(async (req, res, next) => {
  res.render('system', {title: 'System', ...systemSettings });
});

function sanitizeSystemSettings() {
  const settings = systemService.getSystemSettings();
  // Using a take-what-you-need approach to prevent leaking
  // sensitive information now and in the future
  return {
    smtp: {
      host: settings.smtp.host,
      port: settings.smtp.port,
      secure: settings.smtp.secure,
      from: settings.smtp.from,
      username: settings.smtp.username,
      authMechanism: settings.smtp.authMechanism,
    },
    sqlite: {
      path: settings.sqlite.path
    },
    checkin: {
      serverUrl: settings.checkin.serverUrl,
      checkinNotificationsJobCron: settings.checkin.checkinNotificationsJobCron,
      messagesJobCron: settings.checkin.messagesJobCron,
    }
  };
}

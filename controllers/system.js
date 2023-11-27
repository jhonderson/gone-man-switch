const asyncHandler = require("express-async-handler");
const systemService = require('../services/system');
const emailsService = require('../services/emails');
const usersService = require('../services/users');

const systemSettings = sanitizeSystemSettings();

exports.viewSystemSettings = asyncHandler(async (req, res, next) => {
  res.render('system', {title: 'System', ...systemSettings });
});

exports.sendTestEmail = asyncHandler(async (req, res, next) => {
  const respose = { title: 'System', ...systemSettings };
  const { email } = await usersService.getUser(req.session.userId);
  try {
    await emailsService.sendTestEmail(email);
    respose.testEmailSentSuccessfully = true;
  } catch (err) {
    respose.errorSendingTestEmail = err.message;
  }
  res.render('system', respose);
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

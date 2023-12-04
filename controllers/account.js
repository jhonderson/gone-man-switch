const asyncHandler = require("express-async-handler");
const usersService = require('../services/users');
const deliveryService = require('../services/delivery/delivery');

const systemSettings = require('../services/system').getSystemSettings();
const { body, validationResult } = require('express-validator');

exports.startLogin = asyncHandler(async (req, res, next) => {
  res.render('login', { title: 'Login' });
});

exports.login = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('login', { title: 'Login', username: req.body.username, errors: validationResults.errors.map(error => error.msg) });
    return;
  }
  const user = await usersService.getUserByUsernameAndPassword(req.body.username, req.body.password);
  if (user) {
    req.session.loggedin = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.redirect('/');
  } else {
    res.render('login', { title: 'Login', username: req.body.username, errors: ['No user found with the provided credentials'] });
  }
});

exports.logout = asyncHandler(async (req, res, next) => {
  req.session.loggedin = false;
  req.session.username = null;
  req.session.role = null;
  req.session.userId = null;
  req.session.lastCheckinAt = null;
  req.session = null;
  res.redirect('/account/login');
});

exports.editAccount = asyncHandler(async (req, res, next) => {
  const user = await getUserInformationForDisplay(req.session.userId);
  if (user) {
    res.render('account', { title: 'Account', user });
  } else {
    res.redirect('/account/logout');
  }
});

exports.updateAccount = asyncHandler(async (req, res, next) => {
  const user = await getUserInformationForDisplay(req.session.userId);
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('account', {
      title: 'Account',
      user,
      errorsUpdatingAccount: validationResults.errors.map(error => error.msg)
    });
    return;
  }
  try {
    await usersService.updateUser({
      id: req.session.userId,
      username: req.body.username,
      email: req.body.email,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      passwordConfirmation: req.body.passwordConfirmation,
      // Role changing not allowed in this operation
      role: user.role
    });
    req.session.username = req.body.username;
    res.redirect('/account');
  } catch (err) {
    res.render('account', {
      title: 'Account',
      user,
      errorsUpdatingAccount: [err.message]
    });
  }
});

exports.updateCheckinDestinations = asyncHandler(async (req, res, next) => {
  const checkinDestinations = parseDestinations(req);
  try {
    await usersService.updateUserCheckinDestinations(req.session.userId, checkinDestinations);
  } catch (err) {
    res.render('account', {
      title: 'Account',
      user: await getUserInformationForDisplay(req.session.userId),
      errorsUpdatingCheckinDestinations: [err.message]
    });
    return;
  }
  res.redirect('/account');
});

exports.updateSettings = asyncHandler(async (req, res, next) => {
  const settings = parseSettings(req);
  try {
    await usersService.updateUserSettings(req.session.userId, settings);
  } catch (err) {
    res.render('account', {
      title: 'Account',
      user: await getUserInformationForDisplay(req.session.userId),
      errorsUpdatingSettings: [err.message]
    });
    return;
  }
  res.redirect('/account');
});

exports.sendTestEmail = asyncHandler(async (req, res, next) => {
  sendTestMessageCommonHandler(req, res, async (user) => {
    await deliveryService.sendMessageByEmail(user.settings.smtp || systemSettings.smtp,
      {
        recipients: req.body.testEmailRecipients,
        subject: "Gone Man's Switch - Test Email"
      }, "Hello,\n\nIt looks like your SMTP configuration is correct!\n\nCheers");
    return `Email test message sent succesfully using ${user.settings.smtp?
      'account-level': 'environment-variable'} SMTP settings`;
  });
});

exports.sendTestSMSMessage = asyncHandler(async (req, res, next) => {
  sendTestMessageCommonHandler(req, res, async (user) => {
    await deliveryService.sendMessageBySMS(user.settings.sms,
      {
        serviceProvider: req.body.testSMSServiceProvider,
        phoneNumbers: req.body.testSMSPhoneNumbers
      }, "Hello,\n\nIt looks like your SMS configuration is correct!\n\nCheers,\nGone Man's Switch");
    return "SMS test message sent succesfully";
  });
});

exports.sendTestTelegramMessage = asyncHandler(async (req, res, next) => {
  sendTestMessageCommonHandler(req, res, async (user) => {
    await deliveryService.sendMessageByTelegram(user.settings.telegram,
      {
        chatIds: req.body.testTelegramChatIds
      }, "Hello,\n\nIt looks like your Telegram configuration is correct!\n\nCheers,\nGone Man's Switch");
    return "Telegram test message sent succesfully";
  });
});

const sendTestMessageCommonHandler = async (req, res, senderFunction) => {
  const user = await getUserInformationForDisplay(req.session.userId);
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('account', {
      title: 'Account',
      user,
      errorSendingTestMessage: validationResults.errors.map(error => error.msg)
    });
    return;
  }
  let errorSendingTestMessage, testMessageResult;
  try {
    testMessageResult = await senderFunction(user);
  } catch (err) {
    errorSendingTestMessage = [err.message];
  }
  res.render('account', {
    title: 'Account',
    user,
    testMessageResult,
    errorSendingTestMessage,
  });
}

const getUserInformationForDisplay = async (id) => {
  const user = await usersService.getUser(id);
  if (user) {
    const flattenedDestinationFields = flatDestinations(user.checkinDestinations);
    const flattenedSettingsFields = flatSettings(user.settings);
    return {
      ...user,
      ...flattenedDestinationFields,
      ...flattenedSettingsFields,
    };
  }
  return undefined;
}

const flatDestinations = (destinations) => {
  const flattenedDestinationFields = {
    hasEmailDestination: !!destinations.email,
    hasSMSDestination: !!destinations.sms,
    hasTelegramDestination: !!destinations.telegram,
  };
  if (destinations.email) {
    flattenedDestinationFields.emailRecipients = destinations.email.recipients;
  }
  if (destinations.sms) {
    flattenedDestinationFields.smsServiceProvider = destinations.sms.serviceProvider;
    flattenedDestinationFields.smsPhoneNumbers = destinations.sms.phoneNumbers;
  }
  if (destinations.telegram) {
    flattenedDestinationFields.telegramChatIds = destinations.telegram.chatIds;
  }
  return flattenedDestinationFields;
}

const flatSettings = (settings) => {
  const flattenedSettingsFields = {
    hasSMTPPassword: false,
    hasTwilioAuthToken: false,
    hasTelegramBotToken: false,
  };
  if (settings.smtp) {
    flattenedSettingsFields.smtpHost = settings.smtp.host;
    flattenedSettingsFields.smtpPort = settings.smtp.port;
    flattenedSettingsFields.smtpSecure = settings.smtp.secure;
    flattenedSettingsFields.smtpFrom = settings.smtp.from;
    flattenedSettingsFields.smtpUsername = settings.smtp.username;
    flattenedSettingsFields.hasSMTPPassword = !!settings.smtp.password;
    flattenedSettingsFields.smtpAuthMechanism = settings.smtp.authMechanism;
  }
  if (settings.sms && settings.sms.twilio) {
    flattenedSettingsFields.twilioAccountSid = settings.sms.twilio.accountSid;
    flattenedSettingsFields.hasTwilioAuthToken = !!settings.sms.twilio.authToken;
    flattenedSettingsFields.twilioFrom = settings.sms.twilio.from;
  }
  if (settings.telegram) {
    flattenedSettingsFields.hasTelegramBotToken = !!settings.telegram.botToken;
  }
  return flattenedSettingsFields;
}

const parseDestinations = (req) => {
  const destinations = {};
  if (req.body.emailRecipients) {
    destinations.email = {
      recipients: req.body.emailRecipients
    };
  }
  if (req.body.smsPhoneNumbers) {
    destinations.sms = {
      serviceProvider: req.body.smsServiceProvider,
      phoneNumbers: req.body.smsPhoneNumbers,
    };
  }
  if (req.body.telegramChatIds) {
    destinations.telegram = {
      chatIds: req.body.telegramChatIds,
    };
  }
  return destinations;
}

const parseSettings = (req) => {
  const settings = {};
  if (req.body.smtpHost) {
    settings.smtp = {
      host: req.body.smtpHost,
      port: Number(req.body.smtpPort),
      secure: !!req.body.smtpSecure && req.body.smtpSecure == 'on',
      from: req.body.smtpFrom,
      username: req.body.smtpUsername,
      password: req.body.smtpPassword,
      authMechanism: req.body.smtpAuthMechanism,
    };
  }
  if (req.body.twilioAccountSid) {
    settings.sms = settings.sms || {};
    settings.sms.twilio = {
      accountSid: req.body.twilioAccountSid,
      authToken: req.body.twilioAuthToken,
      from: req.body.twilioFrom,
    };
  }
  if (req.body.telegramBotToken) {
    settings.telegram = {
      botToken: req.body.telegramBotToken,
    };
  }
  return settings;
}

exports.loginInputValidations = [
  body('username', "Username field is mandatory").notEmpty(),
  body('password', 'Password field is mandatory').notEmpty(),
];

exports.accountInputValidations = [
  body('username', "Username field is mandatory").notEmpty(),
];

exports.sendTestEmailInputValidations = [
  body('testEmailRecipients', "Email recipients are needed to send test email").notEmpty(),
];

exports.sendTestSMSMessageInputValidations = [
  body('testSMSServiceProvider', "SMS service provider is needed to send test SMS message").notEmpty(),
  body('testSMSPhoneNumbers', "Phone numbers are needed to send test SMS message").notEmpty(),
];

exports.sendTestTelegramMessageInputValidations = [
  body('testTelegramChatIds', "Chat ids are needed to send test Telegram message").notEmpty(),
];

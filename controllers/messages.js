const asyncHandler = require("express-async-handler");
const messagesService = require('../services/messages');
const usersService = require('../services/users');
const { body, validationResult } = require('express-validator');
const multer  = require('multer');

exports.listMessages = asyncHandler(async (req, res, next) => {
  const messages = await messagesService.getMessagesByUserId(req.session.userId);
  res.render('index', { messages });
});

exports.newMessage = asyncHandler(async (req, res, next) => {
  const user = await usersService.getUser(req.session.userId);
  res.locals.userHasNoCheckinDestination = user
    && (!user.checkinDestinations || !Object.keys(user.checkinDestinations).length);
  res.render('messages_new');
});

exports.createMessage = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('messages_new', { errors: validationResults.errors.map(error => error.msg) });
    return;
  }
  const checkinFrequencyDays = convertTimeToDays(Number(req.body.checkinFrequencyTime),
    req.body.checkinFrequencyTimeUnit);
  const checkinWaitingDays = convertTimeToDays(Number(req.body.checkinWaitingTime),
    req.body.checkinWaitingTimeUnit);
  const destinations = parseDestinations(req);
  try {
    await messagesService.createMessage({
      userId: req.session.userId,
      content: req.body.content,
      encryption: req.body.messageContentEncryption,
      customEncryptionPassword: req.body.customEncryptionPassword,
      customEncryptionPasswordHint: req.body.customEncryptionPasswordHint,
      checkinFrequencyDays,
      checkinWaitingDays,
      destinations,
    });
    res.redirect('/');
  } catch (err) {
    res.render('messages_new', { errors: [err.message] });
  }
});

exports.viewMessage = asyncHandler(async (req, res, next) => {
  const message = await getMessageInformationForDisplay(req.params.messageId);
  if (message) {
    res.render('messages_view', { message });
  } else {
    res.render('error', { title: 'Message not found', message: `There is no message with id "${req.params.messageId}"` });
  }
});

exports.downloadAttachment = asyncHandler(async (req, res, next) => {
  const message = await messagesService.getMessage(req.params.messageId);
  if (message) {
    if (message.destinations.email && message.destinations.email.attachmentContent) {
      const readStream = new (require('stream')).PassThrough();
      readStream.end(message.destinations.email.attachmentContent);
      res.set('Content-disposition', 'attachment; filename=' + message.destinations.email.attachmentName);
      res.set('Content-Type', 'text/plain');
      readStream.pipe(res);
    } else {
      res.render('error', { title: 'Attachment not found', message: 'The message has no email attachment' });
    }
  } else {
    res.render('error', { title: 'Message not found', message: `There is no message with id "${req.params.messageId}"` });
  }
});

exports.deleteMessage = asyncHandler(async (req, res, next) => {
  if (req.query.confirm == 'true') {
    await messagesService.deleteMessage(req.params.messageId);
    res.redirect('/');
  } else {
    const message = await getMessageInformationForDisplay(req.params.messageId);
    if (message) {
      res.render('messages_delete', { message });
    } else {
      res.render('error', { title: 'Message not found', message: `There is no message with id "${req.params.messageId}"` });
    }
  }
});

exports.editMessage = asyncHandler(async (req, res, next) => {
  const message = await getMessageInformationForDisplay(req.params.messageId);
  if (message) {
    res.render('messages_edit', { message });
  } else {
    res.render('error', { title: 'Message not found', message: `There is no message with id "${req.params.messageId}"` });
  }
});

exports.updateMessage = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('messages_edit', {
      message: await getMessageInformationForDisplay(req.params.messageId),
      errors: validationResults.errors.map(error => error.msg)
    });
    return;
  }
  const checkinFrequencyDays = convertTimeToDays(Number(req.body.checkinFrequencyTime), req.body.checkinFrequencyTimeUnit);
  const checkinWaitingDays = convertTimeToDays(Number(req.body.checkinWaitingTime), req.body.checkinWaitingTimeUnit);
  const destinations = parseDestinations(req);
  try {
    await messagesService.updateMessage({
      id: req.params.messageId,
      userId: req.session.userId,
      content: req.body.content,
      encryption: req.body.messageContentEncryption,
      customEncryptionPassword: req.body.customEncryptionPassword,
      customEncryptionPasswordHint: req.body.customEncryptionPasswordHint,
      checkinFrequencyDays,
      checkinWaitingDays,
      destinations,
    });
    res.redirect('/');
  } catch (err) {
    res.render('messages_edit', {
      message: await getMessageInformationForDisplay(req.params.messageId),
      errors: [err.message]
    });
  }
});

exports.initMessageDecryption = asyncHandler(async (req, res, next) => {
  res.render('messages_decrypt', { encryptionPayload: req.params.encryptionPayload });
});

exports.decryptMessage = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('messages_decrypt', {
      encryptionPayload: req.body.encryptionPayload,
      errors: validationResults.errors.map(error => error.msg)
    });
    return;
  }
  try {
    const messageContent = messagesService.decryptMessageContentFromEncryptionPayload(
      req.body.encryptionPayload, req.body.encryptionPassword);
    res.render('messages_decrypt', { messageContent });
  } catch (err) {
    res.render('messages_decrypt', {
      encryptionPayload: req.body.encryptionPayload,
      errors: ['Error decrypting message, please check the password hint and try again. Keep in mind this field is case sensitive']
    });
  }
});

const getMessageInformationForDisplay = async(id) => {
  const {attachmentContent: _, ...message} = await messagesService.getMessage(id);
  if (message) {
    const { time: checkinFrequencyTime, timeUnit: checkinFrequencyTimeUnit } = convertDaysToTime(message.checkinFrequencyDays);
    const { time: checkinWaitingTime, timeUnit: checkinWaitingTimeUnit } = convertDaysToTime(message.checkinWaitingDays);
    const errors = [];
    if (message.encryption == messagesService.MessageContentEncryption.encrypted_system_encryption_password
      && !message.content) {
      // Message content field is mandatory, so if it's not present it means there was a problem decrypting its content
      errors.push('Unable to decrypt message content, maybe the system message encryption password was changed recently?');
    }
    const flattenedDestinationFields = flatDestinations(message.destinations);
    return {
      ...message,
      ...flattenedDestinationFields,
      checkinFrequencyTime,
      checkinFrequencyTimeUnit,
      checkinWaitingTime,
      checkinWaitingTimeUnit,
      errors,
    };
  }
  return undefined;
}

const convertTimeToDays = (time, timeUnit) => {
  switch(timeUnit) {
    case 'Days':
      return time;
    case 'Months':
      return 30 * time;
    case 'Years':
      return 365 * time;
  }
}

const convertDaysToTime = (days) => {
  if (days >= 365 && days % 365 == 0) {
    return {
      time: days / 365,
      timeUnit: 'Years'
    };
  } else if (days >= 30 && days % 30 == 0) {
    return {
      time: days / 30,
      timeUnit: 'Months'
    };
  } else {
    return {
      time: days,
      timeUnit: 'Days'
    };
  }
}

const parseDestinations = (req) => {
  const destinations = {};
  if (req.body.emailRecipients) {
    destinations.email = {
      recipients: req.body.emailRecipients,
      subject: req.body.emailSubject,
      attachmentName: req.file?.originalname,
      attachmentSize: req.file?.size,
      attachmentContent: req.file?.buffer,
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
      parseMode: req.body.telegramParseMode.includes('Plain') ? undefined : req.body.telegramParseMode,
      chatIds: req.body.telegramChatIds,
    };
  }
  return destinations;
}

const flatDestinations = (destinations) => {
  const flattenedDestinationFields = {
    hasEmailDestination: !!destinations.email,
    hasSMSDestination: !!destinations.sms,
    hasTelegramDestination: !!destinations.telegram,
  };
  if (destinations.email) {
    flattenedDestinationFields.emailRecipients = destinations.email.recipients;
    flattenedDestinationFields.emailSubject = destinations.email.subject;
    flattenedDestinationFields.emailAttachmentName = destinations.email.attachmentName;
  }
  if (destinations.sms) {
    flattenedDestinationFields.smsServiceProvider = destinations.sms.serviceProvider;
    flattenedDestinationFields.smsPhoneNumbers = destinations.sms.phoneNumbers;
  }
  if (destinations.telegram) {
    flattenedDestinationFields.telegramParseMode = destinations.telegram.parseMode;
    flattenedDestinationFields.telegramChatIds = destinations.telegram.chatIds;
  }
  return flattenedDestinationFields;
}

exports.messageCreationInputValidations = [
  body('content', 'Message content is mandatory').notEmpty(),
  body('messageContentEncryption', "Invalid encryption specified").isIn(Object.keys(messagesService.MessageContentEncryption)),
  body('customEncryptionPassword', "Custom encryption password is required").if(body('messageContentEncryption').equals('encrypted_custom_encryption_password')).notEmpty(),
  body('emailRecipients', "If you want to add an email destination you need to provide recipients and subject").if(body('emailSubject').notEmpty()).notEmpty(),
  body('emailSubject', "If you want to add an email destination you need to provide recipients and subject").if(body('emailRecipients').notEmpty()).notEmpty(),
  body('checkinFrequencyTime', 'Provided check-in frequency time is not valid').isInt({ min: 1 }),
  body('checkinFrequencyTimeUnit', "Provided check-in frequency time unit is not valid").isIn(['Days', 'Months', 'Years']),
  body('checkinWaitingTime', 'Provided check-in waiting time is not valid').isInt({ min: 1 }),
  body('checkinWaitingTimeUnit', 'Provided check-in waiting time unit is not valid').isIn(['Days', 'Months', 'Years']),
];

exports.messageUpdateInputValidations = [
  body('content', 'Message content is mandatory').if(body('messageContentEncryption').not().equals('encrypted_custom_encryption_password')).notEmpty(),
  body('messageContentEncryption', "Invalid encryption specified").isIn(Object.keys(messagesService.MessageContentEncryption)),
  body('customEncryptionPassword', "Custom encryption password is required").if(body('messageContentEncryption').equals('encrypted_custom_encryption_password')).if(body('content').notEmpty()).notEmpty(),
  body('emailRecipients', "If you want to add an email destination you need to provide recipients and subject").if(body('emailSubject').notEmpty()).notEmpty(),
  body('emailSubject', "If you want to add an email destination you need to provide recipients and subject").if(body('emailRecipients').notEmpty()).notEmpty(),
  body('checkinFrequencyTime', 'Provided check-in frequency time is not valid').isInt({ min: 1 }),
  body('checkinFrequencyTimeUnit', "Provided check-in frequency time unit is not valid").isIn(['Days', 'Months', 'Years']),
  body('checkinWaitingTime', 'Provided check-in waiting time is not valid').isInt({ min: 1 }),
  body('checkinWaitingTimeUnit', 'Provided check-in waiting time unit is not valid').isIn(['Days', 'Months', 'Years']),
];

exports.messageDecryptionInputValidations = [
  body('encryptionPayload', "Encryption payload is mandatory, make sure the link you are using is valid").notEmpty(),
  body('encryptionPassword', 'Encryption password field is mandatory').notEmpty(),
];

exports.multerAttachmentFileStorage = multer.memoryStorage();

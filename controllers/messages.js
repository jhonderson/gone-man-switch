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
  res.locals.userHasNoEmail = user && !user.email;
  res.render('messages_new');
});

exports.createMessage = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('messages_new', { errors: validationResults.errors.map(error => error.msg) });
    return;
  }
  const checkinFrequencyDays = convertTimeToDays(Number(req.body.checkinFrequencyTime), req.body.checkinFrequencyTimeUnit);
  const checkinWaitingDays = convertTimeToDays(Number(req.body.checkinWaitingTime), req.body.checkinWaitingTimeUnit);
  try {
    await messagesService.createMessage({
      userId: req.session.userId,
      recipients: req.body.recipients,
      subject: req.body.subject,
      body: req.body.body,
      encryption: req.body.messageBodyEncryption,
      customEncryptionPassword: req.body.customEncryptionPassword,
      customEncryptionPasswordHint: req.body.customEncryptionPasswordHint,
      attachmentName: req.file?.originalname,
      attachmentSize: req.file?.size,
      attachmentContent: req.file?.buffer,
      checkinFrequencyDays,
      checkinWaitingDays
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
    const readStream = new (require('stream')).PassThrough();
    readStream.end(message.attachmentContent);
    res.set('Content-disposition', 'attachment; filename=' + message.attachmentName);
    res.set('Content-Type', 'text/plain');
    readStream.pipe(res);
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
  try {
    await messagesService.updateMessage({
      id: req.params.messageId,
      userId: req.session.userId,
      recipients: req.body.recipients,
      subject: req.body.subject,
      body: req.body.body,
      encryption: req.body.messageBodyEncryption,
      customEncryptionPassword: req.body.customEncryptionPassword,
      customEncryptionPasswordHint: req.body.customEncryptionPasswordHint,
      attachmentName: req.file?.originalname,
      attachmentSize: req.file?.size,
      attachmentContent: req.file?.buffer,
      checkinFrequencyDays,
      checkinWaitingDays
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
    const messageBody = messagesService.decryptMessageBodyFromEncryptionPayload(req.body.encryptionPayload, req.body.encryptionPassword);
    res.render('messages_decrypt', { messageBody });
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
    if (message.encryption == messagesService.MessageBodyEncryption.encrypted_system_encryption_password
      && !message.body) {
      // Message body field is mandatory, so if it's not present it means there was a problem decrypting its content
      errors.push('Unable to decrypt message body, maybe the system message encryption password was changed recently?');
    }
    return {
      ...message,
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

exports.messageCreationInputValidations = [
  body('recipients', "Recipients information is mandatory").notEmpty(),
  body('subject', 'Subject information is mandatory').notEmpty(),
  body('body', 'Body information is mandatory').notEmpty(),
  body('messageBodyEncryption', "Invalid encryption specified").isIn(Object.keys(messagesService.MessageBodyEncryption)),
  body('customEncryptionPassword', "Custom encryption password is required").if(body('messageBodyEncryption').equals('encrypted_custom_encryption_password')).notEmpty(),
  body('checkinFrequencyTime', 'Provided check-in frequency time is not valid').isInt({ min: 1 }),
  body('checkinFrequencyTimeUnit', "Provided check-in frequency time unit is not valid").isIn(['Days', 'Months', 'Years']),
  body('checkinWaitingTime', 'Provided check-in waiting time is not valid').isInt({ min: 1 }),
  body('checkinWaitingTimeUnit', 'Provided check-in waiting time unit is not valid').isIn(['Days', 'Months', 'Years']),
];

exports.messageUpdateInputValidations = [
  body('recipients', "Recipients information is mandatory").notEmpty(),
  body('subject', 'Subject information is mandatory').notEmpty(),
  body('body', 'Body information is mandatory').if(body('messageBodyEncryption').not().equals('encrypted_custom_encryption_password')).notEmpty(),
  body('messageBodyEncryption', "Invalid encryption specified").isIn(Object.keys(messagesService.MessageBodyEncryption)),
  body('customEncryptionPassword', "Custom encryption password is required").if(body('messageBodyEncryption').equals('encrypted_custom_encryption_password')).if(body('body').notEmpty()).notEmpty(),
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

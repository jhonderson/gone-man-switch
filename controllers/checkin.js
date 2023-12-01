const asyncHandler = require("express-async-handler");
const logger = require('../logger');
const checkinService = require('../services/checkin');

exports.checkin = asyncHandler(async (req, res, next) => {
  const checkinFound = await checkinService.doCheckin(req.params.notificationId);
  if (!checkinFound) {
    // Most likely the user:
    // - logged in before clicking the check-in notification
    // - click the check-in notification link twice
    logger.warn(`A user tried to check-in but no check-in notification was found for provided id: ${req.params.notificationId}`);
  }
  res.render('checkin', { title: 'Checked In!' });
});

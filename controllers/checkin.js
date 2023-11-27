const asyncHandler = require("express-async-handler");
const checkinService = require('../services/checkin');

exports.checkin = asyncHandler(async (req, res, next) => {
  if (await checkinService.doCheckin(req.params.notificationId)) {
    res.render('checkin', { title: 'Checked In!' });
  } else {
    res.render('error', { title: 'Check-in not found', message: 'Maybe you checked-in already?' });
  }
});

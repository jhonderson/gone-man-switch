const asyncHandler = require("express-async-handler");
const logger = require('../logger');
const checkinService = require('../services/checkin');

exports.checkin = asyncHandler(async (req, res, next) => {
  const follow = req.query.follow;
  if (!follow) {
    res.send(`
        <html>
            <head><title>Redirecting...</title></head>
            <body>
                <p>Redirecting to Check-in, please wait...</p>
                <script>
                    setTimeout(() => {
                        window.location.href = "?follow=true";
                    }, 2000); // 2-second delay
                </script>
            </body>
        </html>
    `);
  } else {
    logger.debug(`Doing check-in for notificaiton id ${req.params.notificationId}`);
    const checkinFound = await checkinService.doCheckin(req.params.notificationId);
    if (!checkinFound) {
      // Most likely the user:
      // - logged in before clicking the check-in notification
      // - click the check-in notification link twice
      logger.warn(`A user tried to check-in but no check-in notification was found for provided id: ${req.params.notificationId}`);
    } else {
      logger.debug(`Check-in completed for notificaiton id ${req.params.notificationId}`);
    }
    res.render('checkin', { title: 'Checked In!' });
  }
});

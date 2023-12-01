
const logger = require('../logger');
const checkinService = require('../services/checkin');

// Update user's last checkin every 60 minutes of activity to avoid overloading DB
const userCheckinRefreshFequencyMins = 60;

const updateUserLastCheckin = async (req, res, next) => {
  if (req.session.loggedin) {
    try {
      if (!req.session.lastCheckinAt) {
        await checkinService.doCheckinByUserId(req.session.userId);
        req.session.lastCheckinAt = new Date().toISOString();
      } else {
        const minutesSinceLastCheckin = Math.abs(new Date() - new Date(req.session.lastCheckinAt)) / 6e4;
        if (minutesSinceLastCheckin >= userCheckinRefreshFequencyMins) {
          await checkinService.doCheckinByUserId(req.session.userId);
          req.session.lastCheckinAt = new Date().toISOString();
        }
      }
    } catch (err) {
      // Errors updating user last checkin should not fail the request
      logger.error(err.message);
    }
  }
  next();
}

module.exports = {
  updateUserLastCheckin
}

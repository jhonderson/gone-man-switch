var express = require('express');
var router = express.Router();

const checkinController = require("../controllers/checkin");

router.get("/:notificationId", checkinController.checkin);

module.exports = router;

const express = require('express');

const router = express.Router();

const messagesController = require('../controllers/messages');
const authMiddleware = require('../middlewares/auth');

router.get('/', [authMiddleware.requireLoggedIn], messagesController.listMessages);

module.exports = router;

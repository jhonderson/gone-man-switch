const express = require('express');

const router = express.Router();

const systemController = require('../controllers/system.js');
const authMiddleware = require('../middlewares/auth');

router.get('/', [authMiddleware.requireAdminRole], systemController.viewSystemSettings);

module.exports = router;

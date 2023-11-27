const express = require('express');

const router = express.Router();

const systemController = require('../controllers/system.js');
const authMiddleware = require('../middlewares/auth');

router.get('/', [authMiddleware.requireAdminRole], systemController.viewSystemSettings);
router.post('/sendTestEmail', [authMiddleware.requireAdminRole], systemController.sendTestEmail);

module.exports = router;

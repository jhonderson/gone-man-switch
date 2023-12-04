var express = require('express');
var router = express.Router();

const accountController = require("../controllers/account");
const authMiddleware = require('../middlewares/auth');

router.get("/login", accountController.startLogin);
router.post("/login", accountController.loginInputValidations, accountController.login);
router.get("/logout", [authMiddleware.requireLoggedIn], accountController.logout);

router.get("/", [authMiddleware.requireLoggedIn], accountController.editAccount);
router.post("/", [authMiddleware.requireLoggedIn,
  ...accountController.accountInputValidations], accountController.updateAccount);

router.post("/checkinDestinations", [authMiddleware.requireLoggedIn], accountController.updateCheckinDestinations);
router.post("/settings", [authMiddleware.requireLoggedIn], accountController.updateSettings);
router.post("/sendTestEmail", [authMiddleware.requireLoggedIn,
  ...accountController.sendTestEmailInputValidations], accountController.sendTestEmail);
router.post("/sendTestSMSMessage", [authMiddleware.requireLoggedIn,
  ...accountController.sendTestSMSMessageInputValidations], accountController.sendTestSMSMessage);
router.post("/sendTestTelegramMessage", [authMiddleware.requireLoggedIn,
  ...accountController.sendTestTelegramMessageInputValidations], accountController.sendTestTelegramMessage);

module.exports = router;

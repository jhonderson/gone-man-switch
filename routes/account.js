var express = require('express');
var router = express.Router();

const accountController = require("../controllers/account");
const authMiddleware = require('../middlewares/auth');

router.get("/login", accountController.startLogin);
router.post("/login", accountController.loginInputValidations, accountController.login);
router.get("/logout", [authMiddleware.requireLoggedIn], accountController.logout);

router.get("/", [authMiddleware.requireLoggedIn], accountController.editAccount);
router.post("/", [authMiddleware.requireLoggedIn, ...accountController.accountInputValidations], accountController.updateAccount);

module.exports = router;

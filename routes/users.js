var express = require('express');
var router = express.Router();

const usersController = require("../controllers/users");
const authMiddleware = require('../middlewares/auth');

router.get('/', [authMiddleware.requireAdminRole], usersController.listUsers);

router.get('/new', [authMiddleware.requireAdminRole], usersController.newUser);
router.post('/new', [authMiddleware.requireAdminRole,
  ...usersController.createUserInputValidations], usersController.createUser);

router.get('/:userId/edit', [authMiddleware.requireAdminRole], usersController.editUser);
router.post('/:userId/edit', [authMiddleware.requireAdminRole,
  ...usersController.updateUserInputValidations], usersController.updateUser);
router.get('/:userId/delete', [authMiddleware.requireAdminRole], usersController.deleteUser);

module.exports = router;

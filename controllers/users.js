const asyncHandler = require("express-async-handler");
const usersService = require('../services/users');
const { body, validationResult } = require('express-validator');

exports.listUsers = asyncHandler(async (req, res, next) => {
  const users = await usersService.getAllUsers();
  res.render('users', { title: 'Users', users });
});

exports.newUser = asyncHandler(async (req, res, next) => {
  res.render('users_new', { title: 'Users' });
});

exports.createUser = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('users_new', { title: 'Users', errors: validationResults.errors.map(error => error.msg) });
    return;
  }
  try {
    await usersService.createUser({
      username: req.body.username,
      email: req.body.email,
      role: req.body.role,
      password: req.body.password,
      passwordConfirmation: req.body.passwordConfirmation,
    });
    res.redirect('/users');
  } catch (err) {
    res.render('users_new', { title: 'Users', errors: [err.message] });
  }
});

exports.editUser = asyncHandler(async (req, res, next) => {
  const user = await usersService.getUser(req.params.userId);
  if (user) {
    res.render('users_edit', { title: 'Users', user });
  } else {
    res.render('error', { title: 'Users', message: `There is no user with id "${req.params.userId}"` });
  }
});

exports.updateUser = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('users_edit', {
      title: 'Users',
      user: await usersService.getUser(req.params.userId),
      errors: validationResults.errors.map(error => error.msg)
    });
    return;
  }
  try {
    await usersService.updateUser({
      id: req.params.userId,
      username: req.body.username,
      email: req.body.email,
      role: req.body.role
    });
    res.redirect('/users');
  } catch (err) {
    res.render('users_edit', {
      title: 'Users',
      user: await usersService.getUser(req.params.userId),
      errors: [err.message]
    });
  }
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
  if (req.query.confirm == 'true') {
    await usersService.deleteUser(req.params.userId);
    if (req.session.userId == req.params.userId) {
      // User deleted itself, closing session
      res.redirect('/account/logout');
    } else {
      res.redirect('/users');
    }
  } else {
    const user = await usersService.getUser(req.params.userId);
    if (user) {
      res.render('users_delete', { title: 'Users', user });
    } else {
      res.render('error', { title: 'Users', message: `There is no user with id "${req.params.userId}"` });
    }
  }
});

exports.createUserInputValidations = [
  body('username', "Username field is mandatory").notEmpty(),
  body('email', "Email is not valid").if(body('email').notEmpty()).isEmail(),
  body('role', "Role field is mandatory").notEmpty(),
  body('role', "Role is not valid").isIn(['USER', 'ADMIN']),
  body('password', "Password field is mandatory").notEmpty(),
  body('passwordConfirmation', "Password Confirmation field is mandatory").notEmpty(),
];

exports.updateUserInputValidations = [
  body('username', "Username field is mandatory").notEmpty(),
  body('email', "Email is not valid").if(body('email').notEmpty()).isEmail(),
  body('role', "Role field is mandatory").notEmpty(),
  body('role', "Role is not valid").isIn(['USER', 'ADMIN']),
];

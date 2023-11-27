const asyncHandler = require("express-async-handler");
const usersService = require('../services/users');
const { body, validationResult } = require('express-validator');

exports.startLogin = asyncHandler(async (req, res, next) => {
  res.render('login', { title: 'Login' });
});

exports.login = asyncHandler(async (req, res, next) => {
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('login', { title: 'Login', username: req.body.username, errors: validationResults.errors.map(error => error.msg) });
    return;
  }
  const user = await usersService.getUserByUsernameAndPassword(req.body.username, req.body.password);
  if (user) {
    req.session.loggedin = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.redirect('/');
  } else {
    res.render('login', { title: 'Login', username: req.body.username, errors: ['No user found with the provided credentials'] });
  }
});

exports.logout = asyncHandler(async (req, res, next) => {
  req.session.loggedin = false;
  req.session.username = null;
  req.session.role = null;
  req.session.userId = null;
  req.session = null;
  res.redirect('/account/login');
});

exports.editAccount = asyncHandler(async (req, res, next) => {
  const user = await usersService.getUser(req.session.userId);
  if (user) {
    res.render('account', { title: 'Account', user });
  } else {
    res.redirect('/account/logout');
  }
});

exports.updateAccount = asyncHandler(async (req, res, next) => {
  const user = await usersService.getUser(req.session.userId);
  const validationResults = validationResult(req);
  if (!validationResults.isEmpty()) {
    res.render('account', {
      title: 'Account',
      user,
      errors: validationResults.errors.map(error => error.msg)
    });
    return;
  }
  try {
    await usersService.updateUser({
      id: req.session.userId,
      username: req.body.username,
      email: req.body.email,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      passwordConfirmation: req.body.passwordConfirmation,
      // Role changing not allowed in this operation
      role: user.role
    });
    req.session.username = req.body.username;
    res.redirect('/account');
  } catch (err) {
    res.render('account', {
      title: 'Account',
      user,
      errors: [err.message]
    });
  }
});

exports.loginInputValidations = [
  body('username', "Username field is mandatory").notEmpty(),
  body('password', 'Password field is mandatory').notEmpty(),
];

exports.accountInputValidations = [
  body('username', "Username field is mandatory").notEmpty(),
  body('email', "Email is not valid").if(body('email').notEmpty()).isEmail(),
];

const createError = require('http-errors');
const cookieSession = require('cookie-session')
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const systemSettings = require('./services/system').getSystemSettings();

const authMiddleware = require('./middlewares/auth');
const indexRouter = require('./routes/index');
const messagesRouter = require('./routes/messages');
const accountRouter = require('./routes/account');
const usersRouter = require('./routes/users');
const systemRouter = require('./routes/system');
const checkinRouter = require('./routes/checkin');

const app = express();

app.use(cookieSession({
  name: 'gonemanswitch-session',
  keys: [systemSettings.cookieSession.secret],
  httpOnly: true,
  maxAge: systemSettings.cookieSession.maxAgeDays * 24 * 60 * 60 * 1000
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev', {
  skip: (req, res) => { return res.statusCode < 400 }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(authMiddleware.addUserInformationToResponseLocals);

app.use('/', indexRouter);
app.use('/messages', messagesRouter);
app.use('/account', accountRouter);
app.use('/users', usersRouter);
app.use('/system', systemRouter);
app.use('/checkin', checkinRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;


const addUserInformationToResponseLocals = async (req, res, next) => {
  if (req.session.loggedin) {
    res.locals.loggedin = true;
    res.locals.userId = req.session.userId;
    res.locals.username = req.session.username;
    res.locals.role = req.session.role;
  } else {
    res.locals.loggedin = false;
  }
  next();
}

const requireLoggedIn = async (req, res, next) => {
  if (req.session.loggedin) {
    next();
  } else {
    res.redirect('/account/login');
  }
}

const requireAdminRole = async (req, res, next) => {
  if (!req.session.loggedin) {
    res.redirect('/account/login');
  } else if (req.session.role == 'ADMIN') {
    next();
  } else {
    res.status(401).render('error', { title: 'Unauthorized', message: 'Only admin users have acecss to this resource' });
  }
}

module.exports = {
  addUserInformationToResponseLocals,
  requireLoggedIn,
  requireAdminRole
}

const { getDb } = require('../db/sqlite');
const bcrypt = require('bcrypt');

const emailsService = require('./delivery/emails');
const smsService = require('./delivery/sms');
const systemSettings = require('../services/system').getSystemSettings();

const createUser = async ({username, password, passwordConfirmation, role}) => {
  if (password != passwordConfirmation) {
    throw new Error("Password and password confirmation don't match");
  }
  if (await isUsernameInUse(username)) {
    throw new Error("Wanted username is not available");
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  await getDb().run(`INSERT INTO users(id, username, password_hash, role, created_at, last_checkin_at, checkin_destinations, settings)
                      VALUES (:id, :username, :password_hash, :role, :created_at, :last_checkin_at, :checkin_destinations, :settings)`, {
    ':id': require('crypto').randomUUID(),
    ':username': username,
    ':password_hash': passwordHash,
    ':role': role,
    ':created_at': new Date().toISOString(),
    ':last_checkin_at': new Date().toISOString(),
    ':checkin_destinations': '{}',
    ':settings': '{}',
  });
}

const getUser = async (id) => {
  return parseUser(await getDb().get(`
    SELECT id, username, role, created_at AS createdAte, last_checkin_at AS lastCheckinAt,
    checkin_destinations AS checkinDestinations, settings
    FROM users WHERE id = ?`, id));
}

const updateUser = async ({id, username, currentPassword, newPassword, passwordConfirmation, role}) => {
  const user = await getDb().get("SELECT username, password_hash as passwordHash FROM users WHERE id = ?", id);
  if (newPassword) {
    if (newPassword != passwordConfirmation) {
      throw new Error("New password and password confirmation don't match");
    }
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      throw new Error("Invalid current password");
    }
  }
  if (user.username != username) {
    if (await isUsernameInUse(username)) {
      throw new Error("Wanted username is not available");
    }
  }
  const passwordHashField = {};
  if (newPassword) {
    passwordHashField[':password_hash'] = bcrypt.hashSync(newPassword, 10);
  }
  await getDb().run(`UPDATE users SET username = :username,
                      ${newPassword ? "password_hash = :password_hash, " : ""}
                      role = :role
                      WHERE id = :id`,
    {
      ':id': id,
      ':username': username,
      ':role': role,
      ...passwordHashField,
    });
}

const updateUserLastCheckin = async (id) => {
  await getDb().run("UPDATE users SET last_checkin_at = ? WHERE id = ?", new Date().toISOString(), id);
}

const deleteUser = async (id) => {
  await getDb().run('DELETE FROM users WHERE id = ?', id);
}

const getAllUsers = async () => {
  return getDb().all("SELECT id, username, role, created_at AS createdAt FROM users");
}

const getUserByUsernameAndPassword = async (username, password) => {
  const user = await getDb().get("SELECT id, username, password_hash as passwordHash, role, created_at AS createdAt, last_checkin_at AS lastCheckinAt FROM users WHERE username = ?", username);
  if (user && bcrypt.compareSync(password, user.passwordHash)) {
    const {passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return undefined;
}

const areThereAnyUsers = async () => {
  const anyUser = await getDb().get("SELECT id FROM users LIMIT 1");
  return !!anyUser;
}

const generateDefaultUserInformation = () => {
  return {
    id: require('crypto').randomUUID(),
    username: systemSettings.defaultUser.username,
    password: systemSettings.defaultUser.password,
    passwordConfirmation: systemSettings.defaultUser.password,
    role: 'ADMIN',
  };
}

const updateUserCheckinDestinations = async (id, checkinDestinations) => {
  if (checkinDestinations.email) {
    if (checkinDestinations.email.recipients
      && !emailsService.areEmailRecipientsValid(checkinDestinations.email.recipients)) {
      throw new Error('Invalid email recipients');
    }
  }
  if (checkinDestinations.sms) {
    if (!smsService.getSupportedServiceProviders().includes(checkinDestinations.sms.serviceProvider)) {
      throw new Error(`SMS Service provider is not supported: ${checkinDestinations.sms.serviceProvider}`);
    }
  }
  await getDb().run("UPDATE users SET checkin_destinations = ? WHERE id = ?",
    JSON.stringify(checkinDestinations), id);
}

const updateUserSettings = async (id, settings) => {
  const { currentSettingsStr } = await getDb().get('SELECT settings AS currentSettingsStr FROM users WHERE id = ?', id);
  const currentSettings = JSON.parse(currentSettingsStr);
  if (currentSettings.smtp && currentSettings.smtp.password) {
    settings.smtp = settings.smtp || {};
    settings.smtp.password ||= currentSettings.smtp?.password;
  }
  if (currentSettings.sms && currentSettings.sms.twilio
    && currentSettings.sms.twilio.authToken) {
    settings.sms = settings.sms || {};
    settings.sms.twilio = settings.sms.twilio || {};
    settings.sms.twilio.authToken ||= currentSettings.sms.twilio.authToken;
  }
  if (currentSettings.telegram && currentSettings.telegram.botToken) {
    settings.telegram = settings.telegram || {};
    settings.telegram.botToken ||= currentSettings.telegram.botToken;
  }
  await getDb().run("UPDATE users SET settings = ? WHERE id = ?",
    JSON.stringify(settings), id);
}

const isUsernameInUse = async (username) => {
  return !!(await getDb().get("SELECT id FROM users WHERE username = ?", username));
}

const parseUser = (user) => {
  if (!user) {
    return user;
  }
  return {
    ...user,
    checkinDestinations: JSON.parse(user.checkinDestinations),
    settings: JSON.parse(user.settings),
  };
}

module.exports = {
  createUser,
  getUser,
  updateUser,
  updateUserLastCheckin,
  deleteUser,
  getAllUsers,
  getUserByUsernameAndPassword,
  areThereAnyUsers,
  generateDefaultUserInformation,
  updateUserCheckinDestinations,
  updateUserSettings,
}
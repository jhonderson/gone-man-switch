const { getDb } = require('../db/sqlite');
const bcrypt = require('bcrypt');

const systemSettings = require('../services/system').getSystemSettings();

const createUser = async ({username, email, password, passwordConfirmation, role}) => {
  if (password != passwordConfirmation) {
    throw new Error("Password and password confirmation don't match");
  }
  const userUsingWantedUsername = await getUserByUsername(username);
  if (userUsingWantedUsername) {
    throw new Error("Wanted username is not available");
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  await getDb().run(`INSERT INTO users(id, username, email, password_hash, role, created_at, last_checkin_at)
                      VALUES (:id, :username, :email, :password_hash, :role, :created_at, :last_checkin_at)`, {
    ':id': require('crypto').randomUUID(),
    ':username': username,
    ':email': email,
    ':password_hash': passwordHash,
    ':role': role,
    ':created_at': new Date().toISOString(),
    ':last_checkin_at': new Date().toISOString()
  });
}

const getUser = async (id) => {
  return getDb().get("SELECT id, username, email, role, created_at AS createdAte, last_checkin_at AS lastCheckinAt FROM users WHERE id = ?", id);
}

const updateUser = async ({id, username, email, currentPassword, newPassword, passwordConfirmation, role}) => {
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
    const userUsingWantedUsername = await getUserByUsername(username);
    if (userUsingWantedUsername) {
      throw new Error("Wanted username is not available");
    }
  }
  const passwordHashField = {};
  if (newPassword) {
    passwordHashField[':password_hash'] = bcrypt.hashSync(newPassword, 10);
  }
  await getDb().run(`UPDATE users SET username = :username, email = :email, 
                      ${newPassword ? "password_hash = :password_hash, " : ""}
                      role = :role
                      WHERE id = :id`,
    {
      ':id': id,
      ':username': username,
      ':email': email,
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
  return getDb().all("SELECT id, username, email, role, created_at AS createdAt FROM users");
}

const getUserByUsernameAndPassword = async (username, password) => {
  const user = await getDb().get("SELECT id, username, email, password_hash as passwordHash, role, created_at AS createdAt, last_checkin_at AS lastCheckinAt FROM users WHERE username = ?", username);
  if (user && bcrypt.compareSync(password, user.passwordHash)) {
    const {passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return undefined;
}

const getUserByUsername = async (username) => {
  return getDb().get("SELECT id, username, email, role, created_at AS createdAt, last_checkin_at AS lastCheckinAt FROM users WHERE username = ?", username);
}

const areThereAnyUsers = async () => {
  const anyUser = await getDb().get("SELECT id FROM users LIMIT 1");
  return !!anyUser;
}

const generateDefaultUserInformation = () => {
  return {
    id: require('crypto').randomUUID(),
    username: systemSettings.defaultUser.username,
    email: systemSettings.defaultUser.email,
    password: systemSettings.defaultUser.password,
    passwordConfirmation: systemSettings.defaultUser.password,
    role: 'ADMIN',
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
  getUserByUsername,
  areThereAnyUsers,
  generateDefaultUserInformation,
}
const usersService = require('../services/users');
const logger = require('../logger');

const initializeDatabaseData = async () => {
  logger.debug('[initialize-data] starting...');
  if (!await usersService.areThereAnyUsers()) {
    await usersService.createUser(usersService.generateDefaultUserInformation());
    logger.info('Default admin user created');
  }
  logger.debug('[initialize-data] done');
}

module.exports = {
  initializeDatabaseData,
};

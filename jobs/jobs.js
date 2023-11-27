const { sendCheckinNotifications } = require("./send-checkin-notifications");
const { sendMessages } = require("./send-messages");
const { initializeDatabaseData } = require("./initialize-db-data");
const schedule = require('node-schedule');

const systemSettings = require('../services/system').getSystemSettings();

const recurrentJobs = [
    {
        interval: systemSettings.checkin.checkinNotificationsJobCron,
        jobFunc: sendCheckinNotifications,
        jobInstance: null,
    },
    {
        interval: systemSettings.checkin.messagesJobCron,
        jobFunc: sendMessages,
        jobInstance: null,
    }
];

const initBackgroundJobs = async function () {
    for (const job of recurrentJobs) {
        const jobInstance = schedule.scheduleJob(job.interval, job.jobFunc);
        job.jobInstance = jobInstance;
    }
    initializeDatabaseData();
};

module.exports = {
    initBackgroundJobs
};

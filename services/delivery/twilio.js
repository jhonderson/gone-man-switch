const clientProvider = require('twilio');

const sendText = async ({ twilio: { accountSid, authToken, from }}, { to, body }) => {
  if (!accountSid || !authToken || !from) {
    throw new Error("Can't send SMS because some required Twilio settings are missing");
  }
  const client = clientProvider(accountSid, authToken);
  const message = await client.messages.create({
    body,
    from,
    to
  });
  return message.sid;
}

module.exports = {
  sendText
}

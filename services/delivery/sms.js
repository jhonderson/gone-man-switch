
const getSMSServiceProviderClient = (serviceProvider) => {
  switch(serviceProvider) {
    case 'twilio': {
      const twilioClient = require('./twilio')
      return {
        sendText: twilioClient.sendText
      }
    }
    default:
      throw new Error(`Service provider not supported: ${serviceProvider}`)
  }
}

const getSupportedServiceProviders = () => {
  return ['twilio'];
}

module.exports = {
  getSMSServiceProviderClient,
  getSupportedServiceProviders,
}

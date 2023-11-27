const crypto = require("crypto");

const encrypt = (content, encryptionPassword) => {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(encryptionPassword).digest('base64').substring(0, 32);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(content);
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return algorithm + ':' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

const decrypt = (encryptedContent, password) => {
  const parts = encryptedContent.split(':');
  const algorithm = parts.shift();
  const iv = Buffer.from(parts.shift(), 'hex');

  const encryptedData = Buffer.from(parts.join(':'), 'hex');
  const key = crypto.createHash('sha256').update(password).digest('base64').substring(0, 32);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  
  const decrypted = decipher.update(encryptedData);
  const decryptedText = Buffer.concat([decrypted, decipher.final()]);
  return decryptedText.toString();
}

module.exports = {
  encrypt,
  decrypt,
}

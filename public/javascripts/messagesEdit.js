
const encryptionOptions = document.getElementsByName('messageBodyEncryption');
const messageBody = document.getElementById('body');

encryptionOptions.forEach(encryptionOption => {
  encryptionOption.addEventListener('change', (event) => {
    encryptionOptionChanged(event.currentTarget.value);
  });
});

messageBody.addEventListener('change', (event) => {
  if (isCustomEncryptionOptionSelected() && isStoredMessageEncryptedUsingCustomEncryptionPassword()) {
    const isMessageBodyEmpty = !event.currentTarget.value
    if (isMessageBodyEmpty) {
      // If body is empty there is no need to require an encryption password
      // since the body won't be overriden
      document.getElementById('customEncryptionPassword').removeAttribute('required');
    } else {
      // If the user wants to override the body then the encryption password needs to be provided
      document.getElementById('customEncryptionPassword').setAttribute('required', true);
    }
  }
});

function encryptionOptionChanged(newValue) {
  if (newValue == 'encrypted_custom_encryption_password') {
    if (isStoredMessageEncryptedUsingCustomEncryptionPassword()) {
      // If the store message is encrypted using custom encryption, no need to require the body
      // since it doesn't have to be updated
      document.getElementById('body').removeAttribute('required');
      if (isMessageBodyEmpty()) {
        // If body is empty there is no need to require an encryption password
        // since the body won't be overriden
        document.getElementById('customEncryptionPassword').removeAttribute('required');
      } else {
        // If the user wants to override the body then the encryption password needs to be provided
        document.getElementById('customEncryptionPassword').setAttribute('required', true);
      }
    } else {
      document.getElementById('customEncryptionPassword').setAttribute('required', true);
    }
    document.getElementById('customEncryptionPasswordGroup').removeAttribute('hidden');
    document.getElementById('customEncryptionPasswordHintGroup').removeAttribute('hidden');
  } else {
    document.getElementById('body').setAttribute('required', true);
    document.getElementById('customEncryptionPasswordGroup').setAttribute('hidden', true);
    document.getElementById('customEncryptionPasswordHintGroup').setAttribute('hidden', true);
    document.getElementById('customEncryptionPassword').removeAttribute('required');
    document.getElementById('customEncryptionPassword').value = '';
  }
}

function isCustomEncryptionOptionSelected() {
  return document.getElementById('encryptedCustomEncryptionPassword').checked;
}

function isStoredMessageEncryptedUsingCustomEncryptionPassword() {
  // If the 'Decrypt Message Body' is present, the stored message is encrypted using custom encryption password
  return !!document.getElementById('decryptMessageBodyLink');
}

function isMessageBodyEmpty() {
  return !document.getElementById('body').value;
}

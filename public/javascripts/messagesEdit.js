
const encryptionOptions = document.getElementsByName('messageContentEncryption');
const messageContent = getMessageContentElement();

encryptionOptions.forEach(encryptionOption => {
  encryptionOption.addEventListener('change', (event) => {
    encryptionOptionChanged(event.currentTarget.value);
  });
});

messageContent.addEventListener('change', (event) => {
  if (isCustomEncryptionOptionSelected() && isStoredMessageEncryptedUsingCustomEncryptionPassword()) {
    const isMessageContentEmpty = !event.currentTarget.value
    if (isMessageContentEmpty) {
      // If content is empty there is no need to require an encryption password
      // since the content won't be overriden
      document.getElementById('customEncryptionPassword').removeAttribute('required');
    } else {
      // If the user wants to override the content then the encryption password needs to be provided
      document.getElementById('customEncryptionPassword').setAttribute('required', true);
    }
  }
});

function encryptionOptionChanged(newValue) {
  if (newValue == 'encrypted_custom_encryption_password') {
    if (isStoredMessageEncryptedUsingCustomEncryptionPassword()) {
      // If the store message is encrypted using custom encryption, no need to require the content
      // since it doesn't have to be updated
      getMessageContentElement().removeAttribute('required');
      if (isMessageContentEmpty()) {
        // If content is empty there is no need to require an encryption password
        // since the content won't be overriden
        document.getElementById('customEncryptionPassword').removeAttribute('required');
      } else {
        // If the user wants to override the content then the encryption password needs to be provided
        document.getElementById('customEncryptionPassword').setAttribute('required', true);
      }
    } else {
      document.getElementById('customEncryptionPassword').setAttribute('required', true);
    }
    document.getElementById('customEncryptionPasswordGroup').removeAttribute('hidden');
    document.getElementById('customEncryptionPasswordHintGroup').removeAttribute('hidden');
  } else {
    getMessageContentElement().setAttribute('required', true);
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
  // If the 'Decrypt Message Content' is present, the stored message is encrypted using custom encryption password
  return !!document.getElementById('decryptMessageContentLink');
}

function isMessageContentEmpty() {
  return !(getMessageContentElement().value);
}

function getMessageContentElement() {
  return document.getElementById('content');
}

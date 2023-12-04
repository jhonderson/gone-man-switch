
const encryptionOptions = document.getElementsByName('messageContentEncryption');

encryptionOptions.forEach(encryptionOption => {
  encryptionOption.addEventListener('change', (event) => {
    encryptionOptionChanged(event.currentTarget.value);
  });
});

function encryptionOptionChanged(newValue) {
  if (newValue == 'encrypted_custom_encryption_password') {
    document.getElementById('customEncryptionPasswordGroup').removeAttribute('hidden');
    document.getElementById('customEncryptionPasswordHintGroup').removeAttribute('hidden');
    document.getElementById('customEncryptionPassword').setAttribute('required', true);
  } else {
    document.getElementById('customEncryptionPasswordGroup').setAttribute('hidden', true);
    document.getElementById('customEncryptionPasswordHintGroup').setAttribute('hidden', true);
    document.getElementById('customEncryptionPassword').removeAttribute('required');
    document.getElementById('customEncryptionPassword').value = '';
    document.getElementById('customEncryptionPasswordHint').value = '';
  }
}

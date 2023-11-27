var express = require('express');
var router = express.Router();
const multer = require('multer');

const messagesController = require("../controllers/messages");
const authMiddleware = require('../middlewares/auth');

const upload = multer({ storage: messagesController.multerAttachmentFileStorage });

router.get('/new', [authMiddleware.requireLoggedIn], messagesController.newMessage);
router.post('/new', [authMiddleware.requireLoggedIn, upload.single('attachment'),
                    ...messagesController.messageCreationInputValidations], messagesController.createMessage);

router.get('/:messageId', [authMiddleware.requireLoggedIn], messagesController.viewMessage);
router.get('/:messageId/attachment/download', [authMiddleware.requireLoggedIn], messagesController.downloadAttachment);

router.get('/:messageId/delete', [authMiddleware.requireLoggedIn], messagesController.deleteMessage);

router.get('/:messageId/edit', [authMiddleware.requireLoggedIn], messagesController.editMessage);
router.post('/:messageId/edit', [authMiddleware.requireLoggedIn, upload.single('attachment'),
                    ...messagesController.messageUpdateInputValidations], messagesController.updateMessage);

router.get('/decrypt/:encryptionPayload', messagesController.initMessageDecryption);
router.post('/decrypt', messagesController.messageDecryptionInputValidations, messagesController.decryptMessage);

module.exports = router;

const express = require('express')
const AccessController = require('../../controllers/access.controller')
const { asyncHandler } = require('../../response/asyncHandler')
const uploadController = require('../../controllers/upload.controller')
const router = express.Router()

router.post('/access/signup', asyncHandler(AccessController.signUp))
router.post('/access/signup/confirm', asyncHandler(AccessController.signUpConfirm))
router.post('/access/forgot-password/confirm-user', asyncHandler(AccessController.forgotPasswordConfirmUser))
router.post('/access/forgot-password/confirm-access-number', asyncHandler(AccessController.forgotPasswordConfirmAccess))
router.post('/access/forgot-password/change-password', asyncHandler(AccessController.changePassword))
router.post('/access/signin', asyncHandler(AccessController.signIn))
router.post('/access/logout', asyncHandler(AccessController.logOut))
router.get('/access/get-user-by-username', asyncHandler(AccessController.getUserByUsername))
router.get('/access/search-user-by-username', asyncHandler(AccessController.searchUserByUsername))
router.get('/access/public', asyncHandler(AccessController.publicFolder))

module.exports = router
const express = require('express')

const { asyncHandler } = require('../../response/asyncHandler')
const AdminController = require('../../controllers/admin.controller')
const router = express.Router()


router.get('/admin/get-all-users', asyncHandler(AdminController.getAllUsers))
router.get('/admin/get-files-by-user-id', asyncHandler(AdminController.getFilesByUserId))
router.get('/admin/get-trash-by-user-id', asyncHandler(AdminController.getListTrashByUserId))
router.get('/admin/get-folders-by-folder-parrent-id', asyncHandler(AdminController.getListFolderByFolderParrentId))
router.get('/admin/get-folder-parrent', asyncHandler(AdminController.getFolderParrentId))


module.exports = router
const express = require('express')
const { checkToken, checkPermission } = require('../auth/checkAuth')
const router = express.Router()

// check token
router.use(checkToken)

// check permission
router.use(checkPermission)

// access
router.use('/v1/api', require('./access'))
router.use('/v1/api', require('./upload'))
router.use('/v1/api', require('./admin'))

module.exports = router
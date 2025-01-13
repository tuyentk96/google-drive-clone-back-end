const keyTokensModel = require("../models/key.tokens.model")
const JWT = require('jsonwebtoken')
const { UnauthorizedError, ForbiddenError, BadRequestError } = require("../response/error.ressponse")

const { secretKey: { accessKey, refreshKey } } = require('../configs/config.system')
const permissionModel = require("../models/permission.model")

const _ = require('lodash')

let decodeFinal = {}

const checkToken = async (req, res, next) => {

    if (req.url.split('/')[3] === 'access') {
        return next()
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError()
        }

        const token = authHeader.slice(7);
        const decode = JWT.verify(token, accessKey)

        if (!decode) {
            throw new UnauthorizedError()
        }

        const now = Math.floor(new Date().getTime() / 1000);

        if (decode.exp < now) {
            const refreshTokenStore = await keyTokensModel.findOne({ user: decode.userId })
            if (JWT.verify(refreshTokenStore.refreshToken, refreshKey)) {
                const newAccessToken = JWT.sign({ userId: decode.userId }, accessKey, {
                    expiresIn: '2 days'
                });

                const newRefreshToken = JWT.sign({ userId: decode.userId }, refreshKey, {
                    expiresIn: '7 days'
                });

                refreshTokenStore.refreshToken = newRefreshToken;

                await refreshTokenStore.save();

                res.cookie('jwt', newAccessToken, { httpOnly: true, maxAge: 60 * 60 * 1000 * 48 })
            } else {
                throw new UnauthorizedError('Refresh Token mismatch');
            }
        }



        decodeFinal = decode

        return next();
    } catch (error) {
        next(error)
    }
}

const checkPermission = async (req, res, next) => {
    try {

        if (req.url.split('/')[3] === 'admin') {
            if (decodeFinal.role === 'ADMIN') {
                return next()
            } else {
                throw new ForbiddenError()
            }
        }

        if (req.url.split('/')[3] === 'access') {
            return next()
        }

        if (req.url === '/v1/api/uploads/upload-files') {
            return next()
        }

        if (
            req.url.split('/')[4].split('?')[0] === 'get-star' ||
            req.url.split('/')[4].split('?')[0] === 'get-folder-trash' ||
            req.url.split('/')[4].split('?')[0] === 'get-share-with-me' ||
            req.url.split('/')[4].split('?')[0] === 'get-file-by-user-id' ||
            req.url.split('/')[4].split('?')[0] === 'get-folder-by-user-id'
        ) {
            if (req.query?.userId && decodeFinal.userId) {
                if (req.query.userId === decodeFinal.userId) {
                    return next();
                } else {
                    throw new UnauthorizedError();
                }
            } else {
                throw new BadRequestError("Invalid request: Missing userId");
            }
        }

        const permission = await permissionModel.findOne({ userId: decodeFinal.userId }).lean()

        const folderId = req.query.folderId ? req.query.folderId : req.body.folderId

        const checkFile = permission.fileId.filter(id => id._id.equals(folderId))
        const checkFolder = permission.folderId.filter(id => id._id.equals(folderId))

        if (checkFile.length === 0 && checkFolder.length === 0) {
            throw new ForbiddenError()
        }

        return next()
    } catch (error) {
        next(error)
    }
}


module.exports = {
    checkToken, checkPermission
}
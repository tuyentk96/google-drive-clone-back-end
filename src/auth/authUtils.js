const JWT = require('jsonwebtoken')
const { BadRequestError } = require('../response/error.ressponse')
const keyTokensModel = require('../models/key.tokens.model')

const { secretKey: { accessKey, refreshKey } } = require('../configs/config.system')

const createTokenPair = async (payload) => {
    try {
        const accessToken = await JWT.sign(payload, accessKey, {
            expiresIn: '2 days'
        })

        const refreshToken = await JWT.sign(payload, refreshKey, {
            expiresIn: '7 days'
        })

        const existingToken = await keyTokensModel.findOne({ user: payload.userId });

        if (existingToken) {
            // Nếu token đã tồn tại, cập nhật refreshToken
            existingToken.refreshToken = refreshToken;
            await existingToken.save();
        } else {
            // Nếu chưa có, tạo mới
            await keyTokensModel.create({
                user: payload.userId,
                refreshToken,
            });
        }

        return accessToken
    } catch (error) {
        throw new BadRequestError(`Error: Create token error`)
    }
}

module.exports = {
    createTokenPair
}
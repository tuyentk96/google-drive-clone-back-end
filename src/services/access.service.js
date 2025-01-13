
const { createTokenPair } = require('../auth/authUtils');
const keyTokensModel = require('../models/key.tokens.model');
const usersModel = require('../models/users.model');
const userModel = require('../models/users.model')
const { BadRequestError, ConflictRequestError, NotFoundError, UnauthorizedError, ForbiddenError } = require('../response/error.ressponse')
const bcrypt = require('bcrypt')

const { sendEmailFromRegister, sendEmailFromForgotUser } = require('../auth/send.email');
const confirmUsersModel = require('../models/confirm.users.model');
const foldersModel = require('../models/folders.model');
const permissionModel = require('../models/permission.model');
const filesModel = require('../models/files.model');

const checkPassword = (inputPassword, hashPassword) => {
    return bcrypt.compareSync(inputPassword, hashPassword);
};

class AccessService {
    static signUp = async ({ username, password, email }) => {
        if (!username || !password || !email) {
            throw new BadRequestError('Invalid Data')
        }

        const existingUser = await userModel.findOne({ username }).lean()

        if (existingUser) {
            throw new ConflictRequestError('Error: User already registered!')
        }

        const accessNumberSend = await sendEmailFromRegister(email)

        const emailExisting = await confirmUsersModel.findOne({ username, password, email });

        if (emailExisting) {
            emailExisting.accessNumber = accessNumberSend
            await emailExisting.save()
        } else {
            await confirmUsersModel.create({ username, password, email, accessNumber: accessNumberSend })
        }



        return {

        }
    }

    static signUpConfirm = async ({ username, password, email, accessNumber }) => {
        const ConfirmUser = await confirmUsersModel.findOne({ username, password, email, accessNumber });
        if (!ConfirmUser) {
            throw new NotFoundError('Verify Access Number Failed');
        }


        const hashPassword = await bcrypt.hash(password, 10);


        await ConfirmUser.deleteOne();


        const storage = await foldersModel.create({
            nameFolder: `${username}_storage`,
            public: false,
            folderChild: [],
            shareId: [],
            folderParent: null,
            isTrash: false,
            isDelete: false,
            memories: 0,
        });


        const newUser = await userModel.create({
            username,
            password: hashPassword,
            email,
            role: 'USER',
            storage: storage._id,
        });

        await permissionModel.create({ userId: newUser._id, folderId: storage._id })


        return {

        };

    };


    static forgotPasswordConfirmUser = async ({ username, email }) => {

        if (!username || !email) {
            throw new BadRequestError('Invalid Data')
        }

        const existingUser = await userModel.findOne({ username, email }).lean()

        if (!existingUser) {
            throw new NotFoundError()
        } else {
            const accessNumber = await sendEmailFromForgotUser(email)

            const emailExisting = await confirmUsersModel.findOne({ username, email });
            if (emailExisting) {
                emailExisting.accessNumber = accessNumber
                await emailExisting.save()
            } else {
                await confirmUsersModel.create({ username, email, accessNumber })
            }
        }

        return {

        }
    }

    static forgotPasswordConfirmAccess = async ({ username, email, accessNumber }) => {
        const confirmAccess = await confirmUsersModel.findOne({ username, email, accessNumber })

        if (!confirmAccess) {
            throw new ConflictRequestError('Access Number Not Match')
        }

        return {

        }
    }

    static changePassword = async ({ username, email, password, accessNumber }) => {
        const confirmAccess = await confirmUsersModel.findOne({ username, email, accessNumber })

        if (!confirmAccess) {
            throw new ConflictRequestError('Access Number Not Match')
        } else {
            const user = await userModel.findOne({ username, email })
            const hashPassword = await bcrypt.hash(password, 10)

            if (!user) {
                throw new NotFoundError()
            } else {
                user.password = hashPassword
                await user.save()
                await confirmAccess.deleteOne()
            }
        }
        return {

        }
    }

    static signIn = async ({ username, password }, res) => {
        if (!username || !password) {
            throw new BadRequestError('Invalid Data')
        }

        const existingUser = await userModel.findOne({ username }).lean()

        if (!existingUser) {
            throw new ConflictRequestError('Error: Username or Password Invalid!')
        }

        if (!checkPassword(password, existingUser.password)) {
            throw new ConflictRequestError('Error: Username or Password Invalid!')
        }

        // create token pair
        const tokens = await createTokenPair({ userId: existingUser._id, username })

        res.cookie('jwt', tokens, { httpOnly: true, maxAge: 60 * 60 * 1000 * 48 })

        return {
            userId: existingUser._id,
            username: existingUser.username,
            storageId: existingUser.storage._id,
            accessToken: tokens,
            role: existingUser.role
        }
    }

    static logOut = async ({ userId }, res) => {
        const key = await keyTokensModel.deleteOne({ user: userId })

        res.clearCookie('jwt', { httpOnly: true });
        if (key.deletedCount === 0) {
            throw new ConflictRequestError()
        }
        return {}
    }

    static getUserByUsername = async (username) => {

        const user = await usersModel.findOne({ username }).lean();

        if (!user) {
            throw new BadRequestError(`Can not find your's Username`)
        }

        if (user) {
            delete user.password;
        }

        return {
            user: user
        };
    };

    static searchUserByUsername = async (username) => {

        if (!username) {
            throw new BadRequestError()
        }

        const listUser = await userModel.find({
            username: { $regex: username, $options: "i" }
        }).select('_id username email').limit(5);



        return {
            listUser
        }

    }

    static publicFolder = async (folderId) => {
        if (!folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            if (file.public) {
                return {
                    data: file
                }
            } else {
                throw new ForbiddenError()
            }
        } else {
            const folderParrent = await foldersModel.findById(folderId)
            const folders = await foldersModel
                .find({ folderParent: folderId, public: true })
                .populate({
                    path: "updatedBy",
                    select: "username",
                })
                .select("_id nameFolder memories updatedBy public updatedAt")
                .lean();

            const files = await filesModel
                .find({ folderParent: folderId, public: true })
                .populate({
                    path: "updatedBy",
                    select: "username",
                })
                .select("_id nameFile type memories updateBy public folderPath createdAt updatedAt")
                .lean();

            const combinedData = [...folders, ...files].sort((a, b) => {
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
            if (folderParrent.public) {
                return {
                    data: combinedData,
                    folder: folderParrent
                }
            } else {
                throw new ForbiddenError()
            }
        }
    }
}

module.exports = AccessService
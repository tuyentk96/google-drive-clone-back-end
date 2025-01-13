const { CREATED, OK } = require("../response/success.response")
const { createTokenPair } = require('../auth/authUtils');
const keyTokensModel = require('../models/key.tokens.model');
const usersModel = require('../models/users.model');
const userModel = require('../models/users.model')
const { BadRequestError, ConflictRequestError, NotFoundError, ForbiddenError } = require('../response/error.ressponse')
const bcrypt = require('bcrypt')

const { sendEmailFromRegister, sendEmailFromForgotUser } = require('../auth/send.email');
const confirmUsersModel = require('../models/confirm.users.model');
const foldersModel = require('../models/folders.model');
const permissionModel = require('../models/permission.model');
const filesModel = require('../models/files.model');

const checkPassword = (inputPassword, hashPassword) => {
    return bcrypt.compareSync(inputPassword, hashPassword);
};

class AccessController {
    signUp = async (req, res, next) => {

        const { username, password, email } = req.body

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

        new OK({
            metadata: {
                success: true,
                username,
                email
            },
            message: 'Sign up compelete!'
        }).send(res)
    }

    signUpConfirm = async (req, res, next) => {

        const { username, password, email, accessNumber } = req.body

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

        new CREATED({
            message: 'Registered User',
            metadata: {
                success: true,
                username,
                email
            }
        }).send(res)
    }

    signIn = async (req, res, next) => {

        const { username, password } = req.body

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
        const tokens = await createTokenPair({ userId: existingUser._id, username, role: existingUser.role })

        res.cookie('jwt', tokens, { httpOnly: true, maxAge: 60 * 60 * 1000 * 48 })

        new OK({
            message: 'Login Successfully',
            metadata: {
                userId: existingUser._id,
                username: existingUser.username,
                storageId: existingUser.storage._id,
                accessToken: tokens,
                role: existingUser.role
            }
        }).send(res)
    }

    logOut = async (req, res, next) => {

        const { userId } = req.body

        const key = await keyTokensModel.deleteOne({ user: userId })

        res.clearCookie('jwt', { httpOnly: true });
        if (key.deletedCount === 0) {
            throw new ConflictRequestError()
        }

        new OK({
            message: 'Logout Successfully',
            metadata: {
                success: true
            }
        }).send(res)
    }



    getUserByUsername = async (req, res, next) => {

        const username = req.query.username

        const user = await usersModel.findOne({ username }).lean();

        if (!user) {
            throw new BadRequestError(`Can not find your's Username`)
        }

        if (user) {
            delete user.password;
        }

        new OK({
            metadata: {
                success: true,
                user: user
            },
            message: 'Get data successfully!'
        }).send(res)
    }

    searchUserByUsername = async (req, res, next) => {

        const username = req.query.username;

        if (!username) {
            throw new BadRequestError()
        }

        const listUser = await userModel.find({
            username: { $regex: username, $options: "i" },
            role: 'USER'
        }).select('_id username email storage').limit(5);

        new OK({
            metadata: {
                success: true,
                listUser
            },
            message: 'Get data successfully!'
        }).send(res)
    }

    publicFolder = async (req, res, next) => {

        const folderId = req.query.folderId

        if (!folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            if (file.public) {
                new OK({
                    metadata: {
                        data: file
                    },
                    message: 'Get data successfully!'
                }).send(res)
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
                new OK({
                    metadata: {
                        data: combinedData,
                        folder: folderParrent
                    },
                    message: 'Get data successfully!'
                }).send(res)
            } else {
                throw new ForbiddenError()
            }
        }


    }

    forgotPasswordConfirmUser = async (req, res, next) => {

        const { username, email } = req.body

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


        new OK({
            metadata: {
                success: true
            },
            message: 'Send access number to Email!'
        }).send(res)
    }

    forgotPasswordConfirmAccess = async (req, res, next) => {

        const { username, email, accessNumber } = req.body
        const confirmAccess = await confirmUsersModel.findOne({ username, email, accessNumber })

        if (!confirmAccess) {
            throw new ConflictRequestError('Access Number Not Match')
        }

        new OK({
            metadata: {
                success: true
            },
            message: 'Access number match'
        }).send(res)
    }

    changePassword = async (req, res, next) => {

        const { username, email, password, accessNumber } = req.body

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

        new OK({
            metadata: {
                success: true
            },
            message: 'Change password complete'
        }).send(res)
    }




}

module.exports = new AccessController
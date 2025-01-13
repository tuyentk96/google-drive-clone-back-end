const usersModel = require("../models/users.model")
const filesModel = require("../models/files.model")
const { OK } = require("../response/success.response")
const { BadRequestError } = require("../response/error.ressponse")
const foldersModel = require("../models/folders.model")



class AdminController {

    getAllUsers = async (req, res, next) => {

        const listUsers = await usersModel.find({ role: 'USER' })
            .populate({
                path: 'storage',
                select: 'memories'
            })
            .select('_id username email createdAt storage')
            .sort({ createdAt: -1 })

        new OK({
            message: 'Get data successfully!',
            metadata: {
                sucess: true,
                listUsers
            }
        }).send(res)
    }

    getFilesByUserId = async (req, res, next) => {
        const { userId } = req.query

        if (!userId) {
            throw new BadRequestError()
        }

        const listFiles = await filesModel.find({ createdBy: userId }).select('_id nameFile updatedAt memories').sort({ createdAt: -1 })

        new OK({
            message: 'Get data successfully!',
            metadata: {
                sucess: true,
                listFiles
            }
        }).send(res)
    }

    getListTrashByUserId = async (req, res, next) => {
        const { userId } = req.query

        if (!userId) {
            throw new BadRequestError()
        }

        const folders = await foldersModel
            .find({ createdBy: userId, isTrash: true, isDelete: false })
            .populate({
                path: "createdBy",
                select: "username",
            })
            .select("_id nameFolder memories createdBy updatedAt updatedBy openedAt")
            .lean();

        const files = await filesModel
            .find({ createdBy: userId, isTrash: true, isDelete: false })
            .populate({
                path: "createdBy",
                select: "username",
            })
            .select("_id nameFile type memories createdBy updatedAt updateBy folderPath createdAt openedAt")
            .lean();

        const combinedData = [...folders, ...files].sort((a, b) => {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        new OK({
            message: 'Get data successfully!',
            metadata: {
                sucess: true,
                listTrash: combinedData
            }
        }).send(res)
    }

    getListFolderByFolderParrentId = async (req, res, next) => {
        const { folderId } = req.query

        if (!folderId) {
            throw new BadRequestError()
        }

        const folders = await foldersModel
            .find({ folderParent: folderId })
            .select("_id nameFolder memories   openedAt")
            .lean();

        const files = await filesModel
            .find({ folderParent: folderId })
            .select("_id nameFile  memories  folderPath  openedAt")
            .lean();

        const combinedData = [...folders, ...files].sort((a, b) => {
            return new Date(b.openedAt) - new Date(a.openedAt);
        });

        new OK({
            metadata: {
                success: true,
                listFolders: combinedData
            },
            message: 'Get data successfully!'
        }).send(res)
    }

    getFolderParrentId = async (req, res, next) => {
        const { folderId } = req.query

        const folder = await foldersModel.findOne({ _id: folderId }).populate({
            path: 'folderParent',
            select: 'nameFolder _id'
        }).select('_id nameFolder')

        new OK({
            metadata: {
                success: true,
                folder
            },
            message: 'Get data successfully!'
        }).send(res)
    }

}

module.exports = new AdminController
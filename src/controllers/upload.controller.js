const { OK } = require("../response/success.response")
const filesModel = require("../models/files.model")
const foldersModel = require("../models/folders.model")
const permissionModel = require("../models/permission.model")
const starsModel = require("../models/stars.model")
const usersModel = require("../models/users.model")
const { BadRequestError, NotFoundError, ConflictRequestError, UnauthorizedError, ForbiddenError, InternalServerError } = require("../response/error.ressponse")
const _ = require('lodash')
const fs = require('fs')
const path = require('path')
const { zipDirectory } = require('../services/zipFolderService')
const { log } = require("console")

const getAllFolder = async (folderParentId) => {
    let allFolderIds = [];
    let allFileIds = [];

    const listFolderIds = await foldersModel.find({ folderParent: folderParentId }).select('_id').lean();
    const listFileIds = await filesModel.find({ folderParent: folderParentId }).select('_id').lean();

    allFolderIds.push(...listFolderIds.map(folder => folder._id));
    allFileIds.push(...listFileIds.map(file => file._id));

    for (const folder of listFolderIds) {
        const result = await getAllFolder(folder._id);
        allFolderIds.push(...result.allFolderIds);
        allFileIds.push(...result.allFileIds);
    }

    return { allFolderIds, allFileIds };
};

const getAllFolderParrent = async (folderChildId) => {
    let allFolderIds = [];

    const listFolderIds = await foldersModel.find({ folderChild: folderChildId }).select('_id')
    allFolderIds.push(...listFolderIds.map(folder => folder._id));

    for (const folder of listFolderIds) {
        const result = await getAllFolderParrent(folder._id);
        allFolderIds.push(...result);
    }
    return allFolderIds;
}

const createFolderAndCopyFiles = async (folder, pathFolderParent) => {

    const pathFolderChild = path.join(pathFolderParent, folder.nameFolder);
    // await fs.mkdir(pathFolderChild, { recursive: true });
    fs.mkdirSync(pathFolderChild, { recursive: true })
    const fileChild = await filesModel.find({ folderParent: folder }).select("nameFile folderPath");

    await Promise.all(
        fileChild.map(async (file) => {
            const sourcePath = file.folderPath;
            const destPath = path.join(pathFolderChild, file.nameFile);
            fs.copyFileSync(sourcePath, destPath);
        })
    );

    const folderChild = await foldersModel.find({ folderParent: folder }).select("nameFolder");

    await Promise.all(
        folderChild.map(async (childFolder) => {
            await createFolderAndCopyFiles(childFolder, pathFolderChild);
        })
    );
};

class UploadController {
    uploadFiles = async (req, res, next) => {

        const files = req.files;
        const { folderId, userId } = req.body

        if (!files || files.length === 0 || !folderId || !userId) {
            throw new BadRequestError()
        }

        const folderParent = await foldersModel.findById(folderId)

        if (!folderParent) {
            throw new NotFoundError()
        }

        const user = await usersModel.findById(userId)

        if (!user) {
            throw new NotFoundError()
        }

        if (user.role === 'ADMIN') {
            throw new ForbiddenError()
        }

        const permission = await permissionModel.findOne({
            userId,
            $or: [
                { fileId: folderId },
                { folderId: folderId },
            ]
        });

        if (!permission) {
            throw new ForbiddenError()
        }

        let totalFileSize = 0;

        for (const file of files) {
            const newFile = await filesModel.create({
                nameFile: file.originalname,
                public: false,
                shareId: [],
                folderParent: folderParent,
                isTrash: false,
                isDelete: false,
                memories: file.size,
                createdBy: user,
                updatedBy: user,
                openedAt: new Date(),
                type: file.mimetype,
                folderPath: file.path
            });

            permission.fileId.push(newFile._id)

            if (file.size && typeof file.size === 'number' && file.size > 0) {
                totalFileSize += file.size;
            }
        }

        await permission.save()

        let allFolderIds = await getAllFolderParrent(folderParent._id)
        allFolderIds.push(folderParent._id)

        await Promise.all(allFolderIds.map(async (folderId) => {
            await foldersModel.findByIdAndUpdate(
                folderId,
                { $inc: { memories: totalFileSize } }
            );
        }))

        new OK({
            metadata: {
                success: true,
                totalFiles: files.length,
                totalSize: totalFileSize
            },
            message: 'Upload files successfully!'
        }).send(res)
    }

    uploadNewFoler = async (req, res, next) => {

        const { nameFolder, folderId, userId } = req.body

        if (!nameFolder || !folderId || !userId) {
            throw new BadRequestError()
        }

        const user = await usersModel.findById(userId)
        if (!user) {
            throw new NotFoundError()
        }

        if (user.role === 'ADMIN') {
            throw new ForbiddenError()
        }

        const folderParent = await foldersModel.findById(folderId)

        if (!folderParent) {
            throw new NotFoundError()
        }


        const permission = await permissionModel.findOne({ userId })
        if (!permission.folderId.includes(folderId)) {
            throw new UnauthorizedError()
        }

        const newFolder = await foldersModel.create({
            nameFolder: nameFolder,
            public: false,
            shareId: [],
            folderChild: [],
            fileChild: [],
            folderParent: folderParent,
            isTrash: false,
            isDelete: false,
            memories: 0,
            createdBy: user,
            updatedBy: user,
            openedAt: new Date()
        })

        folderParent.folderChild.push(newFolder)
        await folderParent.save()

        permission.folderId.push(newFolder._id)
        await permission.save()

        new OK({
            metadata: {
                success: true,
                newFolder: {
                    id: newFolder._id,
                    nameFolder: newFolder.nameFolder
                }
            },
            message: 'Created new folder successfully!'
        }).send(res)
    }

    getStorage = async (req, res, next) => {

        const { folderId, userId } = req.query

        if (!folderId || !userId) {
            throw new NotFoundError()
        }

        const folders = await foldersModel
            .find({ folderParent: folderId, isTrash: false })
            .populate({
                path: "updatedBy",
                select: "username",
            })
            .select("_id nameFolder memories updatedBy public openedAt")
            .lean();

        const files = await filesModel
            .find({ folderParent: folderId, isTrash: false })
            .populate({
                path: "updatedBy",
                select: "username",
            })
            .select("_id nameFile type memories updateBy public folderPath createdAt openedAt")
            .lean();

        const combinedData = [...folders, ...files].sort((a, b) => {
            return new Date(b.openedAt) - new Date(a.openedAt);
        });

        new OK({
            metadata: {
                success: true,
                storage: combinedData
            },
            message: 'Get data successfully!'
        }).send(res)
    }

    getFolder = async (req, res, next) => {

        const folderId = req.query.folderId

        if (!folderId) {
            throw new NotFoundError()
        }

        const folder = await foldersModel.findOne({ _id: folderId, isTrash: false }).populate({
            path: 'folderParent',
            select: 'nameFolder _id'
        }).select('_id nameFolder')


        folder.openedAt = new Date();
        await folder.save()

        new OK({
            metadata: {
                success: true,
                folder: folder
            },
            message: 'Get data successfully!'
        }).send(res)
    }

    deleteFolderOrFile = async (req, res, next) => {

        const { folderId } = req.body

        if (!folderId) {
            throw new NotFoundError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            file.isTrash = true;
            await file.save()
        } else {
            const folder = await foldersModel.findById(folderId)
            folder.isTrash = true;
            await folder.save()

        }

        new OK({
            metadata: {
                success: true
            },
            message: 'Delete successfully'
        }).send(res)
    }

    checkPermissionShareData = async (req, res, next) => {

        const { folderId, userId } = req.query

        if (!folderId) {
            throw new NotFoundError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            if (file.createdBy != userId) {
                throw new ConflictRequestError()
            }
        } else {
            const folder = await foldersModel.findById(folderId)
            if (folder.createdBy != userId) {
                throw new ConflictRequestError()
            }
        }

        new OK({
            metadata: {
                success: true
            },
            message: 'Checked permission'
        }).send(res)
    }

    shareData = async (req, res, next) => {

        const { folderId, listUserId } = req.body

        if (!folderId || _.isEmpty(listUserId)) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            const updatePromies = listUserId.map(userId => {
                return permissionModel.findOneAndUpdate(
                    { userId },
                    { $addToSet: { fileId: { $each: [folderId] } } },
                    { new: true, upsert: true }
                );
            })

            await filesModel.findByIdAndUpdate(folderId,
                {
                    $addToSet: { shareId: { $each: [listUserId] } }
                },
                { new: true }
            )

            await Promise.all(updatePromies);

        } else {
            let { allFolderIds = [], allFileIds = [] } = await getAllFolder(folderId);
            allFolderIds.push(folderId)

            const updatePermissionFolderPromies = listUserId.map(userId => {
                return permissionModel.findOneAndUpdate(
                    { userId },
                    { $addToSet: { folderId: { $each: allFolderIds } } },
                    { new: true, upsert: true }
                );
            })

            const updatePermissionFilePromies = listUserId.map(userId => {
                return permissionModel.findOneAndUpdate(
                    { userId },
                    { $addToSet: { fileId: { $each: allFileIds } } },
                    { new: true, upsert: true }
                );
            })


            await foldersModel.findByIdAndUpdate(folderId,
                {
                    $addToSet: { shareId: { $each: [listUserId] } }
                },
                { new: true }
            )

            await Promise.all(updatePermissionFolderPromies);
            await Promise.all(updatePermissionFilePromies);
        }
        new OK({
            metadata: {
                success: true,

            },
            message: 'Share folder or file with other user successfully'
        }).send(res)
    }

    getShareWithMe = async (req, res, next) => {

        const userId = req.query.userId
        if (!userId) {
            throw new BadRequestError()
        }

        const folders = await foldersModel.find(
            { shareId: { $in: [userId] }, isTrash: false }
        ).populate({
            path: "createdBy",
            select: "username",
        }).select('_id nameFolder memories createdBy updatedAt').lean();

        const files = await filesModel.find(
            { shareId: { $in: [userId] }, isTrash: false }
        ).populate({
            path: "createdBy",
            select: "username",
        }).select('_id nameFile memories createdBy updatedAt').lean();

        const combinedData = [...folders, ...files]
            .sort((a, b) => {
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
        new OK({
            metadata: {
                success: true,
                listShareWithMe: combinedData
            },
            message: 'Get data successfully'
        }).send(res)
    }

    getFolderShareWithMe = async (req, res, next) => {

        const { folderId, userId } = req.query

        if (!folderId || !userId) {
            throw new NotFoundError('Folder ID or User ID is missing');
        }

        const folder = await foldersModel
            .findOne({ _id: folderId, isTrash: false })
            .populate({
                path: 'folderParent',
                select: 'nameFolder _id',
            })
            .select('_id nameFolder folderParent')
            .lean();
        new OK({
            metadata: {
                success: true,
                folder: folder
            },
            message: 'Get data successfully'
        }).send(res)
    }

    rename = async (req, res, next) => {
        const { folderId, newRename } = req.body

        if (!newRename || !folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            if (file.nameFile === newRename) {
                throw new BadRequestError('Duplicated with old name')
            } else {
                file.nameFile = newRename
                await file.save()
            }
        } else {
            const folder = await foldersModel.findById(folderId);

            if (!folder) {
                throw new BadRequestError()
            }

            if (folder.nameFolder === newRename) {
                throw new BadRequestError('Duplicated with old name')
            } else {
                folder.nameFolder = newRename
                await folder.save()
            }
        }

        new OK({
            metadata: {
                success: true,
                newName: newRename
            },
            message: 'Changed file name'
        }).send(res)
    }

    getFolderTrash = async (req, res, next) => {
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
            metadata: {
                storage: combinedData,
                success: true
            },
            message: 'Get data successfully'
        }).send(res)
    }

    restore = async (req, res, next) => {

        const { folderId } = req.body

        if (!folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            file.isTrash = false
            await file.save()
        } else {
            const folder = await foldersModel.findById(folderId)
            folder.isTrash = false
            await folder.save()
        }

        new OK({
            metadata: {
                success: true
            },
            message: 'Restored file'
        }).send(res)
    }

    deleteDouble = async (req, res, next) => {

        const { folderId } = req.body

        if (!folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            if (file.isTrash === true) {
                file.isDelete = true
                await file.save()
            }
        } else {
            const folder = await foldersModel.findById(folderId)
            if (folder.isTrash = true) {
                folder.isDelete = true
                await folder.save()
            }
        }

        new OK({
            metadata: {
                success: true,
            },
            message: 'Delete data successfully'
        }).send(res)
    }

    addStar = async (req, res, next) => {
        const { userId, folderId } = req.body;
        if (!userId || !folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            await starsModel.findOneAndUpdate(
                { userId },
                { $addToSet: { fileId: folderId } },
                { new: true, upsert: true }
            )
        } else {
            await starsModel.findOneAndUpdate(
                { userId },
                { $addToSet: { folderId: folderId } },
                { new: true, upsert: true }
            )
        }
        new OK({
            metadata: {
                success: true
            },
            message: 'Add star successed'
        }).send(res)
    }

    disableStar = async (req, res, next) => {
        const { userId, folderId } = req.body;

        if (!userId || !folderId) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            await starsModel.findOneAndUpdate(
                { userId },
                { $pull: { fileId: folderId } },
                { new: true }
            )
        } else {
            await starsModel.findOneAndUpdate(
                { userId },
                { $pull: { folderId: folderId } },
                { new: true }
            )
        }
        new OK({
            metadata: {
                success: true
            },
            message: 'Disable star successed'
        }).send(res)
    }

    getStar = async (req, res, next) => {
        const { userId } = req.query

        if (!userId) {
            throw new BadRequestError()
        }

        const listStar = await starsModel
            .findOne({ userId })
            .populate({
                path: 'folderId',
                select: '_id nameFolder createdBy updatedAt memories',
                options: { sort: { updatedAt: -1 } },
                populate: {
                    path: 'createdBy',
                    select: 'username'
                }
            })
            .populate({
                path: 'fileId',
                select: '_id nameFile createdBy updatedAt memories',
                populate: {
                    path: 'createdBy',
                    select: 'username'
                }
            })
            .select('folderId fileId')

        new OK({
            metadata: {
                success: true,
                listStar: listStar
            },
            message: 'Get data successfully'
        }).send(res)
    }

    changePublic = async (req, res, next) => {
        const { folderId } = req.body

        if (!folderId) {
            throw new BadRequestError();
        }

        const file = await filesModel.findById(folderId);
        if (file) {
            file.public = !file.public;
            await file.save();
        } else {
            const folder = await foldersModel.findById(folderId);

            if (!folder) {
                throw new NotFoundError("Folder not found");
            }

            const newPublicState = !folder.public;

            const { allFolderIds, allFileIds } = await getAllFolder(folderId);

            await foldersModel.findByIdAndUpdate(folderId, { public: newPublicState });

            await Promise.all(
                allFolderIds.map(async (childFolderId) => {
                    await foldersModel.findByIdAndUpdate(childFolderId, { public: newPublicState });
                })
            );

            await Promise.all(
                allFileIds.map(async (fileId) => {
                    await filesModel.findByIdAndUpdate(fileId, { public: newPublicState });
                })
            );
        }

        new OK({
            metadata: {
                success: true
            },
            message: 'Change file to public successed'
        }).send(res)
    }

    getFolderOrFileById = async (req, res, next) => {
        const { folderId } = req.query

        const file = await filesModel.findById(folderId);

        if (file) {
            new OK({
                metadata: {
                    success: true,
                    nameFile: file.nameFile,
                    type: 'file',
                },
                message: 'Get data successed'
            }).send(res)
        } else {
            const folder = await foldersModel.findById(folderId);
            if (folder) {
                new OK({
                    metadata: {
                        success: true,
                        nameFile: folder.nameFolder,
                        type: 'folder',
                    },
                    message: 'Get data successed'
                }).send(res)
            } else {
                throw new NotFoundError()
            }
        }
    }

    getFileByUserId = async (req, res, next) => {
        const { userId } = req.query

        if (!userId) {
            throw new BadRequestError()
        }

        const files = await permissionModel.find({ userId })
            .populate(
                {
                    path: 'fileId',
                    select: 'nameFile createdBy openedAt',
                    match: { isTrash: false },
                    options: { sort: { openedAt: -1 } },
                    populate: {
                        path: 'createdBy',
                        select: 'username'
                    }
                }
            )
            .select('fileId').lean()

        new OK({
            metadata: {
                success: true,
                files: files
            },
            message: 'Get data successed'
        }).send(res)
    }

    getFolderByUserId = async (req, res, next) => {
        const { userId } = req.query

        if (!userId) {
            throw new BadRequestError()
        }

        const folders = await permissionModel.find({ userId })
            .populate(
                {
                    path: 'folderId',
                    select: 'nameFolder createdBy opendAt',
                    match: { isTrash: false },
                    options: { sort: { openedAt: -1 }, limit: 8 },
                    populate: {
                        path: 'createdBy',
                        select: 'username'
                    }
                }
            )
            .select('folderId')

        new OK({
            metadata: {
                success: true,
                folders: folders
            },
            message: 'Get data successed'
        }).send(res)
    }


    download = async (req, res, next) => {

        const { folderId } = req.query
        if (!folderId) {
            throw new BadRequestError('Folder ID is required');
        }

        const file = await filesModel.findById(folderId);
        if (file) {
            log(file.folderPath)
            res.download(file.folderPath, file.nameFile)
        } else {
            const folder = await foldersModel.findById(folderId);

            if (!folder) {
                throw new NotFoundError()
            }
            const pathFolderParent = path.join(__dirname, `../../uploads/download/${folderId}/${folder.nameFolder}`);
            fs.mkdirSync(pathFolderParent, { recursive: true });
            await createFolderAndCopyFiles(folder, pathFolderParent);

            await zipDirectory(folderId, pathFolderParent, folder.nameFolder)
                .then((zipFilePath) => {

                    if (!fs.existsSync(zipFilePath)) {
                        throw new NotFoundError(`File not found: ${zipFilePath}`)
                    }

                    res.download(zipFilePath, `${folder.nameFolder}.zip`, (err) => {
                        if (err) {
                            console.error('Error sending file:', err.message);
                            throw new InternalServerError('Error downloading file')
                        }
                        console.log('File sent successfully');
                    });

                })
                .catch((err) => {
                    console.error('Error while zipping directory:', err);
                });
        }
    }
}

module.exports = new UploadController
const { model } = require("mongoose")
const filesModel = require("../models/files.model")
const foldersModel = require("../models/folders.model")
const permissionModel = require("../models/permission.model")
const starsModel = require("../models/stars.model")
const usersModel = require("../models/users.model")
const { BadRequestError, NotFoundError, ConflictRequestError, UnauthorizedError, ForbiddenError } = require("../response/error.ressponse")
const _ = require('lodash')
const fs = require('fs')
const path = require('path')


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

    const pathFolderChild = path.join(pathFolderParent, folder._id);
    await fs.mkdir(pathFolderChild, { recursive: true });

    const fileChild = await filesModel.find({ folderParent: folder }).select("nameFile folderPath");

    await Promise.all(
        fileChild.map(async (file) => {
            const sourcePath = file.folderPath;
            const destPath = path.join(pathFolderChild, file.nameFile);
            await fs.copyFile(sourcePath, destPath);
        })
    );

    const folderChild = await foldersModel.find({ folderParent: folder }).select("nameFolder");

    await Promise.all(
        folderChild.map(async (childFolder) => {
            await createFolderAndCopyFiles(childFolder, pathFolderChild);
        })
    );
};

class UploadService {
    static uploadFiles = async ({ files, folderId, userId }) => {
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

        const permission = await permissionModel.findOne({
            userId,
            $or: [
                { 'fileId._id': folderId },
                { 'folderId._id': folderId },
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

        return {

        }
    }

    static uploadNewFoler = async ({ userId, nameFolder, folderId }) => {
        if (!nameFolder || !folderId || !userId) {
            throw new BadRequestError()
        }

        const user = await usersModel.findById(userId)
        if (!user) {
            throw new NotFoundError()
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

        return {

        }
    }

    static deleteFolderOrFile = async ({ folderId }) => {


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

        return {

        }
    }

    static checkPermissionShareData = async ({ folderId, userId }) => {
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

        return {

        }
    }

    static getStorage = async ({ folderId, userId }) => {
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

        return {
            storage: combinedData

        }
    }

    static getFolder = async (folderId) => {
        if (!folderId) {
            throw new NotFoundError()
        }

        const folder = await foldersModel.findOne({ _id: folderId, isTrash: false }).populate({
            path: 'folderParent',
            select: 'nameFolder _id'
        }).select('_id nameFolder')


        folder.openedAt = new Date();
        await folder.save()

        return {
            folder
        }
    }

    static getFolderShareWithMe = async ({ folderId, userId }) => {
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

        return {
            folder,
        };
    };


    static shareData = async ({ folderId, listUserId }) => {
        if (!folderId || _.isEmpty(listUserId)) {
            throw new BadRequestError()
        }

        const file = await filesModel.findById(folderId)

        if (file) {
            const updatePromies = listUserId.map(userId => {
                return permissionModel.findOneAndUpdate(
                    { userId },
                    { $addToSet: { fileId: { $each: folderId } } },
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



            let { allFolderIds, allFileIds } = await getAllFolder(folderId);
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

        return {

        }
    }

    static getShareWithMe = async (userId) => {
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

        return {
            listShareWithMe: combinedData
        }
    }

    static rename = async ({ folderId, newRename }) => {
        if (!newRename || !folderId) {
            throw new BadRequestError('1')
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

        return {

        }

    }

    static getFolderTrash = async ({ userId }) => {
        if (!userId) {
            throw new BadRequestError()
        }
        const folders = await foldersModel
            .find({ isTrash: true, isDelete: false })
            .populate({
                path: "createdBy",
                select: "username",
            })
            .select("_id nameFolder memories createdBy updatedAt updatedBy openedAt")
            .lean();

        const files = await filesModel
            .find({ isTrash: true, isDelete: false })
            .populate({
                path: "createdBy",
                select: "username",
            })
            .select("_id nameFile type memories createdBy updatedAt updateBy folderPath createdAt openedAt")
            .lean();

        const combinedData = [...folders, ...files].sort((a, b) => {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        return {
            storage: combinedData

        }
    }

    static restore = async ({ folderId }) => {
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
        return {}
    }

    static deleteDouble = async ({ folderId }) => {
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
        return {}
    }

    static addStar = async ({ userId, folderId }) => {
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
        return {

        }
    }

    static disableStar = async ({ userId, folderId }) => {
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
        return {

        }
    }

    static getStar = async ({ userId }) => {
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

        return {
            listStar
        }

    }

    static changePublic = async ({ folderId }) => {
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

        return {

        };
    };

    static download = async ({ folderId }) => {
        if (!folderId) {
            throw new BadRequestError('Folder ID is required');
        }

        const file = await filesModel.findById(folderId);
        if (file) {
            return {
                file,
                type: 'file'
            }
        } else {
            const folder = await foldersModel.findById(folderId);

            if (!folder) {
                throw new NotFoundError()
            }

            const pathFolderParent = path.resolve(`../../uploads/download/${folder._id}`);

            await fs.mkdir(pathFolderParent, { recursive: true });
            await createFolderAndCopyFiles(folder, pathFolderParent);

            zipDirectory(pathFolderParent, folder.nameFolder)
                .then((zipFilePath) => {
                    console.log(`ZIP file created at: ${zipFilePath}`);
                })
                .catch((err) => {
                    console.error('Error while zipping directory:', err);
                });

            const zipFilePath = await zipDirectory(pathFolderParent, folder.nameFolder);
            return {
                pathFolderZip: zipFilePath,
                nameFolder: folder.nameFolder,
                type: 'folder',
            };
        }
    };
}





module.exports = UploadService
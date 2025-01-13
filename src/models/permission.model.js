const { Schema, model } = require("mongoose");


const DOCUMENT_NAME = 'Permission'
const COLLECTION_NAME = 'permissions'

const permissionSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    folderId: {
        type: [Schema.Types.ObjectId],
        ref: 'Folder'
    },
    fileId: {
        type: [Schema.Types.ObjectId],
        ref: 'File'
    }
}, {
    timestamps: true,
    collection: COLLECTION_NAME
});

module.exports = model(DOCUMENT_NAME, permissionSchema)

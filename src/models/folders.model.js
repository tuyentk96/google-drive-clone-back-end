const { Schema, model } = require("mongoose");


const DOCUMENT_NAME = 'Folder'
const COLLECTION_NAME = 'folders'

const folderSchema = new Schema({
    nameFolder: {
        type: String,
        required: true,
        maxLength: 150
    },
    public: {
        type: Boolean,
        default: false
    },
    shareId: {
        type: [Schema.Types.ObjectId],
        ref: 'User'
    },
    folderChild: {
        type: [Schema.Types.ObjectId],
        ref: 'Folder'
    },
    folderParent: {
        type: Schema.Types.ObjectId,
        ref: 'Folder'
    },
    isTrash: {
        type: Boolean,
        default: false
    },
    isDelete: {
        type: Boolean,
        default: false
    },
    memories: {
        type: Number,
        default: 0,
        min: 0
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    openedAt: {
        type: Date
    },
}, {
    timestamps: true,
    collection: COLLECTION_NAME
})

module.exports = model(DOCUMENT_NAME, folderSchema)
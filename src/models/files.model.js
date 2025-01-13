const { Schema, model } = require("mongoose");


const DOCUMENT_NAME = 'File'
const COLLECTION_NAME = 'files'

const fileSchema = new Schema({
    nameFile: {
        type: String,
        required: true
    },
    public: {
        type: Boolean,
        default: false
    },
    shareId: {
        type: [Schema.Types.ObjectId],
        ref: 'User'
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
    type: {
        type: String
    },
    folderPath: {
        type: String
    }

}, {
    timestamps: true,
    collection: COLLECTION_NAME
})

module.exports = model(DOCUMENT_NAME, fileSchema)
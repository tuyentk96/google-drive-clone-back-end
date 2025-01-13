const { Schema, model } = require("mongoose");


const DOCUMENT_NAME = 'User'
const COLLECTION_NAME = 'users'

const userSchema = new Schema({
    username: {
        type: String,
        trim: true,
        required: true,
        maxLength: 150
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['ADMIN', 'USER', 'GUEST'],
        default: 'USER'
    },
    storage: {
        type: Schema.Types.ObjectId,
        ref: 'Folder',
        required: true,
    }
}, {
    timestamps: true,
    collection: COLLECTION_NAME
})

module.exports = model(DOCUMENT_NAME, userSchema)
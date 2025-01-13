const { Schema, model } = require("mongoose");


const DOCUMENT_NAME = 'ConfirmUser'
const COLLECTION_NAME = 'confirmUsers'

const userConfrimSchema = new Schema({
    username: {
        type: String,
        trim: true,
        required: true,
        maxLength: 150
    },
    password: {
        type: String,

    },
    email: {
        type: String,
        required: true,
    },
    accessNumber: {
        type: Number,
    }
}, {
    timestamps: true,
    collection: COLLECTION_NAME
})

module.exports = model(DOCUMENT_NAME, userConfrimSchema)
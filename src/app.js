const express = require('express');
const { configCors } = require('./configs/config.cors');
require('dotenv').config();
const app = express();

configCors(app)

// init middlewares
app.use(express.json())
app.use(express.urlencoded({ extends: true }))

// init db
require('./database/init.mongodb')

// init routes
app.use('', require('./routes'))


// handle error
app.use((req, res, next) => {
    const error = new Error('Not Found')
    error.status = 404;
    next(error)
})

app.use((error, req, res, next) => {
    const statusCode = error.status || 500
    return res.status(statusCode).json({
        status: 'Error',
        statusCode: statusCode,
        message: error.message || 'Internal Server Error'
    })
})

module.exports = app;
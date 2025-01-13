require('dotenv').config()

const dev = {
    appConfig: {
        port: process.env.DEV_APP_PORT,
        react_url: process.env.REACT_URL
    },
    dbConfig: {
        host: process.env.DEV_DB_HOST || '127.0.0.1',
        port: process.env.DEV_DB_PORT || 27017,
        name: process.env.DEV_DB_NAME || 'GGDriveDEV'
    },
    secretKey: {
        accessKey: process.env.ACCESS_TOKEN_SECRET,
        refreshKey: process.env.REFRESH_TOKEN_SECRET
    },
    emailConfig: {
        username: process.env.EMAIL_USERNAME,
        password: process.env.EMAIL_PASS
    }
}

const pro = {
    appConfig: {
        port: process.env.PRO_APP_PORT,
        react_url: process.env.REACT_URL
    },
    dbConfig: {
        host: process.env.PRO_DB_HOST || '127.0.0.1',
        port: process.env.PRO_DB_PORT || 27017,
        name: process.env.PRO_DB_NAME || 'GGDrivePRO'
    },
    secretKey: {
        accessKey: process.env.ACCESS_TOKEN_SECRET,
        refreshKey: process.env.REFRESH_TOKEN_SECRET
    },
    emailConfig: {
        username: process.env.EMAIL_USERNAME,
        password: process.env.EMAIL_PASS
    }
}

const config = { dev, pro }
const env = process.env.NODE_ENV || 'dev'

module.exports = config[env]
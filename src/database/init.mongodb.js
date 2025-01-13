const mongoose = require('mongoose')
const { dbConfig: { host, port, name } } = require('../configs/config.system')

const connectString = `mongodb://${host}:${port}/${name}`

class Database {
    constructor() {
        this.connect()
    }

    connect() {
        if (1 == 1) {
            mongoose.set('debug', true);
            mongoose.set('debug', { color: true })
        }

        mongoose.connect(connectString)
            .then(() => {
                console.log(`Connected MongoDb Successed!`);
            })
            .catch(err => console.log(`Error Connect::`, err));
    }

    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance
    }
}

const instanceMongoDb = Database.getInstance();
module.exports = instanceMongoDb
const app = require("./src/app");
const { appConfig: { port } } = require('./src/configs/config.system')


const PORT = port || 3056;

const server = app.listen(PORT, () => {
    console.log(`Server start with PORT::${PORT}`);
})

process.on('SIGINT', () => {
    server.close(() => {
        console.log(`Exit Server Express`);
    })
})


const multer = require('multer')
const path = require('path')
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const time = new Date();
        const year = time.getFullYear();
        const month = String(time.getMonth() + 1).padStart(2, '0');
        const day = String(time.getDate()).padStart(2, '0');

        const folderPath = path.join(__dirname, `../../uploads/${year}/${month}/${day}`);


        fs.mkdirSync(folderPath, { recursive: true });

        cb(null, folderPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + file.originalname;
        cb(null, uniqueSuffix);
    }
});

const upload = multer({ storage })

module.exports = upload;
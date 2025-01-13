const archiver = require("archiver");
const fs = require('fs')
const path = require('path')
/**
 * @param {String} sourceDir: /some/folder/to/compress
 * @param {String} outPath: /path/to/created.zip
 * @returns {Promise}
 */

const zipDirectory = async (folderId, sourceDir, zipFileName) => {
    // Đường dẫn đầy đủ tới file ZIP
    const outputDir = path.resolve(__dirname, `../../uploads/download/fileZip/${folderId}`); // Thư mục lưu file ZIP
    const zipFilePath = path.join(outputDir, `${zipFileName}.zip`); // Tên file ZIP đầy đủ

    // Tạo thư mục lưu trữ nếu chưa tồn tại
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Tạo stream ghi file ZIP
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            console.log(`Zipped ${archive.pointer()} total bytes`);
            resolve(zipFilePath); // Trả về đường dẫn tới file ZIP
        });

        archive.on('error', (err) => reject(err));

        // Ghi dữ liệu vào stream
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
};

module.exports = {
    zipDirectory
}
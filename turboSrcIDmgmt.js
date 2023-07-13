const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, './turboSrcInstances/');

function createDirectoryIfNotExist() {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

function createFile(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
    }
}

function checkFileExists(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);
    return fs.existsSync(filePath);
}

module.exports = {
    createDirectoryIfNotExist,
    createFile,
    checkFileExists
};
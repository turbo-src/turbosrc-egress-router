const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, './turboSrcInstances/');
const turboSrcID = '0x9e81be64b30a850e038cb5a85241f58528010016';
const reponame = 'reibase/marialis';

/**
 * Initializes module by creating the turboSrcID file for reibase/marialis if it doesn't exist.
 */
function initialize() {
    createDirectoryIfNotExist();

    if (!checkFileExists(turboSrcID)) {
        createFile(turboSrcID);
        addRepoToTurboSrcInstance(turboSrcID, reponame);
    }
}

/**
 * Creates directory if it does not exist.
 */
function createDirectoryIfNotExist() {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}


/**
 * Creates a file with the given turboSrcID, if it does not already exist.
 * @param {string} turboSrcID - The ID of the turbosrc instance.
 */
function createFile(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '');
    }
}

/**
 * Checks if a file with the given turboSrcID exists.
 * @param {string} turboSrcID - The ID of the turbosrc instance.
 * @returns {boolean} True if the file exists, false otherwise.
 */
function checkFileExists(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);
    return fs.existsSync(filePath);
}

/**
 * Adds a repository name to the file of the given turboSrcID.
 * @param {string} turboSrcID - The ID of the turbosrc instance.
 * @param {string} reponame - The name of the repository to be added.
 */
function addRepoToTurboSrcInstance(turboSrcID, reponame) {
    const filePath = path.join(directoryPath, turboSrcID);

    if (!checkFileExists(turboSrcID)) {
        createFile(turboSrcID);
    }

    // Read the current content of the file
    let content = fs.readFileSync(filePath, 'utf-8');
    let repoList = content.trim().split('\n');

    // Check if the repository is already listed
    if (!repoList.includes(reponame)) {
        // If it's not listed, append it to the file
        fs.appendFileSync(filePath, `${reponame}\n`);
    }
}

/**
 * Returns the turboSrcID of the instance associated with the given repository name.
 * @param {string} reponame - The name of the repository to search for.
 * @returns {string|null} The turboSrcID if found, null otherwise.
 */
function getTurboSrcIDFromRepoName(reponame) {
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        if (content.includes(`${reponame}\n`)) {
            return path.basename(file);
        }
    }

    return null;
}

/**
 * Reads and returns the list of repo names associated with a turbosrc id.
 * @param {string} turboSrcID - The ID of the turbosrc instance.
 * @returns {string[]} An array of repo names associated with the given turbosrc id.
 */
function getRepoNamesFromTurboSrcID(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);

    if (!checkFileExists(turboSrcID)) {
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Assuming that repo names are written line by line, split content by newlines.
    return content.trim().split('\n');
}

module.exports = {
    createDirectoryIfNotExist,
    createFile,
    checkFileExists,
    addRepoToTurboSrcInstance,
    getTurboSrcIDFromRepoName,
    getRepoNamesFromTurboSrcID
};

initialize()
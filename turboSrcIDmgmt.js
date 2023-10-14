const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, './turboSrcInstances/');

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
 * Adds a repository name and its associated ID to the file of the given turboSrcID.
 * @param {string} turboSrcID - The ID of the turbosrc instance.
 * @param {string} reponame - The name of the repository to be added.
 * @param {string} repoID - The ID of the repository to be added.
 */
function addRepoToTurboSrcInstance(turboSrcID, reponame, repoID) {
    const filePath = path.join(directoryPath, turboSrcID);

    if (!checkFileExists(turboSrcID)) {
        createFile(turboSrcID);
    }

    // Read the current content of the file
    let content = fs.readFileSync(filePath, 'utf-8');
    let repoList = content.trim().split('\n');

    const repoEntry = `${reponame} ${repoID}`;

    // Check if the repository entry is already listed
    if (!repoList.includes(repoEntry)) {
        // If it's not listed, append it to the file
        fs.appendFileSync(filePath, `${repoEntry}\n`);
    }
}

function getTurboSrcIDFromRepoName(reponame) {
    console.log('getTurboSrcIDFromRepoName turboSrcIDmgmt reponame: ' + reponame)
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
	console.log('file content\n', content)
        const repoList = content.trim().split('\n');
	console.log('repoList:\n', repoList)

        if (repoList.some(repoEntry => repoEntry.startsWith(`${reponame} `))) {
	    console.log('turboSrcID path.basename(file): ', path.basename(file))
            return path.basename(file);
        }
    }

    return null;
}

function getTurboSrcIDFromRepoID(repoID) {
    console.log('getTurboSrcIDFromRepoID turboSrcIDmgmt repoID: ' + repoID)
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
	console.log('file content\n', content)
        const repoList = content.trim().split('\n');
	console.log('repoList:\n', repoList)

        if (repoList.some(repoEntry => repoEntry.endsWith(` ${repoID}`))) {
	    console.log('turboSrcID path.basename(file): ', path.basename(file))
            return path.basename(file);
        }
    }

    return null;
}

function getRepoNamesFromTurboSrcID(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);

    if (!checkFileExists(turboSrcID)) {
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Extracting repo names from the entries
    return content.trim().split('\n').map(repoEntry => repoEntry.split(' ')[0]);
}



/**
 * Reads and returns the list of repo IDs associated with a turbosrc id.
 * @param {string} turboSrcID - The ID of the turbosrc instance.
 * @returns {string[]} An array of repo IDs associated with the given turbosrc id.
 */
function getRepoIDsFromTurboSrcID(turboSrcID) {
    const filePath = path.join(directoryPath, turboSrcID);

    if (!checkFileExists(turboSrcID)) {
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Extracting repo IDs from the entries. Assuming the format is "reponame repoID".
    return content.trim().split('\n').map(repoEntry => repoEntry.split(' ')[1]);
}

module.exports = {
    createDirectoryIfNotExist,
    createFile,
    checkFileExists,
    addRepoToTurboSrcInstance,
    getTurboSrcIDFromRepoName,
    getTurboSrcIDFromRepoID,
    getRepoNamesFromTurboSrcID,
    getRepoIDsFromTurboSrcID
};

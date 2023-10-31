const express = require('express');
const cors = require('cors');
const socketIO = require('socket.io');
const http = require('http');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const {
  createDirectoryIfNotExist,
  createFile,
  checkFileExists,
  addRepoToTurboSrcInstance,
  getTurboSrcIDFromRepoName,
  getTurboSrcIDFromRepoID,
  getRepoNamesFromTurboSrcID
} = require('./turboSrcIDmgmt');
const { sign } = require('crypto');
const Wallet = require('ethereumjs-wallet');
const ethUtil = require('ethereumjs-util');

const app = express();
app.use(cors());
app.use(bodyParser.json());

createRepoRequest = {}
const incompatibleTurboSrcIDs = new Map();

function getTurboSrcID() {
  return process.env.TURBOSRC_ID;
}

const turboSrcIDfromInstance = getTurboSrcID();

function getCompatibleVersions() {
  const oids = process.env.COMPATIBLE_VERSIONS;
  return JSON.parse(oids);
}

console.log(getCompatibleVersions()); // Will print ["oid1", "oid2", "oid3"]

function getTurboSrcSystemInfo(turboSrcID, clientCurrentVersion) {
    console.log(`getTurboSrcSystemInfo turboSrcIDmgmt\nturboSrcID: "${turboSrcID}"\nclientCurrentVersion: "${clientCurrentVersion}"`);
    let instanceCompatilbeWithRouter = "yes";

    // Check if the currentVersion is compatible
    const compatibleVersions = getCompatibleVersions();
    if (!compatibleVersions.includes(clientCurrentVersion)) {
        instanceCompatilbeWithRouter = "no";
    }  // Removed the extra parenthesis here

    const message = "github.com/turbo-src/turbo-src";

    return { instanceCompatilbeWithRouter, message };
}

function verifySignedTurboSrcID(signedTurboSrcID, turboSrcID) {
  // Convert the turboSrcID to a Buffer if it isn't already
  const turboSrcIDBuffer = Buffer.isBuffer(turboSrcID) ? turboSrcID : ethUtil.toBuffer(turboSrcID);

  // Firstly, hash the message using keccak256 (standard for Ethereum)
  const messageHash = ethUtil.keccak256(turboSrcIDBuffer);

  // Separate the v, r, and s components from the signature
  const signatureBuffer = Buffer.from(signedTurboSrcID, 'hex');
  const r = signatureBuffer.slice(0, 32);
  const s = signatureBuffer.slice(32, 64);
  const v = signatureBuffer.readUInt8(64);

  // Recover the public key from the signature and message hash
  const publicKey = ethUtil.ecrecover(messageHash, v, r, s);

  // Derive the Ethereum address from the public key and add the 0x prefix
  const derivedAddress = "0x" + ethUtil.publicToAddress(publicKey).toString('hex');

  // Compare the derived address with the provided Ethereum address
  if (derivedAddress.toLowerCase() !== turboSrcID.toLowerCase()) {
      console.log(`Connecting instance (${turboSrcID}) isn't the owner due to invalid signature.`);
      return false;  // return false if the signature is invalid
  }
  return true;  // return true if the signature is valid
}

// Create a new express app for the second server
const app4007 = express();
app4007.use(cors({
  origin: ["https://turbosrc-marialis.dev", "chrome-extension://iheeaooklhfljkpaahemgfjhbppambjj"]
}));

const directoryPath = path.join(__dirname, './turboSrcInstances/');

const server = http.createServer(app);
const server4007 = http.createServer(app4007);  // use app4007 in the server creation

const port = process.env.PORT || 4006;
const port4007 = 4007;

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});
const io4007 = socketIO(server4007, {
  path: '/vote-client/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});
const pendingResponses = new Map();
const socketMap = new Map();

createDirectoryIfNotExist();

// Populating the map with the turboSrcIDs at startup
fs.readdirSync(directoryPath).forEach((file) => {
  const turboSrcID = path.basename(file, '.txt');
  socketMap.set(turboSrcID, null);
});

console.log(socketMap)

io.on('connection', (socket) => {
  console.log('Connected to an ingressRouter');

  socket.on('newConnection', (turboSrcID, signedTurboSrcIDturboSrcID, reponame, currentVersion) => {
    console.log("newConnection: ", turboSrcID, signedTurboSrcIDturboSrcID, reponame, currentVersion)

    // Check if the currentVersion is compatible
    const compatibleVersions = getCompatibleVersions();
    if (!compatibleVersions.includes(currentVersion)) {
      socket.emit('versionMismatch', {
        message: "You are not running a compatible version. Please pull master.",
        suggestedVersion: compatibleVersions[compatibleVersions.length - 1]
      });
      incompatibleTurboSrcIDs.set(turboSrcID, true);
      return; // Exit the function early, as the version is not compatible
    }

    const isValidSignature = verifySignedTurboSrcID(signedTurboSrcIDturboSrcID, turboSrcID);


    if (isValidSignature) {
        if (!checkFileExists(turboSrcID)) {
          createFile(turboSrcID);
          addRepoToTurboSrcInstance(turboSrcID, reponame);
        }

        socketMap.set(turboSrcID, socket);
        console.log('Validated turboSrcID from message signature.')
    } else {
      console.log("Invalid turboSrcID. Not adding to socketMap. Signed turboSrcID does not match turboSrcID.");
    }
  });

  socket.on('graphqlResponse', ({ requestId, body }) => {
      if (body && body.data && body.data.createRepo && body.data.createRepo.status === 201) {
          console.log('\ncreate repo called\n');
          const responseReponame = body.data.createRepo.repoName; // Note the change from reponame to repoName based on the example response
          const repoID = body.data.createRepo.repoID;

          if (createRepoRequest.reponame && createRepoRequest.reponame === responseReponame) {
              addRepoToTurboSrcInstance(createRepoRequest.turboSrcID, responseReponame, repoID);
              console.log('response', responseReponame, repoID);
          } else {
              console.error('Mismatch in reponame between request and response');
          }

      } else {
          console.error(`No pending response found for request ID ${requestId}`);
      }

      const respond = pendingResponses.get(requestId);
      clearTimeout(respond.timeout);
      respond.callback(body);
      pendingResponses.delete(requestId);
  });

  socket.on('disconnect', () => {
    // Remove the turboSrcID from socketMap
    for (let [key, value] of socketMap.entries()) {
      if (value === socket) {
        socketMap.delete(key);
      }
    }

    // Remove the turboSrcID from incompatibleTurboSrcIDs
    incompatibleTurboSrcIDs.delete(turboSrcID);
  });


  socket.on('connect_error', (error) => {
    console.error(`Connection to egress-router failed. Error:`, error);
  });

  socket.on('error', (error) => {
    console.error(`Socket.IO error:`, error);
  });

  socket.on('reconnect_error', (error) => {
    console.error(`Reconnection failed. Error:`, error);
  });
});

io4007.on('connection', (socket) => {
  console.log('Connected to a voting client');

  socket.on('vote cast', (user, repo, issueID) => {
    console.log('vote received', user, repo, issueID);
    io4007.emit('vote received', user, repo, issueID);
  });

  socket.on('update repo', (repo) => {
    console.log('repo updated', repo);
    io4007.emit('repo updated', repo);
  });

  //socket.on('vote cast', (message) => {
  //  console.log("Vote cast: ", message);
  //  socket.emit('vote received', { message: `Received your vote: ${message}` });
  //});

  socket.on('connect_error', (error) => {
    console.error(`Connection to egress-router failed. Error:`, error);
  });

  socket.on('error', (error) => {
    console.error(`Socket.IO error:`, error);
  });

  socket.on('reconnect_error', (error) => {
    console.error(`Reconnection failed. Error:`, error);
  });
});

app4007.get('/', (req, res) => {
  res.send('GET request to the homepage');
});

app.post('/graphql', (req, res) => {
  console.log('routing query:', req.body.query)
  const requestId = Date.now().toString();

  // Extract turboSrcID
  const turboSrcIDpattern = /turboSrcID:\s*"(.*?)"/;
  const turboSrcIDmatch = req.body.query.match(turboSrcIDpattern);
  const turboSrcID = turboSrcIDmatch ? `${turboSrcIDmatch[1]}` : undefined;
  console.log('graphql message from turboSrcID ', turboSrcID)

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getTurboSrcIDfromInstance")) {
    console.log("getTurboSrcIDfromInstance", turboSrcIDfromInstance)
    return res.json({ data: { getTurboSrcIDfromInstance: turboSrcIDfromInstance } });
  }

  if (req.body.query.includes("createRepo")) {
    // '{ createRepo(turboSrcID: "0xbb0f50e0e76b9c7116be080240b2e150d70d0b0a", owner: "7db9a", repo: "demo", defaultHash: "", contributor_id: "0x70c3183970d5dd9c7c76018050843d2804d0dd89", side: "", token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJnaXRodWJUb2tlbiI6Imdob19MSDF3c3dIcmo5SXIyeHYyUHI4a0REcmQyY1dqc1QzVDY5NWsiLCJpYXQiOjE2OTYyNjk4NjF9.26Qv2ADCmsEFnHuGnQYfZ8BTYETJzvoE8IzdNw6PTY8") {status, repoName, repoID, repoSignature, message} } '
    // Patterns with \s* to handle potential spaces
    const reponamePattern = /owner:\s*"(.*?)",\s*repo:\s*"(.*?)"/;
    const contributorIDpattern = /contributor_id:\s*"(.*?)"/;

    // Extract reponame
    const repoMatch = req.body.query.match(reponamePattern);
    const reponame = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : undefined;

    // Extract contributorID
    const contributorIDmatch = req.body.query.match(contributorIDpattern);
    const contributorID = contributorIDmatch ? `${contributorIDmatch[1]}` : undefined;

    createRepoRequest = {
      reponame,
      turboSrcID,
      contributorID
    };

    console.log("Parsed values:", createRepoRequest);

    //addRepoToTurboSrcInstance(turboSrcID, reponame);
  }

  if (req.body.query.includes("getTurboSrcSystemInfo")) {
    const turboSrcIDPattern = /turboSrcID: "(.*?)"/;
    const clientCurrentVersionPattern = /clientCurrentVersion: "(.*?)"/;

    const turboSrcIDMatch = req.body.query.match(turboSrcIDPattern);
    const clientCurrentVersionMatch = req.body.query.match(clientCurrentVersionPattern);

    const turboSrcID = turboSrcIDMatch ? turboSrcIDMatch[1] : undefined;
    const clientCurrentVersion = clientCurrentVersionMatch ? clientCurrentVersionMatch[1] : undefined;

    console.log('graphql message getTurboSrcSystemInfo turboSrcID: ' + turboSrcID);
    console.log('graphql message getTurboSrcSystemInfo clientCurrentVersion: ' + clientCurrentVersion);

    const result = getTurboSrcSystemInfo(turboSrcID, clientCurrentVersion); // This should be the server-side function that computes or fetches the necessary data
    const { instanceCompatilbeWithRouter, message } = result;

    console.log('graphql message getTurboSrcSystemInfo instanceCompatilbeWithRouter:', instanceCompatilbeWithRouter);
    console.log('graphql message getTurboSrcSystemInfo message:', message);

    return res.json({
        data: {
            getTurboSrcSystemInfo: {
                instanceCompatilbeWithRouter,
                message
            }
        }
    });
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getTurboSrcIDFromRepoName")) {
    const reponamePattern = /reponame: "(.*?)"/;
    const reponameMatch = req.body.query.match(reponamePattern);
    const reponame = reponameMatch ? reponameMatch[1] : undefined;
    console.log('graphql message getTurboSrcIDFromRepoName reponame: ' + reponame)
    const result = getTurboSrcIDFromRepoName(reponame);
    console.log('getTurboSrcIDFromRepoName(reponame)', result)
    console.log('graphql message getTurboSrcIDFromRepoName turboSrcID: ' + turboSrcID)
    return res.json({ data: { turboSrcID: result } });
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getTurboSrcIDFromRepoID")) {
    const repoIDpattern = /repoID: "(.*?)"/;
    const repoIDmatch = req.body.query.match(repoIDpattern);
    const repoID = repoIDmatch ? repoIDmatch[1] : undefined;
    console.log('graphql message getTurboSrcIDFromRepoID repoID: ' + repoID)
    const result = getTurboSrcIDFromRepoID(repoID);
    console.log('getTurboSrcIDFromRepoID(repoID)', result)
    console.log('graphql message getTurboSrcIDFromRepoID turboSrcID: ' + turboSrcID)
    return res.json({ data: { turboSrcID: result } });
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getRepoNamesFromTurboSrcID")) {
    const result = getRepoNamesFromTurboSrcID(turboSrcID);
    return res.json({ data: { reponames: result } });
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getRepoIDsFromTurboSrcID")) {
    const result = getRepoIDsFromTurboSrcID(turboSrcID);
    return res.json({ data: { repoIDs: result } });
  }

  const socket = socketMap.get(turboSrcID);

  // If the instance is on an incompatible version, return an error right away.
  if (incompatibleTurboSrcIDs.has(turboSrcID)) {
      console.log(`Request from incompatible turboSrcID ${turboSrcID} blocked.`);
      res.status(400).send('Request from incompatible version blocked.');
      return; // End the processing here.
  }

  // Emit if instance is compatible.
  socket.emit('graphqlRequest', {
      requestId: requestId,
      query: req.body.query,
      variables: req.body.variables
  });

  const respond = {
      callback: (data) => res.json(data),
      timeout: setTimeout(() => {
          res.status(500).send('Request timed out.');
          pendingResponses.delete(requestId);
      }, 2000) // 2 seconds
  };

  pendingResponses.set(requestId, respond);
});

server.listen(port, () => console.log(`Listening on port ${port}`));
server4007.listen(port4007, () => console.log(`Listening on port ${port4007}`));

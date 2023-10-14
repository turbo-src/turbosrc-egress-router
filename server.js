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
  getRepoNamesFromTurboSrcID,
} = require('./turboSrcIDmgmt');

const app = express();
app.use(cors());
app.use(bodyParser.json());

createRepoRequest = {}

function getTurboSrcID() {
  return process.env.TURBOSRC_ID;
}

const turboSrcIDfromInstance = getTurboSrcID();

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

  socket.on('newConnection', (turboSrcID, reponame) => { 
    // here reponame is a placeholder for a new connection
    // so we just pretend the reponame is also the repoid
    repoID = reponame
    console.log("newConnection: ", turboSrcID, reponame, repoID)

    if (!checkFileExists(turboSrcID)) {
      createFile(turboSrcID);
      addRepoToTurboSrcInstance(turboSrcID, reponame, repoID);
    }

    socketMap.set(turboSrcID, socket);
  });

    socket.on('graphqlResponse', ({ requestId, body }) => {
         //responding {
         //  data: {
         //    createRepo: {
         //      status: 200,
         //      repoName: '7db9a/demo',
         //      repoID: '0x2fc598246e75243383c3bf31e44e84e84e1473f0',
         //      repoSignature: '0xb6f3695be93f6f510ddd9e24a1368b00e8eda438d6320645038dca544b8815fa',
         //      message: 'repo found'
         //    }
         //  }
         //}
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

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getTurboSrcIDFromRepoName")) {
    const reponamePattern = /reponame: "(.*?)"/;
    const reponameMatch = req.body.query.match(reponamePattern);
    const reponame = reponameMatch ? reponameMatch[1] : undefined;
    console.log('graphql message getTurboSrcIDFromRepoName reponame: ' + reponame)
    const result = getTurboSrcIDFromRepoName(reponame);
    console.log('graphql message getTurboSrcIDFromRepoName turboSrcID: ' + turboSrcID)
    return res.json({ data: { turboSrcID: result } });
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getTurboSrcIDFromRepoID")) {
    const repoIDpattern = /repoID: "(.*?)"/;
    const repoIDmatch = req.body.query.match(repoIDpattern);
    const repoID = repoIDmatch ? repoIDmatch[1] : undefined;
    console.log('graphql message getTurboSrcIDFromRepoID repoID: ' + repoID)
    const result = getTurboSrcIDFromRepoName(repoID);
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

  // Same aren't sent to turbosrc-service ingress router.
  const socket = socketMap.get(turboSrcID);
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

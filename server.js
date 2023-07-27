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
  getRepoNamesFromTurboSrcID,
} = require('./turboSrcIDmgmt');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create a new express app for the second server
const app4007 = express();
app4007.use(cors());

const directoryPath = path.join(__dirname, './turboSrcInstances/');

const server = http.createServer(app);
const server4007 = http.createServer(app4007);  // use app4007 in the server creation

const port = process.env.PORT || 4006;
const port4007 = 4007;

const io = socketIO(server);
const io4007 = socketIO(server4007, {
  cors: {
    origin: "*", // accept requests from all origins
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

  socket.on('newConnection', (turboSrcID) => {
    console.log("newConnection: ", turboSrcID)

    if (!checkFileExists(turboSrcID)) {
      createFile(turboSrcID);
    }

    socketMap.set(turboSrcID, socket);
  });

  socket.on('graphqlResponse', ({ requestId, body }) => {
    const respond = pendingResponses.get(requestId);
    if (respond) {
      console.log('responding', body)
      clearTimeout(respond.timeout);
      respond.callback(body);
      pendingResponses.delete(requestId);
    } else {
      console.error(`No pending response found for request ID ${requestId}`);
    }
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

app.post('/graphql', (req, res) => {
  const requestId = Date.now().toString();

  const turboSrcIDPattern = /turboSrcID: "(.*?)"/;
  const match = req.body.query.match(turboSrcIDPattern);
  const turboSrcID = match ? match[1] : undefined;
  console.log('graphql message from turboSrcID ', turboSrcID)

  if (req.body.query.includes("createRepo")) {
    const reponamePattern = /owner: "(.*?)", repo: "(.*?)"/;
    const repoMatch = req.body.query.match(reponamePattern);
    const reponame = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : undefined;
    addRepoToTurboSrcInstance(turboSrcID, reponame);
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getTurboSrcIDFromRepoName")) {
    const reponamePattern = /reponame: "(.*?)"/;
    const reponameMatch = req.body.query.match(reponamePattern);
    const reponame = reponameMatch ? reponameMatch[1] : undefined;
    const result = getTurboSrcIDFromRepoName(reponame);
    return res.json({ data: { turboSrcID: result } });
  }

  // If returned, will not hit ingress router.
  if (req.body.query.includes("getRepoNamesFromTurboSrcID")) {
    const result = getRepoNamesFromTurboSrcID(turboSrcID);
    return res.json({ data: { reponames: result } });
  }

  // Same aren't sent to turbosrc-service ingress router.
  const socket = socketMap.get(turboSrcID);
  console.log('routing query:', req.body.query)
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

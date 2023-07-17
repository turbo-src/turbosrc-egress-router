const express = require('express');
const cors = require('cors');
const socketIO = require('socket.io');
const http = require('http');
const bodyParser = require('body-parser');
const {
  createDirectoryIfNotExist,
  createFile,
  checkFileExists,
  addRepoToTurboSrcInstance,
  getTurboSrcIdFromRepoName,
  getRepoNamesFromTurboSrcID,
} = require('./turboSrcIDmgmt');

const app = express();

app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const port = process.env.PORT || 4006;

const io = socketIO(server);

const pendingResponses = new Map();
const socketMap = new Map();

createDirectoryIfNotExist();

// Populating the map with the turboSrcIDs at startup
fs.readdirSync(directoryPath).forEach((file) => {
  const turboSrcID = path.basename(file, '.txt');
  socketMap.set(turboSrcID, null);
});

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

    const socket = socketMap.get(turboSrcID);

    console.log('routing query:', req.body.query)
    socket.emit('graphqlRequest', {
      requestId: requestId,
      query: req.body.query,
      variables: req.body.variables
    });

    if (req.body.query.includes("getTurboSrcIdFromRepoName")) {
      const reponamePattern = /reponame: "(.*?)"/;
      const reponameMatch = req.body.query.match(reponamePattern);
      const reponame = reponameMatch ? reponameMatch[1] : undefined;
      const result = getTurboSrcIdFromRepoName(reponame);
      return res.json({ data: { turboSrcID: result } });
    }

    if (req.body.query.includes("getRepoNamesFromTurboSrcID")) {
      const result = getRepoNamesFromTurboSrcID(turboSrcID);
      return res.json({ data: { reponames: result } });
    }

    const respond = {
      callback: (data) => res.json(data),
      timeout: setTimeout(() => {
        res.status(500).send('Request timed out.');
        pendingResponses.delete(requestId);
      }, 2000) // 2 seconds
    };

    pendingResponses.set(requestId, respond);
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));
const express = require('express');
const cors = require('cors');
const socketIO = require('socket.io');
const http = require('http');
const bodyParser = require('body-parser');
const { createDirectoryIfNotExist, createFile, checkFileExists } = require('./turboSrcIDmgmt');


// Start Express
const app = express();

// Allow all origins.
app.use(cors());

// Use JSON body parser for GraphQL
app.use(bodyParser.json());

// Start HTTP server
const server = http.createServer(app);
const port = process.env.PORT || 4006;

// Start socket.io
const io = socketIO(server);

// This map will store pending responses
// Key: request ID, Value: response function
const pendingResponses = new Map();

// Check and create directory if not exists
createDirectoryIfNotExist();

io.on('connection', (socket) => {
  console.log('Connected to an ingressRouter');

  socket.on('newConnection', (turboSrcID) => {
    console.log("newConnection: ", turboSrcID)

    // Check if the turboSrcID file already exists, if not create it.
    if (!checkFileExists(turboSrcID)) {
      createFile(turboSrcID);
    }

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

    console.log('routing query:', req.body.query)
    socket.emit('graphqlRequest', {
      requestId: requestId,
      query: req.body.query,
      variables: req.body.variables
    });

    // Set a timeout for each response
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

// Start the server
server.listen(port, () => console.log(`Listening on port ${port}`));
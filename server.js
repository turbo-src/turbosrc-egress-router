const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const bodyParser = require('body-parser');

// Start Express
const app = express();

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

// Wait for connections from the ingress-router
io.on('connection', (socket) => {
  console.log('Connected to an ingressRouter');

  // Setup a handler for the response
  socket.on('graphqlResponse', ({ requestId, data, errors }) => {
    // Get the response callback and call it
    const respond = pendingResponses.get(requestId);
    if (respond) {
      console.log('responding', data)
      respond({ data, errors });
      pendingResponses.delete(requestId);
    } else {
      console.error(`No pending response found for request ID ${requestId}`);
    }
  });

  // Route for GraphQL requests
  app.post('/graphql', (req, res) => {
    // Create a unique ID for this request
    const requestId = Date.now().toString();

    // Send GraphQL request to the ingress-router via socket
    console.log('routing query:', req.body.query)
    socket.emit('graphqlRequest', {
      requestId: requestId,
      query: req.body.query,
      variables: req.body.variables
    });

    // Store the response callback
    pendingResponses.set(requestId, (data) => {
      // Forward the response back to the client
      res.json(data);
    });
  });
});

// Start the server
server.listen(port, () => console.log(`Listening on port ${port}`));
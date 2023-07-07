const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const superagent = require('superagent');

// Start Express
const app = express();

// Start HTTP server
const server = http.createServer(app);
const port = process.env.PORT || 4006;

// Start socket.io
const io = socketIO(server);

// This map will store the connections to the Turbosrc instances
// Key: instance ID, Value: socket object
const turbosrcInstances = new Map();

// This map will store pending responses
// Key: request ID, Value: response function
const pendingResponses = new Map();

// Handler for connections from incomingRouter
io.of('/incomingRouter').on('connection', (socket) => {
  console.log('Connected to an incomingRouter');

  // Handler for GraphQL requests
  socket.on('graphqlRequest', ({ requestId, query, variables }) => {
    // Choose a Turbosrc instance
    // This is a simplistic approach, your choice of instance may vary
    const instanceSocket = Array.from(turbosrcInstances.values())[0];

    if (instanceSocket) {
      // Send the request to the Turbosrc instance
      instanceSocket.emit('graphqlRequest', { requestId, query, variables });

      // Store the response callback
      pendingResponses.set(requestId, (data) => {
        // Forward the response back to the incomingRouter
        socket.emit(`graphqlResponse:${requestId}`, data);
      });
    } else {
      console.error('No Turbosrc instances available');
    }
  });
});

// Handler for connections from Turbosrc instances
io.of('/turbosrcInstance').on('connection', (socket) => {
  console.log('Connected to a Turbosrc instance');

  // The instance should send its ID when it connects
  socket.on('register', (instanceId) => {
    turbosrcInstances.set(instanceId, socket);
    console.log(`Registered Turbosrc instance ${instanceId}`);
  });

  // Handler for GraphQL responses
  socket.on('graphqlResponse', ({ requestId, data, errors }) => {
    // Get the response callback and call it
    const respond = pendingResponses.get(requestId);
    if (respond) {
      respond({ data, errors });
      pendingResponses.delete(requestId);
    } else {
      console.error(`No pending response found for request ID ${requestId}`);
    }
  });

  // Remove the instance when it disconnects
  socket.on('disconnect', () => {
    for (let [id, sock] of turbosrcInstances.entries()) {
      if (sock === socket) {
        turbosrcInstances.delete(id);
        console.log(`Unregistered Turbosrc instance ${id}`);
        break;
      }
    }
  });
});

// Start the server
server.listen(port, () => console.log(`Listening on port ${port}`));

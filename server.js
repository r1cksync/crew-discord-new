const { createServer } = require('http');
const next = require('next');
const { initSocket } = require('./src/socket');
const connectDB = require('./src/lib/mongodb');
require('dotenv').config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Initialize Socket.io
  const io = initSocket(httpServer);

  // Connect to MongoDB
  connectDB();

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.io server running on port ${port}`);
    });
});

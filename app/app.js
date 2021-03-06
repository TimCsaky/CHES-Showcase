const compression = require('compression');
const config = require('config');
const express = require('express');
const fs = require('fs');
const log = require('npmlog');
const morgan = require('morgan');
const path = require('path');
const Problem = require('api-problem');
const querystring = require('querystring');
const Writable = require('stream').Writable;

const keycloak = require('./src/components/keycloak');
const v1Router = require('./src/routes/v1');

const apiRouter = express.Router();
const state = {
  ready: true, // No dependencies so application is always ready
  shutdown: false
};

const app = express();
app.use(compression());
app.use(express.json({ limit: config.get('server.bodyLimit') }));
app.use(express.urlencoded({ extended: true }));

// Logging Setup
log.level = config.get('server.logLevel');
log.addLevel('debug', 1500, { fg: 'cyan' });

let logFileStream;
let teeStream;
if (config.has('server.logFile')) {
  // Write to logFile in append mode
  logFileStream = fs.createWriteStream(config.get('server.logFile'), { flags: 'a' });
  teeStream = new Writable({
    objectMode: true,
    write: (data, _, done) => {
      process.stdout.write(data);
      logFileStream.write(data);
      done();
    }
  });
  log.disableColor();
  log.stream = teeStream;
}

// Skip if running tests
if (process.env.NODE_ENV !== 'test') {
  const morganOpts = {
    // Skip logging kube-probe requests
    skip: (req) => req.headers['user-agent'] && req.headers['user-agent'].includes('kube-probe')
  };
  if (config.has('server.logFile')) {
    morganOpts.stream = teeStream;
  }
  // Add Morgan endpoint logging
  app.use(morgan(config.get('server.morganFormat'), morganOpts));
}

// Use Keycloak OIDC Middleware
app.use(keycloak.middleware());

// Block requests until service is ready
app.use((_req, res, next) => {
  if (state.shutdown) {
    new Problem(503, { details: 'Server is shutting down' }).send(res);
  } else if (!state.ready) {
    new Problem(503, { details: 'Server is not ready' }).send(res);
  } else {
    next();
  }
});

// Frontend configuration endpoint
apiRouter.use('/config', (_req, res, next) => {
  try {
    const frontend = config.get('frontend');
    res.status(200).json(frontend);
  } catch (err) {
    next(err);
  }
});

// Base API Directory
apiRouter.get('/api', (_req, res) => {
  if (state.shutdown) {
    throw new Error('Server shutting down');
  } else {
    res.status(200).json('ok');
  }
});

// Host API endpoints
apiRouter.use(config.get('server.apiPath'), v1Router);
app.use(config.get('server.basePath'), apiRouter);

// Host the static frontend assets
const staticFilesPath = config.get('frontend.basePath');
app.use('/favicon.ico', (_req, res) => { res.redirect(`${staticFilesPath}/favicon.ico`); });
app.use(staticFilesPath, express.static(path.join(__dirname, 'frontend/dist')));

// Handle 500
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.stack) {
    log.error(err.stack);
  }

  if (err instanceof Problem) {
    err.send(res, null);
  } else {
    new Problem(500, 'Server Error', {
      detail: (err.message) ? err.message : err
    }).send(res);
  }
});

// Handle 404
app.use((req, res) => {
  if (req.originalUrl.startsWith(`${config.get('server.basePath')}/api`)) {
    // Return a 404 problem if attempting to access API
    new Problem(404, 'Page Not Found', {
      detail: req.originalUrl
    }).send(res);
  } else {
    // Redirect any non-API requests to static frontend with redirect breadcrumb
    const query = querystring.stringify({ ...req.query, r: req.path });
    res.redirect(`${staticFilesPath}/?${query}`);
  }
});

// Prevent unhandled errors from crashing application
process.on('unhandledRejection', err => {
  if (err && err.stack) {
    log.error(err.stack);
  }
});

// Graceful shutdown support
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGUSR1', shutdown);
process.on('SIGUSR2', shutdown);
process.on('exit', () => {
  log.info('Exiting...');
});

/**
 * @function shutdown
 * Shuts down this application after at least 3 seconds.
 */
function shutdown() {
  log.info('Received kill signal. Shutting down...');
  // Wait 3 seconds before starting cleanup
  if (!state.shutdown) setTimeout(cleanup, 3000);
}

/**
 * @function cleanup
 * Cleans up connections in this application.
 */
function cleanup() {
  log.info('Service no longer accepting traffic');
  state.shutdown = true;
  process.exit();
}

module.exports = app;

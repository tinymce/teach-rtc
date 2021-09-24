// load entries in `.env` file and `.env.local` file (and others) into `process.env` global
require('dotenv-flow').config();
// file access
const fs = require('fs')
const path = require('path');
// express
const express = require('express');
// standard express middleware
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
// authentication related middleware
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt;
// load database settings
const connection = require('./knexfile')[process.env.NODE_ENV || 'development'];
// create database connection
const database = require('knex')(connection);

// To perform JWT signing and authentication we need a public/private key pair.
// To avoid putting the keys in the source it is provided as an environment
// variable or as a path to the key so it can be loaded from the file.

// Load private key from file if not already provided and the path is specified.
if (!process.env.PRIVATE_KEY) {
  if (process.env.PRIVATE_KEY_PATH) {
    process.env.PRIVATE_KEY = fs.readFileSync(process.env.PRIVATE_KEY_PATH, 'utf8');
  } else {
    console.error('Please provide a private key for JWT creation. See README.md for details.');
    return;
  }
}
// Load public key from file if not already provided and the path is specified.
if (!process.env.PUBLIC_KEY) {
  if (process.env.PUBLIC_KEY_PATH) {
    process.env.PUBLIC_KEY = fs.readFileSync(process.env.PUBLIC_KEY_PATH, 'utf8');
  } else {
    console.error('Please provide a public key for JWT verification. See README.md for details.');
    return;
  }
}

// Passport is a library for handling authentication.
// In this case we are using JWT bearer tokens to authenticate access to some routes.
// Note that there is additional middleware in routes/api.js to handle returning
// JSON responses for API endpoints when authentication fails.
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.PUBLIC_KEY,
    algorithms: ['RS256']
  },
  (payload, done) => {
    // confirm a user exists
    database.select('username').from('users').where('username', payload.sub).then((rows) => {
      if (rows.length === 1) {
        // the user exists, provide the user details to authenticated routes
        done(null, rows[0].username);
      } else {
        // the user does not exist
        done(null, false);
      }
    }).catch((err) => {
      // an error occurred
      done(err, false);
    })
  }
));

const app = express();
// global middleware to provide access to the database
app.use((req, res, next) => {
  req.db = database;
  next();
});
// log requests to the console (using morgan)
app.use(logger('dev'));
// setup authentication middleware
app.use(passport.initialize());
// setup CORS middleware with a very lax allow-all rule for development.
app.use(cors()); // TODO: restrict to a single URL for production
// setup JSON body parser middleware
app.use(express.json());
// setup URL encoded parser middleware
app.use(express.urlencoded({ extended: false }));
// setup cookie parser middleware (not currently used)
app.use(cookieParser());

// host everything in the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Currently we are not doing anything with the index route though
// you could build the client and serve it here.
const indexRouter = require('./routes/index');
// This route contains the API.
const apiRouter = require('./routes/api');

// setup the routers
app.use('/', indexRouter);
app.use('/api', apiRouter);

module.exports = app;

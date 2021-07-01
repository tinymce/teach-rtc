require('dotenv-flow').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs')
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const connection = require('./knexfile')[process.env.NODE_ENV || 'development'];
const database = require('knex')(connection);
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt;

if (!process.env.PRIVATE_KEY) {
  if (process.env.PRIVATE_KEY_PATH) {
    process.env.PRIVATE_KEY = fs.readFileSync(process.env.PRIVATE_KEY_PATH, 'utf8');
  } else {
    console.error('Please provide a private key for JWT creation. See README.md for details.');
    return;
  }
}
if (!process.env.PUBLIC_KEY) {
  if (process.env.PUBLIC_KEY_PATH) {
    process.env.PUBLIC_KEY = fs.readFileSync(process.env.PUBLIC_KEY_PATH, 'utf8');
  } else {
    console.error('Please provide a public key for JWT verification. See README.md for details.');
    return;
  }
}

passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.PUBLIC_KEY,
    algorithms: ['RS256']
  },
  (payload, done) => {
    database.select('username').from('users').where('username', payload.sub).then((rows) => {
      if (rows.length === 1) {
        done(null, rows[0].username);
      } else {
        done(null, false);
      }
    }).catch((err) => {
      done(err, false);
    })
  }
));

const indexRouter = require('./routes/index');
const apiRouter = require('./routes/api');

const app = express();
app.use((req, res, next) => {
  req.db = database;
  next();
});
app.use(logger('dev'));
app.use(passport.initialize());
app.use(cors()); // TODO: restrict to a single URL for production
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api', apiRouter);

module.exports = app;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const passport = require('passport');
const uuidV4 = require('uuid').v4;
const { DateTime } = require("luxon");

const swaggerDocument = require('../docs/swagger.json');

// helpers
const PERMISSION_MANAGE = 4;
const PERMISSION_WRITE = 2;
const PERMISSION_READ = 1;

const ROLES = {
  'manage': PERMISSION_MANAGE | PERMISSION_WRITE | PERMISSION_READ,
  'edit': PERMISSION_WRITE | PERMISSION_READ,
  'view': PERMISSION_READ,
  'none': 0
};

ROLES_LOOKUP = Object.fromEntries(Object.entries(ROLES).map(entry => entry.reverse()));
ROLE_ORD = Object.keys(ROLES).sort((a, b) => ROLES[b] - ROLES[a]);

const permissionsToRole = (permissions) => ROLES_LOOKUP[permissions] ?? ROLE_ORD.find((r) => (permissions & ROLES[r]) === ROLES[r]) ?? 'none';

const getPermissions = async (req) => {
  const user = req.user;
  const document = req.params.documentUuid;
  if (!user) throw new Error('User must be authenticated');
  if (document === undefined) throw new Error('Path must contain parameter documentUuid');
  const rows = await (
    req.db
      .select('permissions')
      .from('collaborators')
      .where({ document, user })
  );
  return rows.length === 1 ? rows[0].permissions : 0;
};

// middle-ware
const isAuthenticated = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    req.user = user;
    next();
  })(req, res, next);
};

const hasPermission = (permission) => async (req, res, next) => {
  const permissions = await getPermissions(req);
  if (permissions === 0 || (permissions & permission) !== permission) {
    return res.status(403).json({ success: false, message: 'Document either does not exist or the user does not have the permission required.' });
  }
  next();
};

const hasManagePermission = hasPermission(PERMISSION_MANAGE);
const hasWritePermission = hasPermission(PERMISSION_WRITE);
const hasReadPermission = hasPermission(PERMISSION_READ);

const hasLock = async (req, res, next) => {
  const user = req.user;
  const uuid = req.params.documentUuid;
  if (!user) throw new Error('User must be authenticated');
  if (uuid === undefined) throw new Error('Path must contain parameter documentUuid');
  const oldest_valid_lock = DateTime.now().minus({ day: 1 });
  const rows = await req.db.select('lockUser', 'lockTime').from('documents').where('uuid', uuid);
  if (rows.length !== 1 || rows[0].lockUser !== user) {
    return res.status(423).json({ success: false, message: 'User must acquire a lock on the document.' });
  }
  if (DateTime.fromISO(rows[0].lockTime) < oldest_valid_lock) {
    return res.status(423).json({ success: false, message: 'User must re-acquire the lock on the document as it has expired.' });
  }
  next()
};

// API docs
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerDocument));

// generate a jwt token for a user
router.post('/jwt', async function (req, res, next) {
  const username = req.body.username;
  const password = req.body.password;
  if (typeof username !== 'string' && /^[a-zA-Z0-9~_.-]+$/.test(username)) {
    return res.status(400).json({ success: false, message: 'The username must be a string matching the pattern /^[a-zA-Z0-9~_.-]+$/ .' });
  }
  if (typeof password !== 'string' || passport.length === 0) {
    return res.status(400).json({ success: false, message: 'The password property must be a non-empty string.' });
  }
  rows = await req.db.select('hash').from('users').where('username', username);
  if (rows.length === 0) {
    res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    return;
  }
  const { hash } = rows[0];
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    return;
  }
  const token = jwt.sign({}, process.env.PRIVATE_KEY, { subject: username, expiresIn: '1d', algorithm: 'RS256' });
  res.json({ success: true, token });
});

// get all users
router.get('/users', async function (req, res, next) {
  const users = await req.db.select('username').from('users').pluck('username');
  res.json({ success: true, users });
})

// create a new user
router.post('/users', async function (req, res, next) {
  const username = req.body.username;
  const password = req.body.password;
  const fullName = req.body.fullName;
  if (typeof username !== 'string' && /^[a-zA-Z0-9~_.-]+$/.test(username)) {
    return res.status(400).json({ success: false, message: 'The username must be a string matching the pattern /^[a-zA-Z0-9~_.-]+$/ .' });
  }
  if (typeof password !== 'string' || passport.length === 0) {
    return res.status(400).json({ success: false, message: 'The password property must be a non-empty string.' });
  }
  if (typeof fullName !== 'string' || fullName.length === 0) {
    return res.status(400).json({ success: false, message: 'The fullName property must be a non-empty string.' });
  }
  // increase the difficulty of generating the hash to make reverse engineering passwords very computationally intensive
  const rounds = 12;
  // note that this generates a salt, uses it to hash the password and then returns the "<salt>.<hash>" combination
  const hash = await bcrypt.hash(password, rounds);
  try {
    await req.db.insert({ username, hash, fullName }).into('users');
    res.status(201).json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(409).json({ success: false, message: 'A user already exists with that username.' });
  }
});

// get user details
router.get('/users/:username', isAuthenticated, async function (req, res, next) {
  const rows = await (
    req.db.select('fullName')
      .from('users')
      .where('username', '=', req.params.username)
  );
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'No user was found with that username.' });
  }
  return res.json({ success: true, fullName: rows[0].fullName });
});

// get all documents
router.get('/documents', isAuthenticated, async function (req, res, next) {
  const documents = await (
    req.db.select('documents.uuid')
      .from('documents')
      .innerJoin('collaborators', 'documents.uuid', 'collaborators.document')
      .where('collaborators.user', req.user)
      .andWhere('collaborators.permissions', '>=', 1)
      .pluck('uuid')
  );
  res.json({ success: true, documents });
});

// create a new document
router.post('/documents', isAuthenticated, async function (req, res, next) {
  const title = req.body.title;
  if (!title) {
    res.status(400).json({ success: false, messsage: 'The title is required.' });
  }
  const username = req.user;
  const uuid = uuidV4();
  await req.db.insert({ uuid, title }).into('documents');
  await req.db.insert({ document: uuid, user: username, permissions: (PERMISSION_MANAGE | PERMISSION_WRITE | PERMISSION_READ) }).into('collaborators');
  res.json({ success: true, uuid });
});

// acquire or release a document lock
router.put('/documents/:documentUuid/lock', isAuthenticated, hasWritePermission, async function (req, res, next) {
  const user = req.user;
  const uuid = req.params.documentUuid;
  if (!user) throw new Error('User must be authenticated');
  if (uuid === undefined) throw new Error('Path must contain parameter documentUuid');
  const release = req.body.release ?? false;
  if (typeof release !== 'boolean') {
    res.status(400).json({ success: false, message: 'The release option must be true or false if provided.' });
    return;
  }
  if (release) {
    // release the lock if the user holds it
    await req.db('documents').
      where({ uuid: uuid, lockUser: user }).
      update({ 'lockUser': null, 'lockTime': null });
    res.json({ success: true, release });
  } else {
    const now = DateTime.now().toISO();
    const oldestValidLock = DateTime.now().minus({ seconds: 60 }).toISO();
    // attempt to acquire the lock
    await req.db('documents').where('uuid', uuid).
      andWhere(function () {
        // a lock can be acquired if no-one holds it, it is already held by the user, or if the lock has expired
        this.whereNull('lockUser').orWhere('lockUser', user).orWhere('lockTime', '<', oldestValidLock)
      }).
      update({ 'lockUser': user, 'lockTime': now });
    // check if the user succeeded in acquiring the lock
    const rows = await req.db.select('lockUser').from('documents').where('uuid', uuid);
    const success = rows.length === 1 && rows[0].lockUser === user;
    // note that failure to acquire the lock is not an error so we still return status 200
    res.json({ success, release });
  }
});

// get document title
router.get('/documents/:documentUuid/title', isAuthenticated, hasReadPermission, async function (req, res, next) {
  const [{ title }] = await req.db.select('title').from('documents').where('uuid', req.params.documentUuid);
  res.json({ success: true, title });
});

// get document content
router.get('/documents/:documentUuid/content', isAuthenticated, hasReadPermission, async function (req, res, next) {
  const [{ content }] = await req.db.select('content').from('documents').where('uuid', req.params.documentUuid);
  res.json({ success: true, content });
});

// store document content
router.put('/documents/:documentUuid/content', isAuthenticated, hasWritePermission, hasLock, async function (req, res, next) {
  const content = req.body.content;
  if (typeof content !== 'string') {
    res.status(400).json({ success: false, message: 'The content is required.' });
    return;
  }
  await req.db('documents').where('uuid', req.params.documentUuid).update({ content });
  res.status(200).json({ success: true });
});

// get list of users with access
router.get('/documents/:documentUuid/collaborators', isAuthenticated, hasReadPermission, async function (req, res, next) {
  const rows = await req.db.select('user', 'permissions').from('collaborators').where('document', req.params.documentUuid).orderBy([{ column: 'permissions', order: 'desc' }, { column: 'user', order: 'asc' }]);
  const collaborators = rows.map(({ user, permissions }) => ({
    username: user,
    role: permissionsToRole(permissions)
  }));
  res.json({ success: true, collaborators });
});

// update the access of a user
router.put('/documents/:documentUuid/collaborators/:username', isAuthenticated, hasManagePermission, async function (req, res, next) {
  const document = req.params.documentUuid;
  // validate inputs
  const user = req.params.username;
  if (typeof user !== 'string' && /^[a-zA-Z0-9~_.-]+$/.test(user)) {
    return res.status(400).json({ success: false, message: 'The username must be a string matching the pattern /^[a-zA-Z0-9~_.-]+$/ .' });
  }
  const role = req.body.role;
  if (!Object.keys(ROLES).includes(role)) {
    return res.status(400).json({ success: false, message: 'The role must be one of: "' + ROLE_ORD.join('", "') + '".' });
  }
  const userExists = await req.db.select('*').from('users').where('username', user);
  if (userExists.length !== 1) {
    return res.status(400).json({ success: false, message: 'The username does not refer to a user that exists.' });
  }
  const permissions = ROLES[role];
  // check if a record exists
  const existing = await req.db.select('*').from('collaborators').where({ 'document': req.params.documentUuid, 'user': user });
  if (existing.length > 0) {
    if (permissions !== 0) {
      // update existing record
      await req.db('collaborators').where({ document, user }).update({ permissions });
    } else {
      // delete existing record
      await req.db('collaborators').where({ document, user }).del();
    }
  } else if (permissions !== 0) {
    // insert new record
    await req.db.insert({ document, user, permissions }).into('collaborators');
  }
  return res.json({ success: true });
});

module.exports = router;

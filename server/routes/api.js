const router = require("express-promise-router")();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const passport = require('passport');
const uuidV4 = require('uuid').v4;
const { DateTime } = require("luxon");

// Open API v3 docs
// When the server is running these can be viewed at http://localhost:3001/api/
const swaggerDocument = require('../docs/swagger.json');

// helpers

// The access that a user has to a document is stored as a bitset where each
// access level has a combination of different capabilities.
const PERMISSION_MANAGE = 8; // 1000
const PERMISSION_WRITE = 4;  // 0100
const PERMISSION_READ = 1;   // 0001

/**
 * Each access level is then equivalent to a number as given by bitwise OR of the capabilities.
 */
const ACCESS = {
  'manage': PERMISSION_MANAGE | PERMISSION_WRITE | PERMISSION_READ, // 1101 = 13
  'edit': PERMISSION_WRITE | PERMISSION_READ,                       // 0101 = 5
  'view': PERMISSION_READ,                                          // 0001 = 1
  'none': 0                                                         // 0000 = 0
};

/**
 * A mapping from the bitset number representing the capabilities to the access level.
 * @type {Record.<number, string>}
 */
const ACCESS_LOOKUP = Object.fromEntries(Object.entries(ACCESS).map(entry => entry.reverse()));

/**
 * A list of the access levels sorted by most powerful ('manage') to least powerful ('none').
 * @type {(keyof typeof ACCESS)[]} 
 */ 
const ACCESS_ORD = Object.keys(ACCESS).sort((a, b) => ACCESS[b] - ACCESS[a]);

/**
 * Given any number try to find an exact match to a access level, when that is not possible find the most powerful access level that is fulfilled by the permissions.
 * @param {number} permissions 
 * @returns {keyof typeof ACCESS}
 */
const permissionsToAccess = (permissions) => ACCESS_LOOKUP[permissions] ?? ACCESS_ORD.find((r) => (permissions & ACCESS[r]) === ACCESS[r]) ?? 'none';

/**
 * Given a request get the permissions that the logged-in user has for the current document.
 * 
 * Assumes that the user has been authenticated with the username in the
 * req.user value and that the document UUID is in the path of the request
 * named documentUuid.
 * 
 * @param {Express.Request} req the express request object.
 * @returns {Promise.<number>} promise that resolves to the permissions.
 */
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

// Express Middleware

/**
 * Middleware to authenticate the user and return a JSON response on failure.
 * @param {Express.Request} req the express request object.
 * @param {Express.Response} res the express response object.
 * @param {(err: any?) => void} next pass on to express' next handler.
 */
const isAuthenticated = (req, res, next) => {
  // the `session: false` instructs passport not to create a session cookie
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

/**
 * Construct middleware to check if a user has the expected permission.
 * @see getPermissions for assumptions.
 * @param {number} permission the permission to check for.
 * @returns {(req: Express.Request, res: Express.Response, next: (err: any?) => void) => Promise.<void>} Middleware to check if the user has the passed permission.
 */
const hasPermission = (permission) => async (req, res, next) => {
  const permissions = await getPermissions(req);
  if (permissions === 0 || (permissions & permission) !== permission) {
    return res.status(403).json({ success: false, message: 'Document either does not exist or the user does not have the permission required.' });
  }
  next();
};

/**
 * Middleware to check if the user has the manage permission on the document.
 * @see getPermissions for assumptions.
 */
const hasManagePermission = hasPermission(PERMISSION_MANAGE);

/**
 * Middleware to check if the user has the write permission on the document.
 * @see getPermissions for assumptions.
 */
const hasWritePermission = hasPermission(PERMISSION_WRITE);

/**
 * Middleware to check if the user has the read permission on the document.
 * @see getPermissions for assumptions.
 */
const hasReadPermission = hasPermission(PERMISSION_READ);

/**
 * Middleware to check if the user has the lock on the document.
 * 
 * Assumes that the user has been authenticated with the username in the
 * req.user value and that the document UUID is in the path of the request
 * named documentUuid.
 * 
 * @param {Express.Request} req the express request object.
 * @param {Express.Response} res the express response object.
 * @param {(err: any?) => void} next pass on to express' next handler.
 * @returns {Promise.<void>} promise that resolves when complete.
 */
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

// generate a JSON web token for a user to represent their login session
router.post('/jwt', async function (req, res, next) {
  // get the username and password from the body of the request
  const username = req.body.username;
  const password = req.body.password;
  // validate inputs
  if (typeof username !== 'string' && /^[a-zA-Z0-9~_.-]+$/.test(username)) {
    return res.status(400).json({ success: false, message: 'The username must be a string matching the pattern /^[a-zA-Z0-9~_.-]+$/ .' });
  }
  if (typeof password !== 'string' || passport.length === 0) {
    return res.status(400).json({ success: false, message: 'The password property must be a non-empty string.' });
  }
  // lookup user record in database
  rows = await req.db.select('hash').from('users').where('username', username);
  if (rows.length === 0) {
    res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    return;
  }
  // check that the password was correct
  const { hash } = rows[0];
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Incorrect username or password.' });
    return;
  }
  // create a new JSON web token linked to the user that expires in 1 day
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
  // get the username, password and the full name from the body of the request
  const username = req.body.username;
  const password = req.body.password;
  const fullName = req.body.fullName;
  // validate the inputs
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
  // note that this generates a salt, uses it to hash the password and then returns an encoded salt + hash combination
  const hash = await bcrypt.hash(password, rounds);
  try {
    // the users table has a uniqueness constraint on the username so if this
    // is a duplicate it will throw an error
    await req.db.insert({ username, hash, fullName }).into('users');
    res.status(201).json({ success: true });
  } catch (e) {
    // for the sake of simplicity we're assuming that all failures are due to 
    // the user already existing though there are other failure options 
    // like for example a missing database
    console.log(e);
    res.status(409).json({ success: false, message: 'A user already exists with that username.' });
  }
});

// get user details
router.get('/users/:username', isAuthenticated, async function (req, res, next) {
  // lookup the user in the database and get their details (currently just their full name)
  const rows = await (
    req.db.select('fullName')
      .from('users')
      .where('username', '=', req.params.username)
  );
  // check the user exists
  if (rows.length === 0) {
    return res.status(404).json({ success: false, message: 'No user was found with that username.' });
  }
  // return the user details
  return res.json({ success: true, fullName: rows[0].fullName });
});

// get all documents
router.get('/documents', isAuthenticated, async function (req, res, next) {
  // select all document UUIDs where the authenticated user has some permissions
  const documents = await (
    req.db.select('documents.uuid')
      .from('documents')
      .innerJoin('collaborators', 'documents.uuid', 'collaborators.document')
      .where('collaborators.user', req.user)
      .andWhere('collaborators.permissions', '>=', 1)
      .pluck('uuid')
  );
  // return the documents UUIDs
  res.json({ success: true, documents });
});

// create a new document
router.post('/documents', isAuthenticated, async function (req, res, next) {
  // get the new document title from the request body
  const title = req.body.title;
  // validate that the title is not empty.
  if (!title) {
    res.status(400).json({ success: false, message: 'The title is required.' });
  }
  const username = req.user;
  // generate a new randomly generated universally unique identifier
  // https://en.wikipedia.org/wiki/Universally_unique_identifier#Version_4_(random)
  const uuid = uuidV4();
  // create the new document
  await req.db.insert({ uuid, title }).into('documents');
  // give the current user full access to the document
  await req.db.insert({ document: uuid, user: username, permissions: (PERMISSION_MANAGE | PERMISSION_WRITE | PERMISSION_READ) }).into('collaborators');
  // return the new document's UUID
  res.json({ success: true, uuid });
});

// acquire or release a document lock
router.put('/documents/:documentUuid/lock', isAuthenticated, hasWritePermission, async function (req, res, next) {
  // get the authenticated user and the document UUID and assert they exist (which they must due to the previous middleware)
  const user = req.user;
  const uuid = req.params.documentUuid;
  if (!user) throw new Error('User must be authenticated');
  if (uuid === undefined) throw new Error('Path must contain parameter documentUuid');
  // get the release flag from the request body or a default
  const release = req.body.release ?? false;
  // validate the release flag
  if (typeof release !== 'boolean') {
    res.status(400).json({ success: false, message: 'The release option must be true or false if provided.' });
    return;
  }
  // now check if the document lock must be acquired or released
  if (release) {
    // release the lock if the user holds it
    await req.db('documents').
      where({ uuid: uuid, lockUser: user }).
      update({ 'lockUser': null, 'lockTime': null });
    // we are always successful in giving up the lock, 
    // however that does not mean that we owned it.
    res.json({ success: true, release });
  } else {
    // the user wishes to acquire the lock
    // in case there is an existing lock calculate how new it must be to be valid
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
  // get the document title from the database
  const [{ title }] = await req.db.select('title').from('documents').where('uuid', req.params.documentUuid);
  // return the document title
  res.json({ success: true, title });
});

// get document content
router.get('/documents/:documentUuid/content', isAuthenticated, hasReadPermission, async function (req, res, next) {
  // get the document content from the database
  const [{ content }] = await req.db.select('content').from('documents').where('uuid', req.params.documentUuid);
  // return the document content
  res.json({ success: true, content });
});

// store document content
  // get the document content from the body of the request
router.put('/documents/:documentUuid/content', isAuthenticated, hasWritePermission, async function (req, res, next) {
  const content = req.body.content;
  // validate the content
  if (typeof content !== 'string') {
    res.status(400).json({ success: false, message: 'The content is required.' });
    return;
  }
  // update the document content
  await req.db('documents').where('uuid', req.params.documentUuid).update({ content });
  // return success
  res.status(200).json({ success: true });
});

// get list of users with access
router.get('/documents/:documentUuid/collaborators', isAuthenticated, hasReadPermission, async function (req, res, next) {
  // get all usernames and permissions on the document sorted by most permissions to least
  const rows = await req.db.select('user', 'permissions').from('collaborators').
    where('document', req.params.documentUuid).
    orderBy([{ column: 'permissions', order: 'desc' }, { column: 'user', order: 'asc' }]);
  // convert the user permissions into access levels
  const collaborators = rows.map(({ user, permissions }) => ({
    username: user,
    access: permissionsToAccess(permissions)
  }));
  // return the collaborators
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
  const access = req.body.access;
  if (!Object.keys(ACCESS).includes(access)) {
    return res.status(400).json({ success: false, message: 'The access must be one of: "' + ACCESS_ORD.join('", "') + '".' });
  }
  // check that the specified user actually exists
  const userExists = await req.db.select('*').from('users').where('username', user);
  if (userExists.length !== 1) {
    return res.status(400).json({ success: false, message: 'The username does not refer to a user that exists.' });
  }
  // get the numerical value of the access
  const permissions = ACCESS[access];
  // check if a collaborator record exists
  const existing = await req.db.select('*').from('collaborators').where({ 'document': req.params.documentUuid, 'user': user });
  // update, delete or create the collaborator record
  if (existing.length > 0) {
    if (permissions !== 0) {
      // update the existing collaborator record
      await req.db('collaborators').where({ document, user }).update({ permissions });
    } else {
      // delete the existing collaborator record
      await req.db('collaborators').where({ document, user }).del();
    }
  } else if (permissions !== 0) {
    // insert new collaborator record
    await req.db.insert({ document, user, permissions }).into('collaborators');
  }
  // return success
  return res.json({ success: true });
});

module.exports = router;

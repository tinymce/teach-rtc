# Teach RTC
This project aims to teach how to use the TinyMCE Real-Time Collaboration plugin.

Real-Time Collaboration (RTC) allows multiple users edit a document simultaneously,
while automatically combining their changes. This makes it easier for integrators
who don't have to ensure the document is locked to avoid multiple users overwriting
each other.

This repository shows the before and after stages of applying RTC to a simple
collaborative document editing system.

- [About the repository](#abouttherepository)
   - [Server](#aboutserver)
      - [Express Application](#expressapp)
      - [Database](#database)
      - [Interactive API Documentation](#interactiveapi)
   - [Client](#aboutclient)
      - [Managing login using JSON web tokens](#aboutlogin)
      - [Components, pages and modals](#aboutcomponentspagesmodals)
- [Setup Steps](#setupsteps)
   - [Server](#setupserver)
   - [Cloud](#setupcloud)
   - [Client](#setupclient)


<a id="abouttherepository"></a>

# About the repository

This project is split into client and server. 

<a id="aboutserver"></a>

## Server
The server was created with the
tool [`express-generator`](https://expressjs.com/en/starter/generator.html) using
the setting `--no-view` as we weren't using the view engine.

Then the following packages were added:
- `bcrypt` - to salt and hash passwords.
- `cors` - to enable accessing the API from another server.
- `dotenv-flow` - to allow loading settings from `.env` and `.env.local` files.
- `jsonwebtoken` - to allow signing and validating JSON web tokens.
- `knex` - to connect to our database and build queries safely.
- `luxon` - to parse and generate ISO date-time values.
- `passport` - to handle authentication for requests.
- `passport-jwt` - a `passport` plugin that supports JWT authentication.
- `sqlite3` - to connect to a SQLite database, used by `knex`.
- `swagger-ui-express` - to provide interactive documentation for the API.
- `uuid` - generate universally unique identifiers for the documents.

The server application is started by the node script in 
[`server/bin/www`](server/bin/www) which has not been modified in this project.
It then loads the main script [`server/app.js`](server/app.js) which sets up
how express handles requests.

<a id="expressapp"></a>

### Express `app.js`
The [`app.js`](server/app.js) does the following:
1. Loads settings from `.env` and `.env.local`, these can also be specified as environment variables.
2. Loads database settings from the `knexfile.js`.
3. Connects to the database using `knex`.
4. Loads the private and public keys for signing JWT tokens using the settings loaded in step 1.
5. Sets up the authentication middleware using `passport` to read JWT bearer tokens and authenticate against the database.
6. Loads the routes.
7. Creates the express app.
8. Registers middleware to:
   - Provide the database
   - Log request details
   - Respond with CORS headers
   - Parse JSON encoded requests
   - Parse URL encoded requests
   - Parse cookies
   - Serve static files
9. Registers the routes.
10. Exports the app.

<a id="database"></a>

### Database
The database is accessed through the [`knex`](https://knexjs.org/) query builder
which is configured by the file [`server/knexfile.js`](server/knexfile.js).

There are 3 configurations listed but for the purposes of this demo we will only
be using the `development` configuration which connects to an SQLite database
at the file `server/dev.sqlite3`. When you first checkout the project this
database file will not exist but it can be created by running the database
migration scripts. 

The migration scripts are in the folder `server/migrations`
and are run in alphabetical order, hence the scripts all start with the timestamp
of their creation. For this project we are only using one script for each
phase of the project.

For the [initial phase without RTC](server/migrations/20210525072953_setup.js) the database design looks like this:

#### `users` table

| Column   | Type   |  Description                                                 |
|----------|--------|--------------------------------------------------------------|
| username | string | The username for logging in to the application.              |
| hash     | string | The salt and hash of the users password created by `bcrypt`. |
| fullName | string | The display name of the user.                                |

#### `documents` table

| Column   | Type   |  Description                                                          |
|----------|--------|-----------------------------------------------------------------------|
| uuid     | uuid   | The universally unique identifier for the document.                   |
| title    | string | The human readable title of the document.                             |
| content  | string | The content of the document.                                          |
| lockUser | string | The user which currently has exclusive write access to the document.  |
| lockTime | string | The last time that the locking user requested exclusive write access. |

#### `collaborators` table

| Column      | Type    |  Description                                  |
|-------------|---------|-----------------------------------------------|
| document    | uuid    | The document's universally unique identifier. |
| user        | string  | The user's username.                          |
| permissions | integer | The permissions stored as a bitset.           |

### Routes in `api.js`
The most important part of the server is the [API routes](server/routes/api.js) that are defined to handle
all the different parts of the application.

| Route            | Method |  Description                                             |
|:-----------------|--------|----------------------------------------------------------|
| /                | GET    | The interactive documentation for the API.               |
| /jwt             | POST   | Login and create a JSON web token to represent the user. |
| /users           | GET    | Get a list of all usernames on the server.               |
| /users           | POST   | Create a new user.                                       |
| /users/:username | GET    | Get the user details, in this case a full name.          |
| /documents       | GET    | Get a list of all documents the user can access.         |
| /documents       | POST   | Create a new document.                                   |

<a id="interactiveapi"></a>

### Interactive API documentation
After following the server setup steps below and starting the server open the URL `http://localhost:3001/api/` to view interactive documentation. 

Note that this documentation is defined in the file [`server/docs/swagger.json`](server/docs/swagger.json).

<a id="aboutclient"></a>

## Client

The client was created with the tool `create-react-app`. The `.git` folder and
 `.gitignore` created by the script was removed in favor of the one in the parent directory.

The following packages were added:
- `@tinymce/tinymce-react` - to load TinyMCE as a react component.
- `axios` - to handle requesting
- `bootstrap` - to supply styling.
- `jquery` - to allow interactive parts from `bootstrap`
- `jsonwebtoken` - to decode JSON web tokens to extract the user and expiry time.
- `popper.js` - to handle popups in `bootstrap`
- `react-bootstrap` - to supply components for creating the website.
- `react-router-bootstrap` - to supply some replacement components from `react-router-dom` that work with `bootstrap`.
- `react-router-dom` - to handle navigation without page loads.

<a id="aboutlogin"></a>

### Managing login using JSON web tokens

The application uses JSON web tokens to store who is the logged in user. 
When these are retrieved after login they are stored in 
[local storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
and retrieved whenever the page is reloaded. These are automatically removed
when the expiry time on the token is reached.

Additionally the application makes use of the default headers setting on axios
to send the JSON web token with every request without having to manually pass
the token.

<a id="aboutcomponentspagesmodals"></a>

### Components, pages and modals
The application is made up of 4 pages, 3 modals and a common component to provide navigation
between each of the pages.

#### Components
- [`Navigation.js`](client/src/components/Navigation.js) - A navigation bar shared between pages.

#### Pages
- [`DocumentEdit.js`](client/src/pages/DocumentEdit.js) - A page using TinyMCE which is used for viewing and editing the document.
- [`DocumentList.js`](client/src/pages/DocumentList.js) - A page which shows a list of all documents available to the currently logged-in user.
- [`LoginRegister.js`](client/src/pages/LoginRegister.js) - A page which allows new users to register or to log-in to use the rest of the site.
- [`Logout.js`](client/src/pages/Logout.js) - A page which simply logs out the user and redirects to the login page.

#### Modals
- [`EditCollaboratorModal.js`](client/src/modals/EditCollaboratorModal.js) - a modal used to change the access role of a collaborator.
- [`NewCollaboratorModal.js`](client/src/modals/NewCollaboratorModal.js) - a modal used to add a new collaborator.
- [`NewDocModal.js`](client/src/modals/NewDocModal.js) - a modal used to create a new document.

<a id="setupsteps"></a>

# Setup steps

<a id="setupserver"></a>

## Server
The following commands are run from the subfolder `server`.

### Create a database or migrate an existing database to latest schema
```sh
yarn knex migrate:latest
```

#### Migrate to older schema
If you have migrated your database to the RTC version and want to return to the pre-RTC
schema you can use.
```sh
yarn knex migrate:down
```

### Create key pair in PEM format
```sh
ssh-keygen -m PEM -t rsa -b 2048 -f rsa-key
mv rsa-key rsa-key.private.pem
ssh-keygen -f rsa-key.pub -e -m pem > rsa-key.public.pem
```
Note that the passphrase should be left blank.

### Create `.env.local` file
The `.env` file has the default values so only put in values that need to be changed.

#### `PORT`
The port the server runs on. By default this is port `3001`. If you change
this you will need to change the `REACT_APP_API` on the client.

#### `PRIVATE_KEY_PATH`
The path to the private key. By default this is `./rsa-key.private.pem`.

#### `PUBLIC_KEY_PATH`
The path to the public key. By default this is `./rsa-key.public.pem`.

### Start the server
```sh
yarn start
```

Note if you have `nodemon` installed you might prefer:
```sh
nodemon start
```
as it will automatically restart if you make changes.

<a id="setupcloud"></a>

## TinyMCE cloud account

### Create cloud account

Create the cloud account at https://www.tiny.cloud/auth/signup/ 
and note the API key for a later step.

### Register public key

Register the public key that was generated previously at
https://www.tiny.cloud/my-account/jwt/ .

<a id="setupclient"></a>

## Client
The following commands are run from the subfolder `client`.

### Create `.env.local` file
The `.env` file has the default values so only put in values that need to be changed.
Note that you must provide an API key to `REACT_APP_TINYMCE_API_KEY`.

#### `PORT`
The port that the client runs on. By default this is port `3000`.

#### `REACT_APP_API`
The URL of the server API. By default this is `http://localhost:3001/api`.
If you have changed the port of the server you will need to update this value.

#### `REACT_APP_TINYMCE_API_KEY`
Set this value with the API key of the cloud account you registered in a
previous step.


### Start the client
```sh
yarn start
```
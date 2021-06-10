# Setup steps

## Server
The following commands are run from the subfolder `server`.

### Create a database
```sh
yarn knex migrate:latest
```

### Create key pair in PEM format
Setup the key pair then reference them in `.env`

### Create `.env` file
```text
PORT=3001
PRIVATE_KEY_PATH=./rsa-key.private.pem
PUBLIC_KEY_PATH=./rsa-key.public.pem
```

### Start the server
```sh
yarn start
```

## Client
The following commands are run from the subfolder `client`.

## Create `.env` file
```text
REACT_APP_API=http://localhost:3001/api
REACT_APP_TINYMCE_API_KEY=your-api-key
```

### Start the client
```sh
yarn start
```
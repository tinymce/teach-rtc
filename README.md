# Setup steps

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

## TinyMCE cloud account

### Create cloud account

Create the cloud account at https://www.tiny.cloud/auth/signup/ 
and note the API key for a later step.

### Register public key

Register the public key that was generated previously at
https://www.tiny.cloud/my-account/jwt/ .

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
import { Editor } from '@tinymce/tinymce-react';
import { decode } from 'jsonwebtoken';
import { useParams } from 'react-router-dom';
import { getContent, getJwt, getSecretKey, getUserDetails, saveContent, useCollaborators, useDocumentTitle } from '../api/api';
import { detect } from 'detect-browser';
import { useState } from 'react';
/** @type {{type: string, name: string, version: string | null, os: string | null} | null} */
const browser = detect();

// This is heavily based on the basic example
// https://www.tiny.cloud/docs/demo/basic-example/
// minus some plugins not supported by RTC.
const config = {
  height: 800,
  // currently RTC only supports a limited set of plugins
  // https://www.tiny.cloud/docs/rtc/introduction/#rtcenabledfeatures
  plugins: [
    'advlist lists link image charmap print visualblocks',
    'insertdatetime help wordcount'
  ],
  menubar: false,
  toolbar: 'undo redo | formatselect | ' +
    'bold italic backcolor | alignleft aligncenter ' +
    'alignright alignjustify | bullist numlist outdent indent | ' +
    'removeformat | help',
};

export default function DocumentEdit({ token }) {
  const { documentId } = useParams();
  const { sub: username } = token ? decode(token) : {};
  const title = useDocumentTitle({ documentId });
  const { access } = useCollaborators({ documentId, username });
  const accessCanEdit = access === 'manage' || access === 'edit';
  const canEdit = accessCanEdit;

  /**
   * The details of another user that is currently editing the document.
   * @typedef {object} Client
   * @property {string} userId the client user ID which is the `sub` field in the JWT.
   * @property {{fullName: string}} userDetails the client details which always includes the `fullName`.
   * @property {string} clientId a unique string identifying the client.
   * @property {number} caretNumber the caret number in range 1-8 (inclusive).
   * @property {{browser?: string}} clientInfo additional information about the client.
   */

  /** @type {[Client[], React.Dispatch<React.SetStateAction<Client[]>>]} */
  const [clients, setClients] = useState([]);

  /**
   * Store a connecting client.
   * @param {Client} newClient the connecting client.
   */
  const clientConnected = (newClient) => setClients((existingClients) => [...existingClients, newClient]);

  /**
   * Delete a disconnecting client.
   * @param {Client} removedClient the disconnecting client.
   */
  const clientDisconnected = (removedClient) => setClients((existingClients) => existingClients.filter((client) => client.clientId !== removedClient.clientId));

  return (
    <>
      <h1>{title}</h1>
      <Editor
        key={documentId}
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        disabled={!canEdit}
        init={{
          ...config,

          /*
           * The RTC plugin is prepended here to indicate that it always loads first.
           * The order that RTC appears in the plugin list doesn't actually matter
           * because the editor will check for it and load it first.
           */
          plugins: 'rtc ' + config.plugins.join(' '),

          /**
           * RTC uses a unique ID to identify documents, which must be provided
           * by your application.
           * This setting is required.
           * @type {string} unique document ID.
           */
          rtc_document_id: documentId,

          /**
           * 
           * RTC uses a JWT to identify clients which must be provided on request
           * by your application.
           * RTC requires that the returned JWT is valid and signed by a keypair
           * that has been registered with the cloud account for the API key in
           * use.
           * It is preferred that the returned JWT has a short expiry, is specific 
           * to a single document and specifies the user's role using additional claims.
           * This setting is required.
           * @type {(inputs: {documentId: string}) => Promise.<{token: string}>} token provider callback.
           */
          rtc_token_provider: getJwt,//({documentId}) => Promise.resolve({token}),

          /**
           * To ensure privacy of your content the RTC plugin encrypts all
           * messages that need to be sent to the RTC server.
           * The key to encrypt the messages is provided by your application on
           * request by the RTC plugin.
           * The server never has access to the encryption key so it can't view
           * the contents of the document.
           * This setting is required.
           * @type {(inputs: {documentId: string, keyHint: string | null}) => Promise.<{key: string, keyHint: string}>} key provider callback.
           */
          rtc_encryption_provider: getSecretKey,//({documentId, keyHint}) => Promise.resolve({key: 'This is not secure. Fix me!', keyHint: '1970-01-01T00:00:00.000Z'}),

          /**
           * The first time that RTC loads on a document when it hasn't seen
           * the document ID before it will get the starting content from your
           * application.
           * All later times the encrypted snapshots and messages will be 
           * retrieved from the RTC server and replayed on the client to
           * recreate the document content.
           * This setting is optional. If not provided then the content
           * will come from the textarea the editor is initialized on.
           * @type {(inputs: {documentId: string}) => Promise.<{content: string}>} content provider callback.
           */
          rtc_initial_content_provider: getContent,

          /**
           * The RTC plugin periodically calls this function to allow
           * integrators to save the document. The version number
           * provided allows the integrator to tell old and new snapshots apart.
           * This setting is optional though strongly recommended. Leaving out
           * this setting is only really possible on prototypes as it is the only
           * reliable way the editor content can be saved.
           * @type {(inputs: {documentId: string, version: number, getContent: () => string}) => void} content saving callback.
           */
          rtc_snapshot: ({documentId, version, getContent}) => saveContent({documentId, version, content: getContent()}),

          /**
           * The RTC plugin calls this function when it encounters a new user.
           * This provides the full name of the user by default but any information
           * that can be encoded as JSON can be passed.
           * This setting is optional. If not provided then users will be
           * identified by their ID.
           * @type {(inputs: {userId: string}) => Promise.<{fullName: string}>} user details callback.
           */
          rtc_user_details_provider: getUserDetails,

          /**
           * The RTC plugin calls this method when a client connects.
           * This includes the details from the rtc_user_details_provider and
           * the extra data provided to rtc_client_info.
           * This setting is optional.
           * @type {(client: Client) => void} client connected callback.
           */
          rtc_client_connected: clientConnected,//(data) => console.log('connected', data),

          /**
           * The RTC plugin calls this method when a client disconnects.
           * This includes the details from the rtc_user_details_provider and
           * the extra data provided to rtc_client_info.
           * This setting is optional.
           * @type {(client: Client) => void} client disconnected callback.
           */
          rtc_client_disconnected: clientDisconnected,//(data) => console.log('disconnected', data),

          /**
           * The RTC plugin transmits this data to all other clients.
           * The only restriction is that this must be encodable as JSON.
           * This setting is optional.
           */
          rtc_client_info: { browser: browser?.name },
        }}
      />
    </>
  );
}
import { useParams } from 'react-router';
import { Editor } from '@tinymce/tinymce-react';
import { decode } from 'jsonwebtoken';
import { getContent, getJwt, getSecretKey, getUserDetails, saveContent, useCollaborators, useDocumentTitle } from '../api/api';
import { useState } from 'react';
import ConnectedClient from '../components/ConnectedClient';
import { detect } from 'detect-browser';
const browser = detect();

/**
 * Save the editor content.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @param {number} inputs.version the document version.
 * @param {() => string} inputs.getContent a function to request the serialized content. 
 */
const saveSnapshot = ({ documentId, version, getContent }) => {
  saveContent({ documentId, version, content: getContent() });
};

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
  const [clients, setClients] = useState([]);
  const clientConnected = (client) => setClients((clients) => [...clients, client]);
  const clientDisconnected = (client) => setClients((clients) => clients.filter(({ clientId }) => clientId !== client.clientId));
  return (
    <>
      <h1>{title}</h1>
      <div>
        Other connected clients: {clients.map((c) => <ConnectedClient key={c.clientId} caretNumber={c.caretNumber} fullName={c.userDetails.fullName} browser={c.clientInfo.browser}/>)}
      </div>
      <Editor
        key={documentId}
        cloudChannel="5-rtc"
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        disabled={!accessCanEdit}
        init={{
          ...config,
          plugins: 'rtc ' + config.plugins,
          // RTC uses a unique ID to identify documents which is provided
          // by your application.
          // This setting is required.
          rtc_document_id: documentId,
          // To ensure privacy of your content the RTC plugin encrypts all
          // messages that need to be sent to the RTC server.
          // The key to encrypt the messages is provided by your application on
          // request by the RTC plugin.
          // The server never has access to the encryption key so it can't view
          // the contents of the document.
          // This setting is required.
          rtc_encryption_provider: getSecretKey,
          // The future plan for RTC is that users will be authorized to view
          // or edit documents with JSON web tokens that contain claims
          // identifying the document and the role that the user has.
          // This example is written as if this is currently possible...
          // Currently the only requirement is that the JWT is signed by a 
          // key pair that is registered with the TinyMCE cloud account to 
          // prove it has access.
          // This setting is required.
          rtc_token_provider: () => getJwt({ documentId }),
          // The first time that RTC loads on a document when it hasn't seen
          // the document ID before it will get the starting content from your
          // application.
          // All later times the encrypted snapshots and messages will be 
          // retrieved from the RTC server and replayed on the client to
          // recreate the document content.
          // This setting is optional. If not provided then the content
          // will come from the textarea the editor is initialized on.
          rtc_initial_content_provider: getContent,
          // The RTC plugin periodically calls this function to allow
          // integrators to save the document. The version number
          // provided allows the integrator to tell old and new snapshots apart.
          // This setting is optional though strongly recommended. Leaving out
          // this setting is only really possible on prototypes as it is the only
          // way the editor content can be saved.
          rtc_snapshot: saveSnapshot,
          // The RTC plugin calls this function when it encounters a new user.
          // This provides the full name of the user by default but any information
          // that can be encoded as JSON can be passed.
          // This setting is optional. If not provided then users will be
          // identified by their ID.
          rtc_user_details_provider: getUserDetails,
          // The RTC plugin calls this method when a client connects.
          // This includes the details from the rtc_user_details_provider and
          // the extra data provided to rtc_client_info.
          // This setting is optional.
          rtc_client_connected: clientConnected,
          // The RTC plugin calls this method when a client disconnects.
          // This includes the details from the rtc_user_details_provider and
          // the extra data provided to rtc_client_info.
          // This setting is optional.
          rtc_client_disconnected: clientDisconnected,
          // The RTC plugin transmits this data to all other clients.
          // The only restriction is that this must be encodable as JSON.
          // This setting is optional.
          rtc_client_info: { browser: browser?.name },
        }}
      />
    </>
  );
}
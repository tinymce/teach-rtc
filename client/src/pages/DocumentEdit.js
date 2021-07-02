import { useParams } from 'react-router';
import { Editor } from '@tinymce/tinymce-react';
import { decode } from 'jsonwebtoken';
import { getContent, getJwt, getSecretKey, getUserDetails, saveContent, useCollaborators, useDocumentTitle } from '../api/api';
import { useState } from 'react';
import ConnectedClient from '../components/ConnectedClient';

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
        Other connected clients: {clients.map((c) => <ConnectedClient key={c.clientId} caretNumber={c.caretNumber} fullName={c.userDetails.fullName}/>)}
      </div>
      <Editor
        key={documentId}
        cloudChannel="5-rtc"
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        disabled={!accessCanEdit}
        init={{
          ...config,
          plugins: 'rtc ' + config.plugins,
          rtc_document_id: documentId,
          rtc_encryption_provider: getSecretKey,
          rtc_token_provider: () => getJwt({ documentId }),
          rtc_initial_content_provider: getContent,
          rtc_snapshot: saveSnapshot,
          rtc_user_details_provider: getUserDetails,
          rtc_client_connected: clientConnected,
          rtc_client_disconnected: clientDisconnected,
          // rtc_client_info: {},
        }}
      />
    </>
  );
}
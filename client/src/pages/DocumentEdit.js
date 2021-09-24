import { Editor } from '@tinymce/tinymce-react';
import { decode } from 'jsonwebtoken';
import { useParams } from 'react-router-dom';
import { getContent, useCollaborators, useDocumentAutosave, useDocumentLock, useDocumentTitle } from '../api/api';

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
  const ownsLock = useDocumentLock({ token, documentId, accessCanEdit });
  const canEdit = accessCanEdit && ownsLock;
  const editorRef = useDocumentAutosave({ documentId, canSave: canEdit });

  return (
    <>
      <h1>{title}</h1>
      <Editor
        key={documentId}
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        disabled={!canEdit}
        onInit={(_evt, editor) => { editorRef.current = editor; }}
        onRemove={() => { editorRef.current = undefined; }}
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
          rtc_token_provider: ({documentId}) => Promise.resolve({token}),

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
          rtc_encryption_provider: ({documentId, keyHint}) => Promise.resolve({key: 'This is not secure. Fix me!', keyHint: '1970-01-01T00:00:00.000Z'}),

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
        }}
      />
    </>
  );
}
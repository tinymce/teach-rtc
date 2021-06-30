import { Editor } from '@tinymce/tinymce-react';
import { decode } from 'jsonwebtoken';
import { useParams } from 'react-router-dom';
import { useCollaborators, useDocumentAutosave, useDocumentInitialValue, useDocumentLock, useDocumentTitle } from '../api/api';

const config = {
  height: 800,
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
  const { role } = useCollaborators({ documentId, username });
  const roleCanEdit = role === 'manage' || role === 'edit';
  const ownsLock = useDocumentLock({ token, documentId, roleCanEdit });
  const canEdit = roleCanEdit && ownsLock;
  const initialValue = useDocumentInitialValue({ documentId, canEdit });
  const editorRef = useDocumentAutosave({ documentId, canSave: canEdit, initialValue });

  return (
    <>
      <h1>{title}</h1>
      <Editor
        key={documentId}
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        disabled={!canEdit}
        initialValue={initialValue}
        onInit={(_evt, editor) => { editorRef.current = editor; }}
        onRemove={() => { editorRef.current = undefined; }}
        init={config}
      />
    </>
  );
}
import { useHistory, useParams } from 'react-router';
import { Editor } from '@tinymce/tinymce-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { decode } from 'jsonwebtoken';

const ROLE_POLL_TIME = 5000;
const LOCK_ACQUIRE_POLL_TIME = 1000;
const LOCK_RETAIN_POLL_TIME = 30000;
const VIEW_POLL_TIME = 5000;
const AUTOSAVE_TIME = VIEW_POLL_TIME;

const useDocumentTitle = (documentId) => {
  const [title, setTitle] = useState('');
  useEffect(() => {
    axios.get(`/documents/${documentId}/title`).then(({ data }) => setTitle(data.title));
  }, [documentId]);
  return title;
};

const useDocumentRole = (token, documentId) => {
  const [collaborators, setCollaborators] = useState([]);
  useEffect(() => {
    const updateCollaborators = () => {
      axios.get(`/documents/${documentId}/collaborators`)
        .then(({ data }) => setCollaborators(data.collaborators));
    };
    updateCollaborators();
    const timer = setInterval(updateCollaborators, ROLE_POLL_TIME);
    return () => clearInterval(timer);
  }, [documentId]);
  const { sub } = token ? decode(token) : {};
  const role = (collaborators.find((c) => c.username === sub) ?? {}).role;
  return role;
};

const useDocumentLock = (token, documentId, roleCanEdit) => {
  const [ownsLock, setOwnsLock] = useState(false);
  useEffect(() => {
    const requestLock = async () => {
      const { data: lock } = await axios.put(`/documents/${documentId}/lock`, {});
      setOwnsLock(lock.success);
    };
    const releaseLock = () => {
      axios.put(`/documents/${documentId}/lock`, { release: true });
    };
    if (roleCanEdit) {
      if (!ownsLock) {
        // attempt to acquire lock every second until we succeed
        requestLock();
        const timer = setInterval(requestLock, LOCK_ACQUIRE_POLL_TIME);
        return () => clearInterval(timer);
      } else {
        // after we have the lock maintain it by reacquiring every 30 seconds,
        // lock should only expire if we fail to acquire it for 60 seconds
        const timer = setInterval(requestLock, LOCK_RETAIN_POLL_TIME);
        return () => {
          // when we unmount stop trying to acquire the lock and release it if we have it
          clearInterval(timer);
          releaseLock();
        };
      }
    } else {
      setOwnsLock(false);
    }
  }, [token, documentId, roleCanEdit, ownsLock]);
  // return our current lock status
  return ownsLock;
};

const getInitialContent = async ({ documentId }) => {
  const { data } = await axios.get(`/documents/${documentId}/content`);
  if (!data.success) throw new Error(data.message);
  return data;
};

const useDocumentInitialValue = (documentId, canEdit) => {
  const [initialValue, setInitialValue] = useState('');
  useEffect(() => {
    const requestContent = () => getInitialContent({ documentId })
      .then((data) => setInitialValue(data.content));
    if (!canEdit) {
      // while we can't edit, poll the content every 5 seconds
      requestContent();
      const timer = setInterval(requestContent, VIEW_POLL_TIME);
      return () => clearInterval(timer);
    } else {
      // once we can edit get the content once to ensure we have the latest value
      requestContent();
    }
  }, [documentId, canEdit]);
  // return the initial value
  return initialValue;
};

const useDocumentAutosave = (documentId, canSave, initialValue) => {
  // reference to TinyMCE that must be set by the user of this hook
  const editorRef = useRef();
  // the initial value came from the server so when it changes 
  // we use that as the base saved content
  const [savedContent, setSavedContent] = useState(initialValue);
  useEffect(() => setSavedContent(initialValue), [initialValue]);
  // save periodically
  useEffect(() => {
    // only save when owning the lock
    if (canSave) {
      // check for content to save every second
      const timer = setInterval(() => {
        if (editorRef.current) {
          // check the current editor content against the saved content
          const content = editorRef.current.getContent();
          if (content !== savedContent) {
            // save the content to the server
            axios.put(
              `/documents/${documentId}/content`,
              { content }
            ).then(({ data }) => {
              // update the saved content when the save is confirmed
              if (data.success) {
                setSavedContent(content);
              }
            });
          }
        }
      }, AUTOSAVE_TIME);
      return () => clearInterval(timer);
    }
  }, [documentId, canSave, savedContent]);
  // save on navigation
  const history = useHistory();
  useEffect(() => {
    // stop navigation until we have gotten the editor content to save it
    const unblock = history.block(() => {
      // check we can actually save and the editor still exists
      if (canSave && editorRef.current) {
        // compare the editor content against the saved content
        const content = editorRef.current.getContent();
        if (content !== savedContent) {
          // save the content to the server
          axios.put(`/documents/${documentId}/content`, { content });
        }
      }
      // safe to continue navigation now
      unblock();
    });
    return () => unblock();
  });

  // return the editor reference to allow the editor to be set
  return editorRef;
};

const config = {
  height: 800,
  plugins: [
    'advlist autolink lists link image charmap print preview anchor',
    'searchreplace visualblocks code fullscreen',
    'insertdatetime media table paste code help wordcount'
  ],
  menubar: false,
  toolbar: 'undo redo | formatselect | ' +
    'bold italic backcolor | alignleft aligncenter ' +
    'alignright alignjustify | bullist numlist outdent indent | ' +
    'removeformat | help',
};

export default function DocumentEdit({ token }) {
  const { documentId } = useParams();
  const title = useDocumentTitle(documentId);
  const role = useDocumentRole(token, documentId);
  const roleCanEdit = role === 'manage' || role === 'edit';
  const ownsLock = useDocumentLock(token, documentId, roleCanEdit);
  const canEdit = roleCanEdit && ownsLock;
  const initialValue = useDocumentInitialValue(documentId, canEdit);
  const editorRef = useDocumentAutosave(documentId, canEdit, initialValue);

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
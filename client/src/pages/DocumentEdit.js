import { useHistory, useParams } from 'react-router';
import { Editor } from '@tinymce/tinymce-react';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const LOCK_ACQUIRE_POLL_TIME = 1000;
const LOCK_RETAIN_POLL_TIME = 30000;
const VIEW_POLL_TIME = 5000;
const AUTOSAVE_TIME = VIEW_POLL_TIME;

const useDocumentLock = (token, documentUuid) => {
  const [ownsLock, setOwnsLock] = useState(false);
  useEffect(() => {
    const requestLock = async () => {
      const { data: lock } = await axios.put(`/documents/${documentUuid}/lock`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
      setOwnsLock(lock.success);
    };
    const releaseLock = () => {
      axios.put(`/documents/${documentUuid}/lock`, { release: true }, { headers: { 'Authorization': `Bearer ${token}` } });
    };
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
  }, [token, documentUuid, ownsLock]);
  // return our current lock status
  return ownsLock;
};

const useDocumentInitialValue = (token, documentUuid, ownsLock) => {
  const [initialValue, setInitialValue] = useState('');
  useEffect(() => {
    const requestContent = async () => {
      const { data: resp } = await axios.get(`/documents/${documentUuid}/content`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.success) {
        setInitialValue(resp.content);
      }
    };
    if (!ownsLock) {
      // while we don't own the lock, poll the content every 5 seconds
      requestContent();
      const timer = setInterval(requestContent, VIEW_POLL_TIME);
      return () => clearInterval(timer);
    } else {
      // once we acquire the lock get the content once to ensure we have the latest value
      requestContent();
    }
  }, [token, documentUuid, ownsLock]);
  // return the initial value
  return initialValue;
};

const useDocumentAutosave = (token, documentUuid, ownsLock, initialValue) => {
  // reference to TinyMCE that must be set by the user of this hook
  const editorRef = useRef();
  // the initial value came from the server so when it changes 
  // we use that as the base saved content
  const [savedContent, setSavedContent] = useState(initialValue);
  useEffect(() => setSavedContent(initialValue), [initialValue]);
  // save periodically
  useEffect(() => {
    // only save when owning the lock
    if (ownsLock) {
      // check for content to save every second
      const timer = setInterval(() => {
        if (editorRef.current) {
          // check the current editor content against the saved content
          const content = editorRef.current.getContent();
          if (content !== savedContent) {
            // save the content to the server
            axios.put(
              `/documents/${documentUuid}/content`,
              { content },
              { headers: { 'Authorization': `Bearer ${token}` } }
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
  }, [token, documentUuid, ownsLock, savedContent]);
  // save on navigation
  const history = useHistory();
  useEffect(() => {
    // stop navigation until we have gotten the editor content to save it
    const unblock = history.block(() => {
      // check we can actually save and the editor still exists
      if (ownsLock && editorRef.current) {
        // compare the editor content against the saved content
        const content = editorRef.current.getContent();
        if (content !== savedContent) {
          // save the content to the server
          axios.put(
            `/documents/${documentUuid}/content`,
            { content },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
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

export default function DocumentEdit({ token }) {
  const { documentUuid } = useParams();
  const ownsLock = useDocumentLock(token, documentUuid);
  const [title, setTitle] = useState('');
  useEffect(() => {
    axios.get(`/documents/${documentUuid}/title`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(({ data }) => setTitle(data.title));
  }, [documentUuid, token]);
  const initialValue = useDocumentInitialValue(token, documentUuid, ownsLock);
  const editorRef = useDocumentAutosave(token, documentUuid, ownsLock, initialValue, AUTOSAVE_TIME);

  return (
    <>
      <h1>{title}</h1>
      <Editor
        key={documentUuid}
        apiKey={process.env.REACT_APP_TINYMCE_API_KEY}
        disabled={!ownsLock}
        initialValue={initialValue}
        onInit={(_evt, editor) => { editorRef.current = editor; }}
        onRemove={() => { editorRef.current = undefined; }}
        init={{
          height: 800
        }}
      />
    </>
  );
}
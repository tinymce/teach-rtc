import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';

const DOCUMENT_LIST_POLL_TIME = 60000;
const LOCK_ACQUIRE_POLL_TIME = 1000;
const LOCK_RETAIN_POLL_TIME = 30000;
const VIEW_POLL_TIME = 5000;
const AUTOSAVE_TIME = VIEW_POLL_TIME;

/**
 * A collaborator role.
 * @typedef {'manage' | 'edit' | 'view' | 'none'} Role
 */

/**
 * A collaborator.
 * @typedef {object} Collaborator
 * @property {string} username the collaborator username.
 * @property {Role} role the collaborator role.
 */

/**
 * Register a new user.
 * @param {object} inputs the inputs.
 * @param {string} inputs.username the username.
 * @param {string} inputs.password the password.
 * @param {string} inputs.fullName the full name.
 * @returns {Promise.<{success: true} | {success: false, message: string}>} promise containing nothing of interest when successful or a message describing the failure.
 */
export const registerUser = async ({ username, password, fullName }) => {
  const { data } = await axios.post('/users', { username, password, fullName });
  return data;
};

/**
 * Create a JWT to login.
 * @param {object} inputs the inputs.
 * @param {string} inputs.username the username.
 * @param {string} inputs.password the password. 
 * @returns {Promise.<{success: true, token: string} | {success: false, message: string}>} promise containing the jwt token when successful or a message describing the failure.
 */
export const loginUser = async ({ username, password }) => {
  const { data } = await axios.post('/jwt', { username, password });
  return data;
}

/**
 * Gets a list of all the users.
 * @returns {Promise.<{success: true, users: string[]}>} promise containing the list of usernames.
 */
export const getUsers = async () => {
  const { data } = await axios.get('/users');
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
};

/**
 * Get the details of a user.
 * @param {object} inputs the inputs.
 * @param {string} inputs.userId the username.
 * @returns {Promise.<{success: true, fullName: string}>} promise containing the user details.
 */
export const getUserDetails = async ({ userId }) => {
  const { data } = await axios.get(`/users/${userId}`);
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
};

/**
 * Gets a list of all the documents available to the logged in user.
 * @returns {Promise.<{success: true, documents: string[]}>} promise containing the list of documents.
 */
export const getDocuments = async () => {
  const { data } = await axios.get('/documents');
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
};

/**
 * Create a new document.
 * @param {object} inputs the inputs.
 * @param {string} inputs.title the document title.
 * @returns {Promise.<{success: true, uuid}>} promise containing the document uuid.
 */
export const createDocument = async ({ title }) => {
  const { data } = await axios.post('/documents', { title });
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
}

/**
 * Get the document title.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @returns {Promise.<{success: true, title: string}>} promise containing the document title.
 */
export const getDocumentTitle = async ({ documentId }) => {
  const { data } = await axios.get(`/documents/${documentId}/title`);
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
}

/**
 * Get the list of collaborators
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @returns {Promise.<{success: true, collaborators: Collaborator[]}>} promise containing the collaborators.
 */
export const getCollaborators = async ({ documentId }) => {
  const { data } = await axios.get(`/documents/${documentId}/collaborators`);
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
};

/**
 * Sets the role of a collaborator.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @param {string} inputs.username the username.
 * @param {Role} inputs.role the role.
 * @returns {Promise.<{success: true}>} promise that resolves on success.
 */
export const setCollaborator = async ({ documentId, username, role }) => {
  const { data } = await axios.put(`/documents/${documentId}/collaborators/${username}`, { role });
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
};

/**
 * Get the document content.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @returns {Promise<{success: true, content: string}>} promise containing the content.
 */
export const getContent = async ({ documentId }) => {
  const { data } = await axios.get(`/documents/${documentId}/content`);
  if (!data.success) throw new Error(data.message);
  return data;
};

/**
 * Save the document content.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @param {string} inputs.content the content.
 * @returns {Promise.<{success: true}>} promise that resolves on success.
 */
export const saveContent = async ({ documentId, content }) => {
  const { data } = await axios.put(`/documents/${documentId}/content`, { content });
  if (!data.success) {
    throw new Error(data.message);
  }
  return data;
};

/**
 * Update the lock on the document.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @param {boolean} inputs.release should the lock be released?
 * @returns {Promise<{success: boolean, release: boolean}>} promise that contains if the operation was a success and if the lock was released
 */
export const updateLock = async ({ documentId, release }) => {
  const { data } = await axios.put(`/documents/${documentId}/lock`, { release });
  return data;
};

/**
 * Hook to get details about a user.
 * @param {object} inputs the inputs.
 * @param {string} inputs.userId the username.
 * @returns {{fullName: string}}
 */
export const useUserDetails = ({ userId }) => {
  const [details, setDetails] = useState({ });
  useEffect(() => {
    if (userId) {
      getUserDetails({ userId })
        .then(({ fullName }) => setDetails({ fullName }))
        .catch((e) => console.log(e.message));
    } else {
      setDetails({ });
    }
  }, [userId]);
  return details;
};

/**
 * Hook to gather the list of documents accessible by the current user.
 * @param {object} inputs the inputs.
 * @param {string} inputs.token the JWT token used to represent the current user.
 * @returns {{documents: string[], appendDocument: (documentId: string) => void}}
 */
export const useDocuments = ({ token }) => {
  const [documents, setDocuments] = useState([]);
  useEffect(() => {
    const update = () => {
      getDocuments()
        .then(({ documents }) => setDocuments(documents ?? []))
        .catch((e) => console.log(e.message));
    };
    update();
    const timer = setInterval(update, DOCUMENT_LIST_POLL_TIME);
    return () => clearInterval(timer);
  }, [token]);
  const appendDocument = (documentId) => setDocuments((documents) => [...documents, documentId]);
  return { documents, appendDocument };
};

/**
 * Hook to get the document title.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @returns {string} the document title.
 */
export const useDocumentTitle = ({ documentId }) => {
  const [title, setTitle] = useState('');
  useEffect(() => {
    getDocumentTitle({ documentId }).then(({ title }) => setTitle(title)).catch((e) => console.log(e.message));
  }, [documentId]);
  return title;
};

/**
 * Hook to get the list of collaborators on a document and the role of the current user.
 * Also returns a method to trigger a refresh of the collaborators list.
 * @param {object} inputs the inputs. 
 * @param {string} inputs.documentId the document ID.
 * @param {string} inputs.username the username of the current user.
 * @returns {{collaborators: Collaborator[], role: Role, requestCollaborators: () => void}} the collaborators and the role the user has.
 */
export const useCollaborators = ({ documentId, username }) => {
  const [tick, setTick] = useState(0);
  const [collaborators, setCollaborators] = useState([]);
  const [role, setRole] = useState(undefined);
  useEffect(() => {
    getCollaborators({ documentId }).then(({ collaborators }) => {
      setCollaborators(collaborators);
      setRole((collaborators.find((c) => c.username === username) ?? {}).role);
    }).catch((e) => console.log(e.message));
  }, [documentId, username, tick]);
  const requestCollaborators = () => setTick((prev) => prev + 1);
  return { collaborators, role, requestCollaborators };
};

/**
 * Hook to get the list of users that could be added as a collaborator, only updating when needed is true.
 * @param {object} inputs the inputs.
 * @param {Collaborator[]} inputs.collaborators the collaborators.
 * @param {boolean} inputs.needed is the user list currently needed.
 * @returns {string[]} the list of possible users excluding the ones that are already collaborating.
 */
export const usePossibleCollaborators = ({ collaborators, needed }) => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (needed) {
      getUsers().then(({ users }) => {
        const userLookup = Object.fromEntries(collaborators.map((c) => [c.username, true]));
        setUsers(users.filter((user) => !userLookup[user]));
      }).catch((e) => console.log(e.message));
    }
  }, [collaborators, needed]);
  return users;
};

/**
 * Hook to get the lock for editing the document.
 * @param {object} inputs the inputs.
 * @param {string} inputs.token the JWT token representing the currently logged in user.
 * @param {string} inputs.documentId the document ID.
 * @param {boolean} inputs.roleCanEdit can the current user edit the document.
 * @returns {boolean} true if the current user owns the lock on the document.
 */
export const useDocumentLock = ({ token, documentId, roleCanEdit }) => {
  const [ownsLock, setOwnsLock] = useState(false);
  useEffect(() => {
    // helper to request the lock
    const requestLock = () => updateLock({ documentId, release: false })
      .then(({ success }) => setOwnsLock(success))
      .catch((e) => console.log(e.message));
    // helper to release the lock
    const releaseLock = () => updateLock({ documentId, release: true })
      .catch((e) => console.log(e.message));
    // only try to get the lock if the user is able to edit
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

/**
 * Hook to get the initial value of the document.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @param {boolean} inputs.canEdit can the user edit the document.
 * @returns {string} the initial value of the document.
 */
export const useDocumentInitialValue = ({ documentId, canEdit }) => {
  const [initialValue, setInitialValue] = useState('');
  useEffect(() => {
    const requestContent = () => getContent({ documentId })
      .then(({ content }) => setInitialValue(content))
      .catch((e) => console.log(e.message));
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

/**
 * Hook to autosave the editor regularly and before navigation.
 * @param {object} inputs the inputs.
 * @param {string} inputs.documentId the document ID.
 * @param {boolean} inputs.canSave can the document be saved by the current user.
 * @param {string} inputs.initialValue the document initial value.
 * @returns {React.MutableRefObject<Editor | undefined>} the reference to the tinymce instance.
 */
export const useDocumentAutosave = ({ documentId, canSave, initialValue }) => {
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
            saveContent({ documentId, content }).then(({ success }) => {
              // update the saved content when the save is confirmed
              if (success) {
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
          saveContent({ documentId, content }).catch((e) => console.log(e.message));
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
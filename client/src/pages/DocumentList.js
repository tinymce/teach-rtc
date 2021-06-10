import axios from 'axios';
import { useEffect, useState } from 'react';
import { Table, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { decode } from 'jsonwebtoken';
import NewDocModal from '../modals/NewDocModal';
import NewCollaboratorModal from '../modals/NewCollaboratorModal';
import EditCollaboratorModal from '../modals/EditCollaboratorModal';

const ROLE_TEXT = {
  'manage': 'Manager',
  'edit': 'Editor',
  'view': 'Viewer'
};

const ROLE_VARIANT = {
  'manage': 'primary',
  'edit': 'info',
  'view': 'secondary'
};

const Collaborator = ({ username, role, onEdit }) => {
  const editProps = (
    typeof onEdit === 'function'
      ? { action: true, onClick: onEdit }
      : {}
  );
  return (
    <ListGroup.Item variant={ROLE_VARIANT[role]} {...editProps}>
      {username}
      <Badge variant={ROLE_VARIANT[role]} className="ml-1">{ROLE_TEXT[role]}</Badge>
    </ListGroup.Item>
  );
};

const useTitle = (token, uuid) => {
  const [title, setTitle] = useState('');
  useEffect(() => {
    axios.get(`/documents/${uuid}/title`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(({ data }) => setTitle(data.title));
  }, [uuid, token]);
  return title;
};

const useCollaborators = (token, uuid) => {
  const [tick, setTick] = useState(0);
  const [collaborators, setCollaborators] = useState([]);
  useEffect(() => {
    axios.get(`/documents/${uuid}/collaborators`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(({ data }) => setCollaborators(data.collaborators));
  }, [uuid, token, tick]);
  const requestCollaborators = () => setTick((prev) => prev + 1);
  return { collaborators, requestCollaborators };
};

const usePossibleCollaborators = (token, collaborators, needed) => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (needed) {
      axios.get('/users', { headers: { 'Authorization': `Bearer ${token}` } }).then(({ data }) => {
        if (data.success) {
          const userLookup = Object.fromEntries(collaborators.map((c) => [c.username, true]));
          setUsers(data.users.filter((user) => !userLookup[user]));
        }
      });
    }
  }, [token, collaborators, needed]);
  return users;
};

const Doc = ({ uuid, token, username }) => {
  const title = useTitle(token, uuid);
  const { collaborators, requestCollaborators } = useCollaborators(token, uuid);
  // find our role
  const role = (collaborators.find((c) => c.username === username) ?? { username, role: 'none' }).role;
  const isManager = role === 'manage';
  // separate out the other collaborators
  const others = collaborators.filter((c) => c.username !== username);
  // modal data
  const [addCollaborator, setAddCollaborator] = useState(false);
  const [editCollaborator, setEditCollaborator] = useState(undefined);
  const users = usePossibleCollaborators(token, collaborators, addCollaborator);
  // update the collaborators
  const updateCollaborators = (username, role) => {
    axios.put(
      `/documents/${uuid}/collaborators/${username}`,
      { role },
      { headers: { 'Authorization': `Bearer ${token}` } }
    ).then(({ data }) => {
      if (data.success) requestCollaborators();
    });
  };
  // display a document row
  return (
    <tr>
      <td>
        <Link to={`/documents/${uuid}`}>{title}</Link>
      </td>
      <td>
        <Badge variant={ROLE_VARIANT[role]}>{ROLE_TEXT[role]}</Badge>
      </td>
      <td>
        <ListGroup>
          {others.map((c) => <Collaborator key={c.username} onEdit={isManager ? () => setEditCollaborator(c) : null} {...c} />)}
          {isManager && <ListGroup.Item key="static" variant="light" action onClick={() => setAddCollaborator(true)}>Add Collaborator</ListGroup.Item>}
        </ListGroup>
        <NewCollaboratorModal show={addCollaborator} users={users} title={title} onUpdate={updateCollaborators} onHide={() => setAddCollaborator(false)} />
        <EditCollaboratorModal collaborator={editCollaborator} title={title} onUpdate={updateCollaborators} onHide={() => setEditCollaborator(undefined)} />
      </td>
    </tr>
  )
};

export default function DocumentList({ token }) {
  const { sub } = token ? decode(token) : {};
  const [documents, setDocuments] = useState([]);
  useEffect(() => {
    const update = () => {
      axios.get('/documents', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(({ data }) => setDocuments(data.documents ?? []));
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [token]);

  const [addDocument, setAddDocument] = useState(false);

  const cancelNewDocument = () => setAddDocument(false);

  const addNewDocument = (title) => {
    axios.post('/documents', { title }, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(({ data }) => setDocuments((documents) => [...documents, data.uuid]));
    setAddDocument(false);
  };

  return (
    <>
      <h1>Documents</h1>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Title</th>
            <th>Role</th>
            <th>Collaborators</th>
          </tr>
        </thead>
        <tbody>
          {
            documents.map((docUuid) => <Doc key={docUuid} uuid={docUuid} token={token} username={sub} />)
          }
        </tbody>
      </Table>
      <Button onClick={() => setAddDocument(true)}>Add New Document</Button>
      <NewDocModal show={addDocument} addNewDocument={addNewDocument} cancelNewDocument={cancelNewDocument} />
    </>
  );
}
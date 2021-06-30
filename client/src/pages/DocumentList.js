import { useState } from 'react';
import { Table, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { decode } from 'jsonwebtoken';
import NewDocModal from '../modals/NewDocModal';
import NewCollaboratorModal from '../modals/NewCollaboratorModal';
import EditCollaboratorModal from '../modals/EditCollaboratorModal';
import { createDocument, setCollaborator, useCollaborators, useDocuments, useDocumentTitle, usePossibleCollaborators } from '../api/api';

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

const Doc = ({ documentId, username }) => {
  const title = useDocumentTitle({ documentId });
  const { collaborators, role, requestCollaborators } = useCollaborators({ documentId, username });
  const isManager = role === 'manage';
  // separate out the other collaborators
  const others = collaborators.filter((c) => c.username !== username);
  // modal display flags
  const [addCollaborator, setAddCollaborator] = useState(false);
  const [editCollaborator, setEditCollaborator] = useState(undefined);
  // modal data
  const users = usePossibleCollaborators({ collaborators, needed: addCollaborator });
  // update the collaborators
  const updateCollaborators = (username, role) => {
    setCollaborator({ documentId, username, role })
      .then(() => requestCollaborators())
      .catch((e) => console.log(e.message));
  };
  // display a document row
  return (
    <tr>
      <td>
        <Link to={`/documents/${documentId}`}>{title}</Link>
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
  const { sub: username } = token ? decode(token) : {};
  const { documents, appendDocument } = useDocuments({ token });
  // modal display flag
  const [addDocument, setAddDocument] = useState(false);
  // modal callbacks
  const cancelNewDocument = () => setAddDocument(false);
  const addNewDocument = (title) => {
    createDocument({ title }).then(({ uuid }) => appendDocument(uuid));
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
            documents.map((docUuid) => <Doc key={docUuid} documentId={docUuid} username={username} />)
          }
        </tbody>
      </Table>
      <Button onClick={() => setAddDocument(true)}>Add New Document</Button>
      <NewDocModal show={addDocument} addNewDocument={addNewDocument} cancelNewDocument={cancelNewDocument} />
    </>
  );
}
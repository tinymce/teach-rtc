import { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

export default function EditCollaboratorModal({ title, collaborator, onUpdate, onHide }) {
  const [access, setAccess] = useState(collaborator?.access);
  useEffect(() => setAccess(collaborator?.access), [collaborator]);

  const handleHide = () => onHide();

  const handleSubmit = (evt) => {
    evt.preventDefault();
    onUpdate(collaborator?.username, access);
    handleHide();
  };

  return (
    <Modal show={!!collaborator} onHide={handleHide}>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Update Collaborator on "{title}"</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group controlId="formNewCollaboratorUsername">
            <Form.Label>Username</Form.Label>
            <Form.Control type="text" value={collaborator?.username} readOnly/>
          </Form.Group>
          <Form.Group controlId="formNewCollaboratorAccess">
            <Form.Label>Access</Form.Label>
            <Form.Control as="select" name="access" value={access} onChange={(evt) => setAccess(evt.target.value)}>
              <option value="manage">Manager</option>
              <option value="edit">Editor</option>
              <option value="view">Viewer</option>
              <option value="none">None</option>
            </Form.Control>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleHide}>Cancel</Button>
          <Button variant="primary" type="submit">Update Collaborator</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
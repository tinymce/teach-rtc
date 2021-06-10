import { useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

export default function EditCollaboratorModal({ title, collaborator, onUpdate, onHide }) {
  const [role, setRole] = useState(collaborator?.role);
  useEffect(() => setRole(collaborator?.role), [collaborator]);

  const handleHide = () => onHide();

  const handleSubmit = (evt) => {
    evt.preventDefault();
    onUpdate(collaborator?.username, role);
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
          <Form.Group controlId="formNewCollaboratorRole">
            <Form.Label>Role</Form.Label>
            <Form.Control as="select" name="role" value={role} onChange={(evt) => setRole(evt.target.value)}>
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
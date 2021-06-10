import { useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

export default function NewCollaboratorModal({ show, title, users, onUpdate, onHide }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("edit");

  const handleHide = () => {
    onHide();
    setUsername("");
    setRole("edit");
  };

  const handleSubmit = (evt) => {
    evt.preventDefault();
    onUpdate(username, role);
    handleHide();
  };

  return (
    <Modal show={show} onHide={handleHide}>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>New Collaborator on "{title}"</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group controlId="formNewCollaboratorUsername">
            <Form.Label>Username</Form.Label>
            <Form.Control as="select" value={username} onChange={(evt) => setUsername(evt.target.value)}>
              <option value="">Pick a user</option>
              {users.map((user) => <option key={user} value={user}>{user}</option>)}
            </Form.Control>
          </Form.Group>
          <Form.Group controlId="formNewCollaboratorRole">
            <Form.Label>Role</Form.Label>
            <Form.Control as="select" name="role" value={role} onChange={(evt) => setRole(evt.target.value)}>
              <option value="manage">Manager</option>
              <option value="edit">Editor</option>
              <option value="view">Viewer</option>
            </Form.Control>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleHide}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!username}>Add New Collaborator</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
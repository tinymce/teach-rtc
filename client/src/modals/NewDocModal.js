import { useRef, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';

export default function NewDocModal({ show, addNewDocument, cancelNewDocument }) {
  const [title, setTitle] = useState("");
  const titleRef = useRef();

  const onSubmit = (evt) => {
    evt.preventDefault();
    addNewDocument(title);
    setTitle('');
  };

  const onHide = () => {
    setTitle('');
    cancelNewDocument();
  };

  return (
    <Modal show={show} onHide={onHide} onEntered={() => titleRef.current.focus()}>
      <Form onSubmit={onSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>New Document</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group controlId="formNewDocTitle">
            <Form.Label>Title</Form.Label>
            <Form.Control ref={titleRef} type="text" placeholder="Document Title" value={title} onChange={(evt) => setTitle(evt.target.value)} />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!/\S/.test(title)}>Create New Document</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
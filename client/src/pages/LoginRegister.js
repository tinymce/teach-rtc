import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { useHistory } from 'react-router';
import axios from 'axios';

export default function LoginRegister({ setToken }) {
  const history = useHistory();
  const [{ username, password, confirmPassword, register }, setData] = useState({ username: '', password: '', confirmPassword: '', register: false });
  const [error, setError] = useState(undefined);

  const loginOrRegister = async () => {
    if (register) {
      if (password !== confirmPassword) {
        return setError('The password does not match the confirmation password.');
      }
      const { data: register } = await axios.post('/users', { username, password });
      if (!register.success) {
        return setError(register.message);
      }
    }
    const { data: login } = await axios.post('/jwt', { username, password });
    if (!login.success) {
      return setError(login.message);
    }
    setError(undefined);
    setToken(login.token);
    history.push('/');
  };

  const onChange = (evt) =>
    setData((prev) => ({ ...prev, [evt.target.name]: evt.target.type === 'checkbox' ? evt.target.checked : evt.target.value }));

  const onSubmit = (evt) => {
    evt.preventDefault();
    loginOrRegister();
  };
  return (
    <>
      <h1>Login or Register</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form onSubmit={onSubmit}>
        <Form.Group controlId="formRegisterUserName">
          <Form.Label>User Name</Form.Label>
          <Form.Control type="text" placeholder="Enter user name" name="username" value={username} onChange={onChange} required />
        </Form.Group>
        <Form.Group controlId="formRegisterPassword">
          <Form.Label>Password</Form.Label>
          <Form.Control type="password" placeholder="Password" name="password" value={password} onChange={onChange} required />
        </Form.Group>
        <Form.Group controlId="formRegisterShould">
          <Form.Check type="checkbox" label="Register?" name="register" value={register} onChange={onChange} />
        </Form.Group>
        {register && (
          <Form.Group controlId="formRegisterConfirmPassword">
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control type="password" placeholder="Confirm Password" name="confirmPassword" value={confirmPassword} onChange={onChange} required />
          </Form.Group>
        )}
        <Button variant="primary" type="submit">{register ? 'Register' : 'Login' }</Button>
      </Form>
    </>
  );
}
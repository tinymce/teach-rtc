import React, { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { useHistory } from 'react-router';
import { loginUser, registerUser } from '../api/api';

export default function LoginRegister({ setToken }) {
  const history = useHistory();
  const [{ username, password, confirmPassword, fullName, register }, setData] = useState({ username: '', password: '', confirmPassword: '', fullName: '', register: false });
  const [error, setError] = useState(undefined);

  const loginOrRegister = async () => {
    if (!/^[a-zA-Z0-9~_.-]+$/.test(username)) {
      return setError('The username must not be empty and must only contain alphanumeric characters with tilde, underscore, dot or dash.')
    }
    if (password.length === 0) {
      return setError('The password must not be empty.');
    }
    if (register) {
      if (password !== confirmPassword) {
        return setError('The password does not match the confirmation password.');
      }
      if (!/\S/.test(fullName)) {
        return setError('The full name must contain visible characters.')
      }
      const { success, message } = await registerUser({ username, password, fullName });
      if (!success) {
        return setError(message);
      }
    }
    const { success, message, token } = await loginUser({ username, password });
    if (!success) {
      return setError(message);
    }
    setError(undefined);
    setToken(token);
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
          <>
            <Form.Group controlId="formRegisterConfirmPassword">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control type="password" placeholder="Confirm Password" name="confirmPassword" value={confirmPassword} onChange={onChange} required />
            </Form.Group>
            <Form.Group controlId="formRegisterDisplayName">
              <Form.Label>Full Name</Form.Label>
              <Form.Control type="text" placeholder="Full Name" name="fullName" value={fullName} onChange={onChange} required />
            </Form.Group>
          </>
        )}
        <Button variant="primary" type="submit">{register ? 'Register' : 'Login' }</Button>
      </Form>
    </>
  );
}
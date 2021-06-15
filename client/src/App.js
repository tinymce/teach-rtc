import './App.css';
import { useState, useEffect } from 'react';
import { decode } from 'jsonwebtoken'
import { Col, Container, Row } from 'react-bootstrap';
import { Redirect, Route, Switch } from 'react-router';
import DocumentList from './pages/DocumentList';
import DocumentEdit from './pages/DocumentEdit';
import LoginRegister from './pages/LoginRegister';
import Logout from './pages/Logout';
import Navigation from './components/Navigation';
import axios from 'axios';

const setGlobalTokenState = (token) => {
  if (token) {
    localStorage.setItem('jwt', token);
    axios.defaults.headers['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('jwt');
    delete axios.defaults.headers['Authorization'];
  }
  return token;
};

const useToken = () => {
  const [token, setTokenState] = useState(() => setGlobalTokenState(localStorage.getItem('jwt')));
  const setToken = (token) => setTokenState(setGlobalTokenState(token));
  useEffect(() => {
    if (token) {
      // calculate when the token will expire and setup a timer to automatically clear it
      const { exp } = decode(token);
      const expiryDelay = Math.max(0, (exp * 1000) - Date.now());
      const expiryTimer = setTimeout(() => setToken(null), expiryDelay);
      // setup a cleanup function to remove the token expiry timer if we logout or login again
      return () => clearTimeout(expiryTimer);
    }
  }, [token]);

  return [token, setToken];
};

function App() {
  const [token, setToken] = useToken();

  return (
    <Container>
      <Row>
        <Col>
          <Navigation token={token} />
        </Col>
      </Row>
      <Row>
        <Col>
          <Switch>
            <Route path="/logout"><Logout setToken={setToken} /></Route>
            <Route path="/login"><LoginRegister setToken={setToken} /></Route>
            <Route path="/documents/:documentId">{token ? <DocumentEdit token={token} /> : <Redirect to="/login" />}</Route>
            <Route path="/documents">{token ? <DocumentList token={token} /> : <Redirect to="/login" />}</Route>
            <Route path="/">{token ? <Redirect to="/documents" /> : <Redirect to="/login" />}</Route>
          </Switch>
        </Col>
      </Row>
    </Container>
  );
}

export default App;

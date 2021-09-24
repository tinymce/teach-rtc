import { Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { LinkContainer } from "react-router-bootstrap";
import { decode } from 'jsonwebtoken';
import { useEffect, useState } from 'react';
import { useUserDetails } from '../api/api';

const getSessionRemainder = (exp) => exp !== undefined ? Math.max(0, exp - Math.ceil(Date.now() / 1000)) : 0;

const calcTimeUnits = (time) => {
  let seconds = Math.floor(time);
  let minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  let hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  let days = Math.floor(hours / 24);
  hours -= days * 24;
  return { seconds, minutes, hours, days };
};

const Count = ({ count, single, plural }) => {
  if (count <= 0) {
    return null;
  } else if (count === 1) {
    return <>{count} {single} </>
  } else {
    return <>{count} {plural} </>
  }
}

const Delay = ({ time }) => {
  const { seconds, minutes, hours, days } = calcTimeUnits(time);
  return (
    <>
      <Count count={days} single='day' plural='days' />
      <Count count={hours} single='hour' plural='hours' />
      <Count count={minutes} single='minute' plural='minutes' />
      <Count count={seconds} single='second' plural='seconds' />
    </>
  );
};

const SessionExpiry = ({ exp }) => {
  const [time, setTime] = useState(getSessionRemainder(exp));
  useEffect(() => {
    if (exp) {
      const updateTimer = setInterval(() => setTime(getSessionRemainder(exp)), 1000);
      return () => clearInterval(updateTimer);
    }
  }, [exp]);
  return <>Session expires in <Delay time={time} /></>;
}

export default function Navigation({ token }) {
  const { sub, exp } = token ? decode(token) : {};
  const { fullName } = useUserDetails({ userId: sub });

  return (
    <Navbar bg="light" variant="light">
      <Navbar.Brand>Tiny Docs</Navbar.Brand>
      {
        sub ? (
          <>
            <Nav>
              <LinkContainer to="/documents"><Nav.Link>Documents</Nav.Link></LinkContainer>
            </Nav>
            <Nav>
              <NavDropdown title={fullName ?? sub} id="account-dropdown">
                <LinkContainer to="/logout"><NavDropdown.Item>Logout</NavDropdown.Item></LinkContainer>
              </NavDropdown>
            </Nav>

            <Navbar.Collapse className="justify-content-end">
              <Navbar.Text><SessionExpiry exp={exp} /></Navbar.Text>
            </Navbar.Collapse>
          </>
        ) : (
          <>
            <Nav>
              <LinkContainer to="/login"><Nav.Link>Login/Register</Nav.Link></LinkContainer>
            </Nav>
          </>
        )
      }
    </Navbar>
  );
}
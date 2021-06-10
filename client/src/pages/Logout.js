import { useEffect } from 'react';
import { useHistory } from 'react-router';


export default function Logout({setToken}) {
  const history = useHistory();
  useEffect(() => {
    setToken(null);
    history.push('/login');
  });
  return (
    <p>Logging out</p>
  );
}
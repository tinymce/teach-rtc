
const cursorColors = ['#2dc26b', '#e03e2d', '#f1c40f', '#3598db', '#b96ad9', '#e67e23', '#aaa69d', '#f368e0'];

const logos = {
  'firefox': '/firefox.svg',
  'chrome': '/chrome.svg',
  'safari': '/safari.svg',
  'edge': '/edge.svg'
};

export default function ConnectedClient({ caretNumber, fullName, browser }) {
  const colour = cursorColors[caretNumber - 1];
  const browserLogo = browser && logos[browser] ? <img alt={browser} src={process.env.PUBLIC_URL + logos[browser]} /> : null;
  return (
    <span className="client" style={{borderColor: colour, color: colour }}>{fullName}{browserLogo}</span>
  )
}
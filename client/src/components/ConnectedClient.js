
const cursorColors = ['#2dc26b', '#e03e2d', '#f1c40f', '#3598db', '#b96ad9', '#e67e23', '#aaa69d', '#f368e0'];

const style = {
  display: 'inline-block',
  borderWidth: '1px',
  borderStyle: 'solid',
  padding: '0px 5px',
  margin: '5px'
};

export default function ConnectedClient({ caretNumber, fullName, isMobile }) {
  const colour = cursorColors[caretNumber - 1];
  return (
    <span style={{ ...style, borderColor: colour, color: colour }}>{fullName}{isMobile ? ' 📱' : ''}</span>
  )
}
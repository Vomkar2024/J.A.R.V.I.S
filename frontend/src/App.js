import background from './img/background.jpeg';
import './App.css';
import Navbar from './component/Navbar';
import FireAIBlob from './component/blob';

function App() {
  return (
    <div className="app-container">
      <Navbar />
      <div className="blob-wrapper">
        <FireAIBlob />
      </div>
      <img src={background} className="bg-image" alt="" aria-hidden="true" />
    </div>
  );
}

export default App;


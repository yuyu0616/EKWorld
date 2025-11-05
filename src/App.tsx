import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './css/App.css';  

import Home from './pages/Home';
import Roulette from './pages/Roulette';

function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/roulette" element={<Roulette />} />
        </Routes>
    </Router>
  )
}

export default App

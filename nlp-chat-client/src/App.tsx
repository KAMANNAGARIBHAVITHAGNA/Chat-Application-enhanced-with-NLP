import React from 'react';
import { Chat } from './components/chat/Chat';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <h1>NLP Chat</h1>
      <Chat />
    </div>
  );
};

export default App;

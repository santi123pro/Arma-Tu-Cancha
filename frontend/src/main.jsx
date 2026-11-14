import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource-variable/inter'
// Barlow Condensed solo para los signos que dibuja Toki (lib/tokiSvg.js).
import '@fontsource/barlow-condensed/700.css'
import './estilos.css'
import { activarPwa } from './lib/pwa'

activarPwa()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
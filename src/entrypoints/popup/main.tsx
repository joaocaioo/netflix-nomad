import { render } from 'preact';
import { App } from './App';
import '@fontsource/bebas-neue/400.css';
import '@/ui/shared.css';
import './style.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

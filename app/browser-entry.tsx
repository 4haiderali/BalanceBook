import {createRoot} from 'react-dom/client';
import Home from './page';
import './globals.css';

const container=document.getElementById('root');
if(!container)throw Error('App container is missing.');

async function start(){
  const Page=location.pathname.replace(/\/$/,'')==='/setup'
    ? (await import('./setup/page')).default
    : Home;
  createRoot(container!).render(<Page/>);
}

void start();

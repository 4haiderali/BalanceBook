import MoneyApp from './money-app';
import {AuthGate} from './auth-gate';
import {ThemeSync} from './theme-sync';
export default function Home(){return <><ThemeSync/><AuthGate><MoneyApp/></AuthGate></>}

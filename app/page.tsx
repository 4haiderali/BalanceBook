import MoneyApp from './money-app';
import {AuthGate} from './auth-gate';
export default function Home(){return <AuthGate><MoneyApp/></AuthGate>}

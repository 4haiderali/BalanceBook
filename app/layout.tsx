import {AppExperience} from './app-experience';
import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#285c48'};
export const metadata:Metadata={title:'BalanceBook',description:'A clearer view of your money. Personal accounts, spending and people.',applicationName:'BalanceBook',appleWebApp:{capable:true,title:'BalanceBook',statusBarStyle:'default'},icons:{icon:'/icons/app-192.png',apple:'/icons/apple-touch-icon.png'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials"/></head><body><AppExperience/>{children}</body></html>}

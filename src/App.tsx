import { useState } from 'react';
import { ExpenseProvider, useExpenses } from '@/hooks/useExpenses';
import HomePage from '@/sections/HomePage';
import StatsPage from '@/sections/StatsPage';
import BottomNav from '@/sections/BottomNav';
import './App.css';
function Pages(){
  const [tab,setTab]=useState<'home'|'stats'>('home');
  const {error,clearError}=useExpenses();
  return <div className="app-shell">
    {error&&<div className="store-error" role="alert">{error}<button onClick={clearError}>关闭</button></div>}
    <main className="pages">
      <section className="tab-page" hidden={tab!=='home'} aria-label="记账页面"><HomePage/></section>
      <section className="tab-page" hidden={tab!=='stats'} aria-label="占比页面"><StatsPage/></section>
    </main>
    <BottomNav tab={tab} onChange={setTab}/>
  </div>;
}
export default function App(){return <ExpenseProvider><Pages/></ExpenseProvider>;}

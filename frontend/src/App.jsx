import RecordsTableWithFilters from './components/RecordsTableWithFilters';
import RecordsTableSelected from './components/RecordsTableSelected';
import './App.css';

export default function App() {
  return (
    <main>
      <RecordsTableWithFilters defaultPageSize={100} />
      <RecordsTableSelected />
    </main>
  );
}

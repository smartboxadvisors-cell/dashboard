import { useState, useEffect } from 'react';
import './App.css';

const url = `http://localhost:3000/data`;

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const itemsPerPage = 50; // Number of items per page

  // Fetch data from API with pagination
  const fetchData = async (page) => {
    try {
      setLoading(true);
      const skip = (page - 1) * itemsPerPage;
      const response = await fetch(`${url}?limit=${itemsPerPage}&skip=${skip}`);
      const result = await response.json();

      console.log('API Response:', result);  // Log the full response

      // Check if 'data' is an array before calling map
      if (Array.isArray(result.data)) {
        setData(result.data);
        const totalCount = result.totalCount;  // Assuming your API returns totalCount
        setTotalPages(Math.ceil(totalCount / itemsPerPage)); // Calculate total pages
      } else {
        setError('Unexpected data format');  // Handle unexpected format
      }
    } catch (error) {
      setError('Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on page change
  useEffect(() => {
    fetchData(page);
  }, [page]);

  // Handle next page
  const handleNext = () => {
    if (page < totalPages) setPage(page + 1);
  };

  // Handle previous page
  const handlePrev = () => {
    if (page > 1) setPage(page - 1);
  };

  return (
    <div>
      <h1>Data from MongoDB</h1>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div>{error}</div>
      ) : (
        <div className='data'>
          <ul>
            {data.length > 0 ? (
              data.map((item, index) => (
                <li key={index}>{item.scheme_name}</li> // Display each item from the data
              ))
            ) : (
              <p>No data available</p>
            )}
          </ul>

          {/* Pagination Controls */}
          <div>
            <button onClick={handlePrev} disabled={page === 1}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={handleNext} disabled={page === totalPages}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

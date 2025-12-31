import { useQuery } from "@tanstack/react-query";
import { fetchApiData } from "./api/client";

function App() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["apiData"],
    queryFn: fetchApiData,
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Gong Call Coaching!</h1>
      
      {isLoading && <p>Loading...</p>}
      
      {isError && (
        <div style={{ color: "red", marginTop: "1rem" }}>
          <p>Error loading data:</p>
          <p>{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      )}
      
      {data && (
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
          <h2>API Response:</h2>
          <p>{data.message}</p>
        </div>
      )}
    </div>
  );
}

export default App;


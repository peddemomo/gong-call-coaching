const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface ApiResponse {
  message: string;
}

export const fetchApiData = async (): Promise<ApiResponse> => {
  const response = await fetch(`${API_BASE_URL}/`, {
    method: "GET",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }
  
  return response.json();
};


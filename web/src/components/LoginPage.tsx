import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { login, error, clearError, isLoading } = useAuth();

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    if (response.credential) {
      try {
        await login(response.credential);
      } catch {
        // Error is handled in context
      }
    }
  };

  const handleGoogleError = () => {
    console.error("[Login] Google sign-in failed");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#f8f9fa",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "3rem",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
          maxWidth: "400px",
          width: "90%",
        }}
      >
        <h1
          style={{
            margin: "0 0 0.5rem 0",
            fontSize: "1.75rem",
            color: "#333",
          }}
        >
          Gong Call Coaching
        </h1>
        <p
          style={{
            margin: "0 0 2rem 0",
            color: "#666",
            fontSize: "0.95rem",
          }}
        >
          Sign in to continue
        </p>

        {isLoading ? (
          <div
            style={{
              padding: "1rem",
              color: "#666",
            }}
          >
            Loading...
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#fef2f2",
              borderRadius: "8px",
              border: "1px solid #fecaca",
            }}
          >
            <p
              style={{
                margin: "0 0 0.5rem 0",
                color: "#dc2626",
                fontWeight: 500,
              }}
            >
              Access Denied
            </p>
            <p
              style={{
                margin: "0",
                color: "#7f1d1d",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </p>
            <button
              onClick={clearError}
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <p
        style={{
          marginTop: "2rem",
          color: "#999",
          fontSize: "0.8rem",
        }}
      >
        Only authorized team members can access this application.
      </p>
    </div>
  );
}

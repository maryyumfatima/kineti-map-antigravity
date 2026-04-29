import { useState } from 'react'
import './App.css'

function App() {
  const [response, setResponse] = useState("")

  const sendMessage = async () => {
    const res = await fetch("https://nxohcxzoudwccernofax.supabase.co/functions/v1/groq-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sb_publishable_njAtw0EJu4TYfRJ9SDb9Zg_LfIFII96",
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "Hello" }
        ]
      }),
    });

    const data = await res.json();
    console.log(data);
    setResponse(JSON.stringify(data, null, 2));
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>API Test</h2>

      <button onClick={sendMessage}>
        Send Message
      </button>

      <pre>{response}</pre>
    </div>
  )
}

export default App
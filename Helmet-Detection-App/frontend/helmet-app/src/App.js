import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [plates, setPlates] = useState([]);
  const [loading, setLoading] = useState(false);

  
  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setProcessedImage(null); 
    setPlates([]);
  };

  // Send Backend
  const handleUpload = async () => {
    if (!selectedFile) return alert("Please select an image first!");

    const formData = new FormData();
    formData.append('image', selectedFile);

    setLoading(true);
    try {
      // Send request Flask server 
      const response = await axios.post('http://127.0.0.1:5000/detect', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Show data from Backend
      setProcessedImage(`data:image/jpeg;base64,${response.data.image}`);
      setPlates(response.data.plates);
      
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Something went wrong!");
    }
    setLoading(false);
  };

  return (
    <div className="App" style={{ textAlign: "center", padding: "20px" }}>
      <h1>🛵 Smart Helmet Detection System</h1>
      
      <input type="file" onChange={handleFileChange} accept="image/*" />
      <button onClick={handleUpload} style={{ marginLeft: "10px", padding: "5px 15px" }}>
        {loading ? "Processing..." : "Detect"}
      </button>

      <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "20px" }}>
        {selectedFile && (
          <div>
            <h3>Original Image</h3>
            <img src={URL.createObjectURL(selectedFile)} alt="Original" width="400" />
          </div>
        )}

        {processedImage && (
          <div>
            <h3>Processed Image (AI)</h3>
            <img src={processedImage} alt="Processed" width="400" style={{ border: "2px solid red" }} />
          </div>
        )}
      </div>

      {plates.length > 0 && (
        <div style={{ marginTop: "20px", background: "#f0f0f0", padding: "10px", borderRadius: "8px" }}>
          <h3>🚫 Detected Number Plates (Violations):</h3>
          <ul>
            {plates.map((plate, index) => (
              <li key={index} style={{ color: "red", fontSize: "1.2rem", fontWeight: "bold" }}>
                {plate}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
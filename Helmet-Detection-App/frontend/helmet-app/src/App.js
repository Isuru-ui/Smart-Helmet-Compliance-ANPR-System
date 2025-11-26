import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import './App.css'; 

// Levenshtein Distance Algorithm 
const levenshteinDistance = (s, t) => {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
    }
  }
  return arr[t.length][s.length];
};

function App() {
  const [mode, setMode] = useState('image');
  const [processedImage, setProcessedImage] = useState(null);
  const [plates, setPlates] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  const webcamRef = useRef(null);
  const videoRef = useRef(null);

  const cleanText = (text) => text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const sendToBackend = async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('http://127.0.0.1:5000/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProcessedImage(`data:image/jpeg;base64,${response.data.image}`);
      
      const newDetectedPlates = response.data.plates;

      if (newDetectedPlates.length > 0) {
        setPlates(currentList => {
            let updatedList = [...currentList]; 
            newDetectedPlates.forEach(rawNewPlate => {
                const cleanNew = cleanText(rawNewPlate);
                if (cleanNew.length < 4 || !/\d/.test(cleanNew)) return;

                let matchFound = false;
                updatedList = updatedList.map(existingPlate => {
                    const cleanExisting = cleanText(existingPlate);
                    const distance = levenshteinDistance(cleanNew, cleanExisting);
                    if (distance <= 2 || cleanExisting.includes(cleanNew) || cleanNew.includes(cleanExisting)) {
                        matchFound = true;
                        return cleanNew.length > cleanExisting.length ? rawNewPlate : existingPlate;
                    }
                    return existingPlate;
                });

                if (!matchFound) updatedList.push(rawNewPlate);
            });
            return updatedList;
        });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setPlates([]); 
    sendToBackend(file);
  };

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setPlates([]); 
      setProcessedImage(null);
    }
  };

  const captureVideoFrame = async () => {
    const video = videoRef.current;
    if (video && !video.paused && !video.ended && !isProcessing) {
        setIsProcessing(true);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
            if (blob) {
                const file = new File([blob], "video-frame.jpg", { type: "image/jpeg" });
                await sendToBackend(file);
            }
            setIsProcessing(false);
        }, 'image/jpeg');
    }
  };

  const captureWebcam = useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc && !isProcessing) {
      setIsProcessing(true);
      const blob = await fetch(imageSrc).then((res) => res.blob());
      const file = new File([blob], "webcam-snap.jpg", { type: "image/jpeg" });
      await sendToBackend(file);
      setIsProcessing(false);
    }
  }, [isProcessing]);

  useEffect(() => {
    let interval;
    if (mode === 'webcam') interval = setInterval(captureWebcam, 800);
    else if (mode === 'video' && videoUrl) interval = setInterval(captureVideoFrame, 1000);
    return () => clearInterval(interval);
  }, [mode, videoUrl, captureWebcam]);

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h1>Smart Helmet Compliance-ANPR System</h1>
        <p>AI-Powered Helmet & License Plate Detection</p>
      </div>

      {/* Controls */}
      <div className="controls">
        <button className={`btn ${mode === 'image' ? 'active' : ''}`} onClick={() => setMode('image')}>📷 Image Upload</button>
        <button className={`btn ${mode === 'video' ? 'active' : ''}`} onClick={() => setMode('video')}>🎬 Video Analysis</button>
        <button className={`btn ${mode === 'webcam' ? 'active' : ''}`} onClick={() => setMode('webcam')}>📹 Live CCTV</button>
      </div>

      {/* Main Grid */}
      <div className="main-content">
        
        {/* Input Card */}
        <div className="card">
          <h3>Input Source</h3>
          
          {mode === 'image' && (
            <div className="file-upload-wrapper">
              <label htmlFor="file-upload" className="custom-file-upload">
                📂 Click to Upload Image
              </label>
              <input id="file-upload" type="file" onChange={handleImageUpload} accept="image/*" />
            </div>
          )}

          {mode === 'video' && (
            <div style={{width: '100%'}}>
                <div className="file-upload-wrapper" style={{marginBottom: '10px'}}>
                  <label htmlFor="video-upload" className="custom-file-upload" style={{padding: '10px 20px'}}>
                    📂 Select Video File
                  </label>
                  <input id="video-upload" type="file" onChange={handleVideoUpload} accept="video/*" />
                </div>
                {videoUrl && (
                    <video ref={videoRef} src={videoUrl} controls autoPlay muted className="media-display" />
                )}
            </div>
          )}

          {mode === 'webcam' && (
            <div>
               <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="media-display" />
               <div className="live-indicator">● LIVE ANALYZING</div>
            </div>
          )}
        </div>

        {/* Result Card */}
        <div className="card">
          <h3>AI Detection Output</h3>
          {processedImage ? (
            <img src={processedImage} alt="Processed" className="media-display" style={{border: '2px solid #2ecc71'}} />
          ) : (
            <div style={{color: '#bdc3c7', marginTop: '50px', textAlign: 'center'}}>
              <p>Waiting for input...</p>
              <p style={{fontSize: '3rem'}}>👁️</p>
            </div>
          )}
        </div>
      </div>

      {/* Violations Section */}
      <div className="violations-section">
        <h3>📋 Detected Violations Log</h3>
        {plates.length === 0 ? (
            <p style={{color: '#7f8c8d'}}>No violations detected yet.</p>
        ) : (
            <div className="plate-grid">
                {plates.map((plate, index) => (
                    <div key={index} className="plate-card">
                        {plate}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}

export default App;
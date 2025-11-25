from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import easyocr
import base64

app = Flask(__name__)
CORS(app)

print("Loading Models...")
helmet_model = YOLO("helmet_best.pt") 

plate_model = YOLO("plate_best.pt")   

reader = easyocr.Reader(['en'])

@app.route('/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    img_array = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    
    original_img = img.copy()

    detected_plates = []
    violation_found = False

    helmet_results = helmet_model(img)

    for r in helmet_results:
        boxes = r.boxes
        for box in boxes:
            cls = int(box.cls[0])
            label = helmet_model.names[cls]
            conf = float(box.conf[0])
            
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if label in ["No Helmet", "No-Helmet", "no_helmet"]: 
                violation_found = True
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 3)
                cv2.putText(img, "NO HELMET", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            
            elif label in ["Helmet", "helmet"]:
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 3)
                cv2.putText(img, "Helmet", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)


    if violation_found:
        print("Violation Detected! Scanning for License Plate...")
        
        plate_results = plate_model(original_img)

        for pr in plate_results:
            p_boxes = pr.boxes
            for p_box in p_boxes:
                px1, py1, px2, py2 = map(int, p_box.xyxy[0])
                
                cv2.rectangle(img, (px1, py1), (px2, py2), (255, 0, 0), 3)

                plate_crop = original_img[py1:py2, px1:px2]

                try:
                    gray_plate = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                    ocr_res = reader.readtext(gray_plate)
                    
                    plate_text = ""
                    for (bbox, text, prob) in ocr_res:
                        if prob > 0.1: 
                            plate_text += text + " "
                    
                    if plate_text.strip():
                        print(f"Plate Found: {plate_text}")
                        detected_plates.append(plate_text.strip())
                        
                        cv2.putText(img, plate_text, (px1, py2 + 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 3)
                except Exception as e:
                    print("OCR Failed for a box")

   
    _, buffer = cv2.imencode('.jpg', img)
    img_str = base64.b64encode(buffer).decode('utf-8')

    return jsonify({
        'image': img_str,
        'plates': detected_plates
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
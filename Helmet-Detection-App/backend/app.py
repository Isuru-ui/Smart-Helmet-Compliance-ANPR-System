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
    
    
    no_helmet_boxes = [] 

    # Helmet Detection
    helmet_results = helmet_model(img, conf=0.25) 

    for r in helmet_results:
        boxes = r.boxes
        for box in boxes:
            cls = int(box.cls[0])
            label = helmet_model.names[cls]
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            if label in ["No Helmet", "No-Helmet", "no_helmet"]: 
                
                no_helmet_boxes.append([x1, y1, x2, y2])
                
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 3)
                cv2.putText(img, "NO HELMET", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            
            elif label in ["Helmet", "helmet"]:
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 3)
                

    # Plate Detection 
    if len(no_helmet_boxes) > 0:
        print(f"Found {len(no_helmet_boxes)} violators. Scanning for linked plates...")
        plate_results = plate_model(original_img, conf=0.1)

        for pr in plate_results:
            p_boxes = pr.boxes
            for p_box in p_boxes:
                px1, py1, px2, py2 = map(int, p_box.xyxy[0])
                
                
                plate_center_x = (px1 + px2) / 2
                plate_top_y = py1

                
                is_relevant = False

                for h_box in no_helmet_boxes:
                    hx1, hy1, hx2, hy2 = h_box
                    head_center_x = (hx1 + hx2) / 2
                    head_bottom_y = hy2
                    head_width = hx2 - hx1

                    # Logic 1: (Y Axis check)
                    is_below = plate_top_y > head_bottom_y

                    is_aligned = abs(plate_center_x - head_center_x) < (head_width * 3)

                    if is_below and is_aligned:
                        is_relevant = True 
                        break
                
                
                if is_relevant:
                    cv2.rectangle(img, (px1, py1), (px2, py2), (255, 0, 0), 3)
                    
                    try:
                        plate_crop = original_img[py1:py2, px1:px2]
                        gray_plate = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                        ocr_res = reader.readtext(gray_plate)
                        
                        plate_text = ""
                        for (bbox, text, prob) in ocr_res:
                            if prob > 0.2:
                                plate_text += text + " "
                        
                        if plate_text.strip():
                            detected_plates.append(plate_text.strip())
                            cv2.putText(img, plate_text, (px1, py2 + 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 3)
                    except:
                        pass

    _, buffer = cv2.imencode('.jpg', img)
    img_str = base64.b64encode(buffer).decode('utf-8')

    return jsonify({
        'image': img_str,
        'plates': detected_plates
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
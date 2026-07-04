from flask import Flask, render_template, request, jsonify
import requests
import pandas as pd
import os
from datetime import datetime
from dotenv import load_dotenv

# Загружаем переменные из .env файла
load_dotenv()

app = Flask(__name__)

# Читаем API ключ из переменных окружения (безопасно)
API_KEY = os.getenv("OPENWEATHER_API_KEY")
BASE_URL = "https://api.openweathermap.org/data/2.5/"
HISTORY_FILE = "weather_history.csv"

# ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
def get_current_weather(city):
    url = f"{BASE_URL}weather?q={city}&appid={API_KEY}&units=metric&lang=ru"
    print(f"[DEBUG] Запрос к API: {url}")
    
    # === МЕХАНИЗМ ПОВТОРНЫХ ПОПЫТОК (3 раза) ===
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=15) # Таймаут увеличен до 15 сек
            print(f"[DEBUG] Попытка {attempt + 1}. Статус ответа: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "city": data["name"],
                    "temp": data["main"]["temp"],
                    "feels_like": data["main"]["feels_like"],
                    "humidity": data["main"]["humidity"],
                    "pressure": data["main"]["pressure"],
                    "wind_speed": data["wind"]["speed"],
                    "description": data["weather"][0]["description"],
                    "icon": data["weather"][0]["icon"],
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "coord": {
                        "lat": data["coord"]["lat"],
                        "lon": data["coord"]["lon"]
                    },
                    "sunrise": data["sys"]["sunrise"],
                    "sunset": data["sys"]["sunset"]
                }
            else:
                print(f"[DEBUG] Ошибка API: {response.status_code}, текст: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"[DEBUG] Исключение при попытке {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                print("[DEBUG] Повторяем запрос через 2 секунды...")
                import time
                time.sleep(2) # Ждем 2 секунды перед следующей попыткой
            else:
                print("[ОШИБКА] Все попытки исчерпаны. OpenWeatherMap не отвечает.")
                return None
    return None

def get_forecast(city):
    url = f"{BASE_URL}forecast?q={city}&appid={API_KEY}&units=metric&lang=ru"
    print(f"[DEBUG] Запрос прогноза: {url}")
    
    # === МЕХАНИЗМ ПОВТОРНЫХ ПОПЫТОК (3 раза) ===
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=15)
            print(f"[DEBUG] Попытка {attempt + 1}. Статус прогноза: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                forecasts = []
                for item in data["list"][:40]:
                    forecasts.append({
                        "dt": datetime.fromtimestamp(item["dt"]).strftime("%Y-%m-%d %H:%M"),
                        "temp": item["main"]["temp"],
                        "description": item["weather"][0]["description"],
                        "icon": item["weather"][0]["icon"]
                    })
                return forecasts
            else:
                print(f"[DEBUG] Ошибка прогноза: {response.status_code}, текст: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"[DEBUG] Исключение прогноза при попытке {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                print("[DEBUG] Повторяем запрос прогноза через 2 секунды...")
                import time
                time.sleep(2)
            else:
                print("[ОШИБКА] Все попытки прогноза исчерпаны.")
                return None
    return None

def load_history():
    if os.path.exists(HISTORY_FILE):
        df = pd.read_csv(HISTORY_FILE)
        return df.to_dict(orient="records")
    return []

def save_to_history(city, weather):
    df = pd.DataFrame(load_history())
    new_row = pd.DataFrame({
        "Город": [city],
        "Температура": [weather["temp"]],
        "Ощущается": [weather["feels_like"]],
        "Влажность": [weather["humidity"]],
        "Дата": [weather["timestamp"]]
    })
    df = pd.concat([df, new_row], ignore_index=True)
    df = df.tail(20)
    df.to_csv(HISTORY_FILE, index=False, encoding="utf-8-sig")

# ===== МАРШРУТЫ =====
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/weather')
def weather():
    city = request.args.get('city')
    if not city:
        return jsonify({"error": "City parameter required"}), 400
    data = get_current_weather(city)
    if data:
        save_to_history(city, data)
        return jsonify(data)
    else:
        return jsonify({"error": "City not found"}), 404

@app.route('/api/forecast')
def forecast():
    city = request.args.get('city')
    if not city:
        return jsonify({"error": "City parameter required"}), 400
    data = get_forecast(city)
    if data:
        return jsonify(data)
    else:
        return jsonify({"error": "Forecast not available"}), 404

@app.route('/api/history')
def history():
    return jsonify(load_history())

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    # host='0.0.0.0' позволяет открыть сайт на другом компьютере в локальной сети, 
    # если запустить с этим параметром.
    app.run(debug=True, host='0.0.0.0', port=5000)
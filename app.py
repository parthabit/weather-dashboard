from flask import Flask, render_template, request, jsonify
import requests
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# API Keys - Get from environment variables
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'your_api_key_here')
AQI_API_KEY = os.getenv('AQI_API_KEY', 'your_aqi_api_key_here')

# Constants
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5"
AQI_API_URL = "https://api.openweathermap.org/data/2.5/air_quality"
GEO_API_URL = "https://api.openweathermap.org/geo/1.0/direct"


def get_weather_icon(weather_condition):
    """Convert weather condition to emoji or icon code"""
    conditions = {
        'clear': '☀️',
        'clouds': '☁️',
        'rain': '🌧️',
        'snow': '❄️',
        'thunderstorm': '⛈️',
        'mist': '🌫️',
        'fog': '🌫️',
        'drizzle': '🌦️',
    }
    
    condition_lower = weather_condition.lower()
    for key, emoji in conditions.items():
        if key in condition_lower:
            return emoji
    return '🌤️'


def calculate_wind_chill(temp_c, wind_speed_ms):
    """Calculate wind chill factor (Celsius)"""
    if temp_c > 10 or wind_speed_ms < 4.47:  # 4.47 m/s = 10 mph
        return None
    
    wind_speed_kmh = wind_speed_ms * 3.6
    wind_chill = 13.12 + 0.6215 * temp_c - 11.37 * (wind_speed_kmh ** 0.16) + \
                 0.3965 * temp_c * (wind_speed_kmh ** 0.16)
    return round(wind_chill, 1)


def get_air_quality(lat, lon):
    """Fetch air quality index"""
    try:
        response = requests.get(
            AQI_API_URL,
            params={
                'lat': lat,
                'lon': lon,
                'appid': OPENWEATHER_API_KEY
            }
        )
        if response.status_code == 200:
            data = response.json()
            aqi = data.get('list', [{}])[0].get('main', {}).get('aqi', None)
            
            aqi_levels = {
                1: 'Good',
                2: 'Fair',
                3: 'Moderate',
                4: 'Poor',
                5: 'Very Poor'
            }
            return aqi_levels.get(aqi, 'Unknown')
        return 'Unknown'
    except:
        return 'Unknown'


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/weather', methods=['GET'])
def get_weather():
    """Get current weather and forecast"""
    city = request.args.get('city', '')
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    
    if not city and (not lat or not lon):
        return jsonify({'error': 'City name or coordinates required'}), 400
    
    try:
        # Get current weather
        if city:
            current_response = requests.get(
                f"{WEATHER_API_URL}/weather",
                params={
                    'q': city,
                    'appid': OPENWEATHER_API_KEY,
                    'units': 'metric'
                }
            )
        else:
            current_response = requests.get(
                f"{WEATHER_API_URL}/weather",
                params={
                    'lat': lat,
                    'lon': lon,
                    'appid': OPENWEATHER_API_KEY,
                    'units': 'metric'
                }
            )
        
        if current_response.status_code != 200:
            return jsonify({'error': 'City not found'}), 404
        
        current_data = current_response.json()
        city_name = current_data.get('name', 'Unknown')
        country = current_data.get('sys', {}).get('country', '')
        lat = current_data.get('coord', {}).get('lat')
        lon = current_data.get('coord', {}).get('lon')
        
        # Get forecast
        forecast_response = requests.get(
            f"{WEATHER_API_URL}/forecast",
            params={
                'lat': lat,
                'lon': lon,
                'appid': OPENWEATHER_API_KEY,
                'units': 'metric'
            }
        )
        
        # Get air quality
        air_quality = get_air_quality(lat, lon)
        
        # Process current weather
        temp = current_data.get('main', {}).get('temp', 'N/A')
        feels_like = current_data.get('main', {}).get('feels_like', temp)
        humidity = current_data.get('main', {}).get('humidity', 'N/A')
        pressure = current_data.get('main', {}).get('pressure', 'N/A')
        wind_speed = current_data.get('wind', {}).get('speed', 0)
        wind_deg = current_data.get('wind', {}).get('deg', 0)
        wind_gust = current_data.get('wind', {}).get('gust', None)
        visibility = current_data.get('visibility', 'N/A')
        clouds = current_data.get('clouds', {}).get('all', 0)
        weather_main = current_data.get('weather', [{}])[0].get('main', 'Unknown')
        weather_desc = current_data.get('weather', [{}])[0].get('description', '')
        
        wind_chill = calculate_wind_chill(temp, wind_speed)
        
        # Process forecast
        forecast_list = []
        if forecast_response.status_code == 200:
            forecast_data = forecast_response.json().get('list', [])
            
            # Group by day (take 1 entry per day at noon)
            daily_data = {}
            for item in forecast_data:
                date = datetime.fromtimestamp(item['dt']).strftime('%Y-%m-%d')
                hour = datetime.fromtimestamp(item['dt']).hour
                
                if date not in daily_data or (12 - abs(hour - 12) > 12 - abs(daily_data[date].get('hour', 0) - 12)):
                    daily_data[date] = {
                        'dt': item['dt'],
                        'hour': hour,
                        'temp_max': item['main']['temp_max'],
                        'temp_min': item['main']['temp_min'],
                        'temp': item['main']['temp'],
                        'humidity': item['main']['humidity'],
                        'weather': item['weather'][0]['main'],
                        'description': item['weather'][0]['description']
                    }
            
            # Sort by date and take first 5 days
            for date in sorted(daily_data.keys())[:5]:
                data = daily_data[date]
                forecast_list.append({
                    'date': datetime.strptime(date, '%Y-%m-%d').strftime('%a, %b %d'),
                    'temp_max': round(data['temp_max'], 1),
                    'temp_min': round(data['temp_min'], 1),
                    'temp': round(data['temp'], 1),
                    'humidity': data['humidity'],
                    'weather': data['weather'],
                    'description': data['description'],
                    'icon': get_weather_icon(data['weather'])
                })
        
        # Calculate UV index (simplified based on time and location)
        sunrise = current_data.get('sys', {}).get('sunrise', 0)
        sunset = current_data.get('sys', {}).get('sunset', 0)
        current_time = current_data.get('dt', 0)
        
        if sunrise < current_time < sunset:
            # Roughly estimate UV based on clouds
            uv_index = max(0, (10 - (clouds / 10)))
        else:
            uv_index = 0
        
        return jsonify({
            'city': city_name,
            'country': country,
            'lat': lat,
            'lon': lon,
            'current': {
                'temperature': round(temp, 1),
                'feels_like': round(feels_like, 1),
                'humidity': humidity,
                'pressure': pressure,
                'wind_speed': round(wind_speed, 1),
                'wind_deg': wind_deg,
                'wind_gust': round(wind_gust, 1) if wind_gust else None,
                'wind_chill': wind_chill,
                'visibility': round(visibility / 1000, 1) if visibility != 'N/A' else 'N/A',
                'clouds': clouds,
                'weather': weather_main,
                'description': weather_desc,
                'icon': get_weather_icon(weather_main),
                'air_quality': air_quality,
                'uv_index': round(uv_index, 1),
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            },
            'forecast': forecast_list
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/cities', methods=['GET'])
def get_cities():
    """Search for cities by name"""
    query = request.args.get('q', '')
    limit = request.args.get('limit', 5)
    
    if not query or len(query) < 2:
        return jsonify({'cities': []})
    
    try:
        response = requests.get(
            GEO_API_URL,
            params={
                'q': query,
                'limit': limit,
                'appid': OPENWEATHER_API_KEY
            }
        )
        
        if response.status_code == 200:
            cities = []
            for item in response.json():
                cities.append({
                    'name': item['name'],
                    'country': item.get('country', ''),
                    'state': item.get('state', ''),
                    'lat': item['lat'],
                    'lon': item['lon']
                })
            return jsonify({'cities': cities})
        return jsonify({'cities': []})
    except:
        return jsonify({'cities': []})


if __name__ == '__main__':
    app.run(debug=True)

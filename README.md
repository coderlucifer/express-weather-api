# Express Weather API

This is a Node.js Express API that fetches day-wise weather data (temperature, humidity, precipitation, soil moisture) using Open-Meteo API.

## Routes

- `/` → Health check
- `/weather?lat=<lat>&lon=<lon>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>` → Returns day-wise weather data in JSON

## Example


import { create } from "zustand";

export type WeatherId = "dry" | "rainy" | "harmattan";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

interface WeatherState {
  day: number;
  weatherId: WeatherId;
  timeOfDay: TimeOfDay;
  temperature: number;
  windSpeed: number;
  humidity: number;
  visibility: number;
}

interface WeatherConfig {
  id: WeatherId;
  label: string;
  icon: string;
  baseTemp: number;
  tempVariance: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
  rainIntensity: number;
  dustIntensity: number;
  description: string;
  skyColor: string;
  groundColor: string;
  fogColor: string;
  lightingMultiplier: number;
}

interface TimeConfig {
  key: TimeOfDay;
  label: string;
  hour: number;
  sunHeight: number;
  lightIntensity: number;
  ambientIntensity: number;
  fogDensity: number;
  skyGradientTop: string;
  skyGradientBottom: string;
}

// Port Harcourt weather seasonality
export const WEATHER_CONFIG: Record<WeatherId, WeatherConfig> = {
  dry: {
    id: "dry",
    label: "Dry Season",
    icon: "☀️",
    baseTemp: 31,
    tempVariance: 2,
    humidity: 45,
    windSpeed: 2,
    visibility: 85,
    rainIntensity: 0,
    dustIntensity: 0.3,
    description: "Warm and clear with bright streets and open views.",
    skyColor: "#FFD666",
    groundColor: "#D4A574",
    fogColor: "rgba(255, 214, 102, 0.1)",
    lightingMultiplier: 1.2,
  },
  rainy: {
    id: "rainy",
    label: "Rainy Season",
    icon: "🌧️",
    baseTemp: 27,
    tempVariance: 1,
    humidity: 85,
    windSpeed: 5,
    visibility: 50,
    rainIntensity: 0.8,
    dustIntensity: 0,
    description: "Short downpours sweep the city and slick the market roads.",
    skyColor: "#3BD8F9",
    groundColor: "#8B7355",
    fogColor: "rgba(59, 130, 246, 0.2)",
    lightingMultiplier: 0.7,
  },
  harmattan: {
    id: "harmattan",
    label: "Harmattan",
    icon: "🌫️",
    baseTemp: 29,
    tempVariance: 3,
    humidity: 30,
    windSpeed: 7,
    visibility: 40,
    rainIntensity: 0,
    dustIntensity: 0.9,
    description: "Dry winds and dusty haze settle over the city.",
    skyColor: "#CA8A04",
    groundColor: "#A89968",
    fogColor: "rgba(202, 138, 4, 0.3)",
    lightingMultiplier: 0.9,
  },
};

export const TIME_CONFIG: Record<TimeOfDay, TimeConfig> = {
  morning: {
    key: "morning",
    label: "Morning",
    hour: 6,
    sunHeight: 30,
    lightIntensity: 0.8,
    ambientIntensity: 0.6,
    fogDensity: 0.15,
    skyGradientTop: "#FFB347",
    skyGradientBottom: "#FFE4B5",
  },
  afternoon: {
    key: "afternoon",
    label: "Afternoon",
    hour: 12,
    sunHeight: 70,
    lightIntensity: 1.2,
    ambientIntensity: 0.9,
    fogDensity: 0.08,
    skyGradientTop: "#87CEEB",
    skyGradientBottom: "#E0F6FF",
  },
  evening: {
    key: "evening",
    label: "Evening",
    hour: 18,
    sunHeight: 20,
    lightIntensity: 0.9,
    ambientIntensity: 0.5,
    fogDensity: 0.2,
    skyGradientTop: "#FF6B35",
    skyGradientBottom: "#F7931E",
  },
  night: {
    key: "night",
    label: "Night",
    hour: 22,
    sunHeight: 0,
    lightIntensity: 0.2,
    ambientIntensity: 0.15,
    fogDensity: 0.3,
    skyGradientTop: "#0F172A",
    skyGradientBottom: "#1E293B",
  },
};

export const useWeatherStore = create<{
  state: WeatherState;
  config: WeatherConfig;
  timeConfig: TimeConfig;
  advanceDay: () => void;
  setDay: (day: number) => void;
  getWeatherForDay: (day: number) => { weather: WeatherConfig; time: TimeConfig };
}>((set, get) => {
  const getWeatherForDay = (day: number) => {
    // Port Harcourt seasonal cycle (simplified)
    // Days 1-60: Dry, 61-150: Rainy, 151-250: Harmattan, 251-365: Dry again
    let weatherId: WeatherId;
    const dayInYear = day % 365;

    if (dayInYear <= 60) weatherId = "dry";
    else if (dayInYear <= 150) weatherId = "rainy";
    else if (dayInYear <= 250) weatherId = "harmattan";
    else weatherId = "dry";

    const timeId = ((day - 1) % 4) as unknown as TimeOfDay;
    const timeKeys: TimeOfDay[] = ["morning", "afternoon", "evening", "night"];
    const time = timeKeys[(day - 1) % 4];

    return {
      weather: WEATHER_CONFIG[weatherId],
      time: TIME_CONFIG[time],
    };
  };

  const initialWeather = getWeatherForDay(1);

  return {
    state: {
      day: 1,
      weatherId: initialWeather.weather.id,
      timeOfDay: initialWeather.time.key,
      temperature: initialWeather.weather.baseTemp,
      windSpeed: initialWeather.weather.windSpeed,
      humidity: initialWeather.weather.humidity,
      visibility: initialWeather.weather.visibility,
    },
    config: initialWeather.weather,
    timeConfig: initialWeather.time,
    setDay: (day: number) => {
      const weatherData = getWeatherForDay(day);
      set({
        state: {
          day,
          weatherId: weatherData.weather.id,
          timeOfDay: weatherData.time.key,
          temperature: weatherData.weather.baseTemp + (Math.random() - 0.5) * weatherData.weather.tempVariance,
          windSpeed: weatherData.weather.windSpeed + (Math.random() - 0.5) * 2,
          humidity: weatherData.weather.humidity,
          visibility: weatherData.weather.visibility,
        },
        config: weatherData.weather,
        timeConfig: weatherData.time,
      });
    },
    advanceDay: () => {
      const currentDay = get().state.day;
      get().setDay(currentDay + 1);
    },
  };
});

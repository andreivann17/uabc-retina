import axios from "axios";

const api = axios.create({
  baseURL: `http://${window.location.hostname}:8000`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");

        const { data } = await axios.post(
          `http://${window.location.hostname}:8000/auth/refresh`,
          { token: refreshToken }
        );

        localStorage.setItem("access_token", data.access_token);

        originalRequest.headers.Authorization =
          `Bearer ${data.access_token}`;

        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;

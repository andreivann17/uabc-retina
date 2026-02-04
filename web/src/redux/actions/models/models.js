import axios from "axios";
import { FETCH_MODELS_FAILURE, FETCH_MODELS_SUCCESS } from "./types";

const API_BASE = `http://${window.location.hostname}:8000`;

const apiForm = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "multipart/form-data" },
});

const fetchModelsSuccess = (payload) => ({ type: FETCH_MODELS_SUCCESS, payload });
const fetchModelsFailure = (message) => ({ type: FETCH_MODELS_FAILURE, payload: { error: message } });

export const actionDiagnostic = (file, callback) => {
  return async (dispatch) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiForm.post("/diagnostic/", formData);
      dispatch(fetchModelsSuccess(res.data));
      if (callback) callback(res.data);
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        "Unknown error";
      dispatch(fetchModelsFailure(msg));
    }
  };
};

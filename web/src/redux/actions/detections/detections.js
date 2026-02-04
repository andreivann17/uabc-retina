// redux/actions/detections/detections.js
import axios from "axios";
import {
  FETCH_DETECTIONS_FAILURE,
  FETCH_DETECTIONS_SUCCESS,
} from "./types";

// IMPORTANTE:
// Define este type en tu reducer de auth (o donde manejes sesión).
// Aquí lo dejo como string paraf no romper imports.
const SESSION_EXPIRED = "SESSION_EXPIRED";

// ========= Instancias =========
const API_BASE = `http://localhost:8000`;

const apiServiceGet = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

const apiServicePost = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ========= Auth header =========
const authHeader = () => {
  const token =
    localStorage.getItem("tokenadmin") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ========= Helpers =========
const clearTokens = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("tokenadmin");
};

const extractErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

/**
 * Manejo centralizado:
 * - Si 401: limpia tokens + dispatch SESSION_EXPIRED
 * - Devuelve mensaje para UI/Redux
 */
const handleApiError = (dispatch, error, fallbackMsg) => {
  const status = error?.response?.status;

  if (status === 401) {
    clearTokens();
    if (dispatch) dispatch({ type: SESSION_EXPIRED });
    return "Tu sesión ha expirado. Autentícate nuevamente.";
  }

  return extractErrorMessage(error, fallbackMsg);
};

// ========= Action creators =========
const fetchDetectionsSuccess = (payload) => ({
  type: FETCH_DETECTIONS_SUCCESS,
  payload,
});

const fetchDetectionsFailure = (message) => ({
  type: FETCH_DETECTIONS_FAILURE,
  payload: { error: message },
});

/**
 * LIST (GET /detections)
 */
export const actionDetectionsGet = () => {
  return async (dispatch) => {
    try {
      const resp = await apiServiceGet.get("detections", {
        headers: { ...authHeader() },
      });

      dispatch(fetchDetectionsSuccess(resp.data));
    } catch (error) {
      const msg = handleApiError(dispatch, error, "Error al cargar detections");
      dispatch(fetchDetectionsFailure(msg));
    }
  };
};

/**
 * CARDS (GET /detections/cards)
 */
export const actionDetectionsCards = () => {
  return async (dispatch) => {
    try {
      const resp = await apiServiceGet.get("detections/cards", {
        headers: { ...authHeader() },
      });
      dispatch(fetchDetectionsSuccess(resp.data));
    } catch (error) {
      const msg = handleApiError(dispatch, error, "Error al cargar detections");
      dispatch(fetchDetectionsFailure(msg));
    }
  };
};

/**
 * CREATE (POST /detections)
 * payload: { nombre, id_user_created?, id_user_updated?, active? }
 */
export const actionDetectionCreate = (payload, onDone = () => {}) => {
  return async (dispatch) => {
    try {
      await apiServicePost.post("detections", payload, {
        headers: { ...authHeader() },
      });
      await dispatch(actionDetectionsGet());
      onDone();
    } catch (error) {
      const msg = handleApiError(
        dispatch,
        error,
        "No se pudo crear el detection"
      );
      dispatch(fetchDetectionsFailure(msg));
      throw error;
    }
  };
};

/**
 * GET BY CODE (GET /detections/code/{code})
 * OJO: ahora sí recibe dispatch para poder disparar SESSION_EXPIRED si hay 401
 */
export const actionDetectionGetByCode = (code) => {
  return async (dispatch) => {
    try {
      const resp = await apiServiceGet.get(
        `detections/code/${encodeURIComponent(code)}`,
        {
          headers: { ...authHeader() },
        }
      );
      return resp.data;
    } catch (error) {
      const msg = handleApiError(
        dispatch,
        error,
        "No se pudo obtener el detection"
      );
      dispatch(fetchDetectionsFailure(msg));
      throw error;
    }
  };
};

/**
 * UPDATE BY CODE (PATCH /detections/code/{code})
 */
export const actionDetectionUpdateByCode = (code, payload, onDone = () => {}) => {
  return async (dispatch) => {
    try {
      await apiServicePost.patch(
        `detections/code/${encodeURIComponent(code)}`,
        payload,
        {
          headers: { ...authHeader() },
        }
      );
      await dispatch(actionDetectionsGet());
      onDone();
    } catch (error) {
      const msg = handleApiError(
        dispatch,
        error,
        "No se pudo actualizar el detection"
      );
      dispatch(fetchDetectionsFailure(msg));
      throw error;
    }
  };
};

/**
 * DELETE BY CODE (DELETE /detections/code/{code}) — soft delete active=0
 */
export const actionDetectionDeleteByCode = (code, onDone = () => {}) => {
  return async (dispatch) => {
    try {
      await apiServiceGet.delete(`detections/code/${encodeURIComponent(code)}`, {
        headers: { ...authHeader() },
      });
      await dispatch(actionDetectionsGet());
      onDone();
    } catch (error) {
      const msg = handleApiError(
        dispatch,
        error,
        "No se pudo eliminar el detection"
      );
      dispatch(fetchDetectionsFailure(msg));
      throw error;
    }
  };
};

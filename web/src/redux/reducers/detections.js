// redux/reducers/detections.js  (recomendado que este archivo sea solo de detections)
// Si por ahora lo tienes como redux/reducers/index.js, igual sirve.
    
import {
  FETCH_DETECTIONS_SUCCESS,
  FETCH_DETECTIONS_FAILURE,
} from "../actions/detections/types";

const initialState = {
  data: [],
  error: null,
};

const detectionsReducer = (state = initialState, action) => {
  switch (action.type) {
    case FETCH_DETECTIONS_SUCCESS:
      return {
        ...state,
        data:action.payload,
      };

    case FETCH_DETECTIONS_FAILURE:
      return {
        ...state,
        error: action.payload,
      };
    default:
      return state;
  }
};

export default detectionsReducer;

import {
  FETCH_MODELS_SUCCESS,
  FETCH_MODELS_FAILURE,
} from "../actions/models/types";

const initialState = {
  data: [],
};

const rootReducer = (state = initialState, action) => {
  switch (action.type) {
    case FETCH_MODELS_SUCCESS:
      return {
        ...state,
        data: action.payload,
      };

    case FETCH_MODELS_FAILURE:
      return {
        ...state,
        data: action.payload,
      };

    default:
      return state;
  }
};

export default rootReducer;

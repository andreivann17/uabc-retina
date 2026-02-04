import {FETCH_SCROLL,FETCH_FECHAS_FAILURE,FETCH_FECHAS_SUCCESS,FETCH_MESES_FAILURE,FETCH_MESES_SUCCESS} from "./types"
import {apiServiceGet} from "../../../containers/pages/utils/apiService"

export const actionScroll = (value) => {
    return async (dispatch) => {
        dispatch(fetchScroll(value))
    };
};
export const fetchScroll = (value) => {
    return {
      type: FETCH_SCROLL,
      payload: value,
    };
};

export const actionMeses = (id) => {
  
  return async (dispatch) => {
    try {

      const response = await apiServiceGet.fetchData(
        `http://${window.location.hostname}:8000/ajustes/meses/${id}`,
       
      );
      dispatch(fetchMesesSuccess(response.data.data[0]));
      dispatch(fetchFechasSuccess(response.data.data[1]));
 
    } catch (error) {
      dispatch(fetchFechasFailure(error.message));
    }
  };
};

export const fetchFechasSuccess = (data) => {
    return {
      type: FETCH_FECHAS_SUCCESS,
      payload: data,
    };
  };
  
  
  export const fetchFechasFailure = (error) => {
    return {
      type: FETCH_FECHAS_FAILURE,
      payload: error,
    };
  };
export const fetchMesesSuccess = (data) => {
  return {
    type: FETCH_MESES_SUCCESS,
    payload: data,
  };
};


export const fetchMesesFailure = (error) => {
  return {
    type: FETCH_MESES_FAILURE,
    payload: error,
  };
};
import axios from "axios";
import Cookies from "js-cookie";
const token  = localStorage.getItem("tokends")
export const apiService = {
  fetchData: (url, parameters) => {
    const csrftoken = Cookies.get("csrftoken");

    return axios.post(url, parameters, {
      headers: {
        "Authorization":token,
        "X-CSRFToken": csrftoken,

      },
    });
  },
};
export const apiServiceGet = {
  fetchData: (url) => {
    const csrftoken = Cookies.get("csrftoken");

    return axios.get(url, {}, {
      headers: {

        "X-CSRFToken": csrftoken,

      },
    });
  },
};
export const apiServiceDelete = {
  fetchData: (url) => {
    const csrftoken = Cookies.get("csrftoken");

    return axios.delete(url, {}, {
      headers: {
        "Authorization":token,
        "X-CSRFToken": csrftoken,

      },
    });
  },
};
export const apiServicePatch = {
  fetchData: (url, parameters) => {
    const csrftoken = Cookies.get("csrftoken");
    return axios.patch(url, parameters, {
      headers: {
        "Authorization":token,
        "X-CSRFToken": csrftoken,
      
      },
    });
  },
};
export const apiServiceNoToken = {
  fetchData: (url, parameters) => {
    const csrftoken = Cookies.get("csrftoken");

    return axios.post(url, parameters, {
      headers: {
      
        "X-CSRFToken": csrftoken,

      },
    });
  },
};
export const apiServiceLogin = {
  fetchData: (url, parameters,token) => {
    const csrftoken = Cookies.get("csrftoken");

    return axios.post(url, parameters, {
      headers: {
        "Authorization":token,
        "X-CSRFToken": csrftoken,

      },
    });
  },
};